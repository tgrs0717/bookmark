import {
    Client,
    GatewayIntentBits,
    Events,
    Message,
    AttachmentBuilder,
    Partials,
    REST,
    Routes,
} from 'discord.js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { incrementMessageCount, getMessageCount } from './firestoreMessageCount';
import { db } from './firebase'; // 上記ファイルを import
import * as sendCommandModule from './commands/text';
import { data as sendCommand,clearDmData } from './commands/text'; // スラッシュコマンドをインポート

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
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const messageCounts: Map<string, number> = new Map(); // ユーザーごとのメッセージ数を追跡

// メッセージ数を保存する関数
function saveMessageCounts() {
  fs.writeFileSync(MESSAGE_COUNTS_FILE, JSON.stringify(Object.fromEntries(messageCounts)));
}

// メッセージ数を読み込む関数
function loadMessageCounts() {
  if (fs.existsSync(MESSAGE_COUNTS_FILE)) {
    const data = fs.readFileSync(MESSAGE_COUNTS_FILE, 'utf-8');
    const parsedData = JSON.parse(data);
    for (const [key, value] of Object.entries(parsedData)) {
      messageCounts.set(key, value as number);
    }
  }
}

loadMessageCounts(); // 起動時にメッセージ数を読み込む





// スラッシュコマンドの登録
const commands = [
   sendCommand.toJSON(),
   clearDmData.toJSON(),
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
  if (message.author.bot) return;
  if (message.channel.id !== TARGET_CHANNEL_ID) return;

  // 添付ファイルがない場合、URLが含まれているかを確認
  const hasAttachments = message.attachments.size > 0;
  const hasURL = /(https?:\/\/[^\s]+)/.test(message.content);

  if (!hasAttachments && !hasURL) return;

  // メッセージ数をカウント（Firestoreを使用）
  try {
    const userId = message.author.id;
    const newCount = await incrementMessageCount(userId); // メッセージ数をFirestoreで更新

    const currentCount = messageCounts.get(userId) || 0;
    messageCounts.set(userId, currentCount + 1);
    saveMessageCounts(); // メッセージ数を保存

    const dmChannel = await message.author.createDM();

    // 添付ファイルの処理
    const files: AttachmentBuilder[] = [];
    for (const attachment of message.attachments.values()) {
      const file = new AttachmentBuilder(attachment.url, {
        name: attachment.name || 'file',
      });
      files.push(file);
    }

    // 送信するテキスト（Firestoreのカウントを含む）
    const content = message.content.trim() !== ''
      ? `> これまでに送信したメッセージ数: ${newCount}\n${message.content}`
      : `これまでに送信したメッセージ数: ${newCount}`;

    await dmChannel.send({
      content,
      files,
    });

    console.log(`DM sent to ${message.author.tag}`);
  } catch (error) {
    console.error(`DM送信に失敗しました (${message.author.tag}):`, error);
  }
});
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    // ボット自身のリアクションは無視
    if (user.bot) return;

    // リアクションが "❌" か確認
    if (reaction.emoji.name === '❌') {
      // メッセージを削除
      await reaction.message.delete();
      console.log(`✅ メッセージ ${reaction.message.id} を削除しました（❌ リアクションが追加されました）。`);
    }
  } catch (error) {
    console.error('❌ リアクションによるメッセージ削除に失敗しました:', error);
  }
});

client.login(TOKEN);
