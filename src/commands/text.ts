import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ChatInputCommandInteraction, CacheType, TextChannel } from 'discord.js';
import { db } from '../firebase'; // Firestore設定ファイルのパスを調整
import { incrementMessageCount } from '../firestoreMessageCount';

// 許可されたチャンネルID
const ALLOWED_CHANNEL_ID = '1367024358567972885';


// スラッシュコマンド: メッセージを送信
export const sendCommand = new SlashCommandBuilder()
  .setName('send')
  .setDescription('送信者が送ったURLを代わりにボットが送信し、DMで通知します')
  .addStringOption(option =>
    option.setName('message')
      .setDescription('ボットが送信するURLを含むメッセージ内容')
      .setRequired(true)
  );

// スラッシュコマンド: 削除されたメッセージを復元
export const restoreCommand = new SlashCommandBuilder()
  .setName('restore')
  .setDescription('削除されたメッセージを復元します。')
  .addStringOption(option =>
    option.setName('message_id')
      .setDescription('復元するメッセージのID')
      .setRequired(true)
  );

// スラッシュコマンド: ボットのDM内のメッセージを削除
export const clearDmCommand = new SlashCommandBuilder()
  .setName('cleardm')
  .setDescription('ボットのDM内のすべてのメッセージを削除します');

// メッセージ送信コマンド実行
export async function sendExecute(interaction: ChatInputCommandInteraction<CacheType>) {
  const messageContent = interaction.options.getString('message', true); // 必須オプションとして扱う

  try {
    // 応答を遅延
    await interaction.deferReply({ ephemeral: true });

    // 許可されたチャンネルか確認
    if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
      return interaction.editReply('このコマンドはこのチャンネルでは使用できません。');
    }

    // URLが含まれているか確認
    const hasURL = /(https?:\/\/[^\s]+)/.test(messageContent);
    if (!hasURL) {
      return interaction.editReply('送信されたメッセージにURLが含まれていません。');
    }

    // Firestoreで送信数をカウント
    const newCount = await incrementMessageCount(interaction.user.id);

    // DMチャンネル作成＆メッセージ送信
    const dmChannel = await interaction.user.createDM();
    await dmChannel.send({
      content: `> 現在のブックマーク数 : ${newCount}\n${messageContent}\n`,
    });

    // 公開チャンネルにメッセージを送信
    if (interaction.channel?.isTextBased()) {
      await (interaction.channel as TextChannel).send(messageContent);
    }

    // 応答を編集
    await interaction.editReply('ボットが代わりに送信しました');

    // 5秒後にエフェメラルメッセージを削除
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        console.error('❌ エフェメラルメッセージの削除に失敗しました:', error);
      }
    }, 5000);

    console.log(`✅ メッセージを送信しました: ${messageContent}`);
  } catch (error) {
    console.error('❌ メッセージの送信に失敗しました:', error);
    await handleErrorResponse(interaction, 'メッセージの送信中にエラーが発生しました。');
  }
}

// エラーレスポンスの処理
async function handleErrorResponse(interaction: CommandInteraction, message: string) {
  try {
    if (!interaction.replied) {
      await interaction.editReply({ content: message });
    } else {
      await interaction.followUp({ content: message, ephemeral: true });
    }
  } catch (error) {
    console.error('⚠️ エラーメッセージの送信にも失敗しました:', error);
  }
}

// 削除されたメッセージを復元
export async function restoreExecute(interaction: ChatInputCommandInteraction<CacheType>) {
  const messageId = interaction.options.getString('message_id', true);

  try {
    const deletedMessagesRef = db.collection('deletedMessages');
    const snapshot = await deletedMessagesRef.where('id', '==', messageId).get();

    if (snapshot.empty) {
      return interaction.reply({ content: '指定されたメッセージは見つかりません。', ephemeral: true });
    }

    const deletedMessage = snapshot.docs[0].data();
    const dmChannel = await interaction.user.createDM();

    const embed = new EmbedBuilder()
      .setTitle('復元されたメッセージ')
      .setDescription(deletedMessage.content)
      .setFooter({ text: `送信者: ${deletedMessage.author}` })
      .setTimestamp(deletedMessage.timestamp);

    await dmChannel.send({ embeds: [embed] });
    await interaction.reply({ content: 'メッセージが復元されました。', ephemeral: true });
  } catch (error) {
    console.error('❌ メッセージ復元に失敗しました:', error);
    await interaction.reply({ content: 'メッセージの復元中にエラーが発生しました。', ephemeral: true });
  }
}

// DM内のボットメッセージを削除
export async function clearDmExecute(interaction: CommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const dmChannel = await interaction.user.createDM();
    const messages = await dmChannel.messages.fetch({ limit: 100 });

    if (messages.size === 0) {
      return await interaction.editReply('DM内に削除するメッセージがありません。');
    }

    const messagesArray = Array.from(messages.values());
    await Promise.all(
      messagesArray.map(async (msg) => {
        if (msg.author.bot) {
          try {
            await msg.delete();
          } catch (error) {
            console.warn(`⚠️ メッセージ ${msg.id} の削除に失敗しました:`, error);
          }
        }
      })
    );

    await interaction.editReply(`ボットのDM内のメッセージをすべて削除しました（${messagesArray.length} 件）。`);
    console.log(`✅ DM内のボットメッセージを削除しました (${messagesArray.length} 件)`);
  } catch (error) {
    console.error('❌ DM内のメッセージ削除に失敗しました:', error);
    await handleErrorResponse(interaction, 'DM内のメッセージ削除中にエラーが発生しました。');
  }
}

// execute関数の実装
export function execute(interaction: ChatInputCommandInteraction<CacheType>) {
  const { commandName } = interaction;

  switch (commandName) {
    case 'send':
      return sendExecute(interaction);
    case 'restore':
      return restoreExecute(interaction);
    case 'cleardm':
      return clearDmExecute(interaction);
    default:
      return interaction.reply({ content: 'このコマンドはサポートされていません。', ephemeral: true });
  }
}
