import { SlashCommandBuilder } from 'discord.js';
import { incrementMessageCount } from '../firestoreMessageCount';

// 許可するチャンネルのIDを指定
const ALLOWED_CHANNEL_ID = '1367024358567972885';

// スラッシュコマンド: メッセージを送信
export const data = new SlashCommandBuilder()
  .setName('send')
  .setDescription('送信者が送ったURLを代わりにボットが送信し、DMで通知します')
  .addStringOption(option =>
    option.setName('message')
      .setDescription('ボットが送信するURLを含むメッセージ内容')
      .setRequired(true)
  );

// スラッシュコマンド: ボットのDM内のメッセージを削除
export const clearDmData = new SlashCommandBuilder()
  .setName('cleardm')
  .setDescription('ボットのDM内のすべてのメッセージを削除します');

// メッセージを送信するコマンドの実行
export async function execute(interaction: any) {
  const messageContent = interaction.options.getString('message');

  try {
    // 応答を遅延
    await interaction.deferReply({ ephemeral: true });

    // 許可されたチャンネルか確認
    if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
      await interaction.editReply({
        content: 'このコマンドはこのチャンネルでは使用できません。',
      });
      return;
    }

    // メッセージがURLを含むか確認
    const hasURL = /(https?:\/\/[^\s]+)/.test(messageContent || '');
    if (!hasURL) {
      await interaction.editReply({
        content: '送信されたメッセージにURLが含まれていません。',
      });
      return;
    }

    // Firestoreで送信数をカウント
    const userId = interaction.user.id;
    const newCount = await incrementMessageCount(userId);

    // DMチャンネルを作成してメッセージを送信
    const dmChannel = await interaction.user.createDM();
    await dmChannel.send({
      content: `> ブックマークNo.${newCount}\n${messageContent}\n`,
    });

    // 公開チャンネルにメッセージを送信
    await interaction.channel?.send(messageContent);

    // 応答を編集
    await interaction.editReply({
      content: `ボットが代わりに送信しました`,
    });

    console.log(`✅ メッセージを送信しました: ${messageContent}`);
  } catch (error) {
    console.error('❌ メッセージの送信に失敗しました:', error);

    // エラー応答
    try {
      await interaction.editReply({
        content: 'メッセージの送信中にエラーが発生しました。',
      });
    } catch (innerError) {
      console.error('⚠️ エラーメッセージの送信にも失敗しました:', innerError);
    }
  }
}

// ボットのDM内のメッセージを削除するコマンドの実行
export async function clearDmExecute(interaction: any) {
  try {
    // 応答を遅延
    await interaction.deferReply({ ephemeral: true });

    // ボットのDMチャンネルを取得
    const dmChannel = await interaction.user.createDM();

    // メッセージを取得
    const messages = await dmChannel.messages.fetch({ limit: 100 });

    if (messages.size === 0) {
      await interaction.editReply({
        content: 'DM内に削除するメッセージがありません。',
      });
      return;
    }

    // メッセージを削除
    for (const message of messages.values()) {
      await message.delete();
    }

    await interaction.editReply({
      content: `ボットのDM内のメッセージをすべて削除しました。`,
    });

    console.log(`✅ ボットのDM内のメッセージを削除しました (${messages.size} 件)`);
  } catch (error) {
    console.error('❌ DM内のメッセージ削除に失敗しました:', error);

    // エラー応答
    try {
      await interaction.editReply({
        content: 'DM内のメッセージ削除中にエラーが発生しました。',
      });
    } catch (innerError) {
      console.error('⚠️ エラーメッセージの送信にも失敗しました:', innerError);
    }
  }
}
