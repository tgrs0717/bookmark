import {
    Client,
    GatewayIntentBits,
    Events,
    Message,
    AttachmentBuilder,
    Partials,
    REST,
    Routes,
    ChannelType,
    CacheType,
    ChatInputCommandInteraction,
} from 'discord.js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { incrementMessageCount, getMessageCount } from './firestoreMessageCount';
import { db } from './firebase'; // 上記ファイルを import
import { FieldValue } from 'firebase-admin/firestore';
import * as sendCommandModule from './commands/text';
import { sendCommand,clearDmCommand,restoreCommand } from './commands/text'; // スラッシュコマンドをインポート

dotenv.config();

// Firestore 書き込みテスト
db.collection("messageCounts").doc("test").set({ count: 1 })
  .then(() => {
    console.log("✅ Firestore write test successful");
  })
  .catch((err) => {
    console.error("❌ Firestore write test failed:", err);
    
  });

// Expressサーバーの設定
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => {
  res.send('Hello from Render with Express + TypeScript!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID!;
const MESSAGE_COUNTS_FILE = path.join(__dirname, 'messageCounts.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});


// メッセージ削除時にFirestoreにバックアップ
function backupDeletedMessageToFirestore(message: Message) {
  const deletedMessage = {
    id: message.id,
    content: message.content,
    author: message.author.tag,
    timestamp: message.createdTimestamp,
  };

  // Firestoreにメッセージを保存
  const deletedMessagesRef = db.collection('deletedMessages');
  deletedMessagesRef.add(deletedMessage)
    .then(() => {
      console.log('✅ メッセージがFirestoreにバックアップされました');
    })
    .catch((error) => {
      console.error('❌ Firestoreへのバックアップに失敗しました:', error);
    });
}



// スラッシュコマンドの登録
const commands = [
   sendCommand.toJSON(),
   clearDmCommand.toJSON(),
   restoreCommand.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('⏳ スラッシュコマンドを登録中...');
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log('✅ スラッシュコマンドが登録されました');
  } catch (error) {
    console.error('❌ スラッシュコマンドの登録に失敗しました:', error);
  }
})();

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'send') {
      await sendCommandModule.execute(interaction);
    } else if (interaction.commandName === 'cleardm') {
      await sendCommandModule.clearDmExecute(interaction); // ← これが必要！
    }
  } catch (error) {
    console.error(`❌ ${interaction.commandName} コマンドの実行に失敗しました:`, error);

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'エラーが発生しました。', ephemeral: true });
    } else {
      await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
    }
  }
});

client.on(Events.MessageCreate, async (message: Message) => {
  try {
    // ボットのメッセージは無視
    if (message.author.bot) return;

    // DMチャンネルかどうかを確認
    if (message.channel.type !== ChannelType.DM) return;

    // 添付ファイルがあるか、またはURLが含まれているかを確認
    const hasAttachments = message.attachments.size > 0;
    const hasURL = /(https?:\/\/[^\s]+)/.test(message.content);

    if (!hasAttachments && !hasURL) return; // 添付ファイルもURLもない場合はスキップ

    // メッセージ数をカウント（Firestoreを使用）
    const userId = message.author.id;
    const newCount = await incrementMessageCount(userId);
    console.log(`✅ ユーザー ${message.author.tag} のメッセージ数は Firestore 上で ${newCount} になりました`);
  } catch (error) {
    console.error('❌ メッセージ作成時のエラー:', error);
  }
}); // ここで MessageCreate イベントリスナーを閉じる

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    if (user.bot) return;

    // 部分的なリアクションやメッセージを完全に取得
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const message = reaction.message;

    // ❌ リアクション && DMチャンネル限定
    if (
      reaction.emoji.name === '❌' &&
      message.channel.type === ChannelType.DM &&
      message.author?.id === client.user?.id // Bot自身のDMメッセージに限定
    ) {
      // 削除前にFirestoreにバックアップ
      if (message instanceof Message) {
        backupDeletedMessageToFirestore(message);
      } else {
        console.error('❌ メッセージが完全に取得されていません。');
        return;
      }

      // メッセージ削除
      await message.delete();
      console.log(`✅ DM内のボットメッセージ ${message.id} を削除しました`);

      // カウントを減らす処理
      const userId = user.id;

      try {
        const userDocRef = db.collection('messageCounts').doc(userId);
        await userDocRef.update({
          count: FieldValue.increment(-1),
        });
        console.log(`✅ Firestoreでユーザー ${userId} のカウントを減らしました。`);
      } catch (err) {
        console.error(`❌ Firestoreでユーザー ${userId} のカウント減少に失敗しました:`, err);
      }
    }
  } catch (error) {
    console.error('❌ リアクションによるメッセージ削除に失敗しました:', error);
  }
}); // ここで MessageReactionAdd イベントリスナーを閉じる

client.login(TOKEN); // クライアントのログイン処理