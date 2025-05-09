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
// ボットのDM内のメッセージを削除するコマンドの実行
export async function clearDmExecute(interaction: any) {
  try {
    // 応答を遅延（エフェメラルメッセージで）
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (e) {
      console.warn('deferReply に失敗しました:', e);
    }

    // ボットのDMチャンネルを取得
    const dmChannel = await interaction.user.createDM();

    // メッセージを取得（最大100件）
    const messages = await dmChannel.messages.fetch({ limit: 100 });

    if (messages.size === 0) {
      if (!interaction.replied) {
        await interaction.editReply({
          content: 'DM内に削除するメッセージがありません。',
        });
      } else {
        await interaction.followUp({
          content: 'DM内に削除するメッセージがありません。',
          ephemeral: true,
        });
      }
      return;
    }

    // メッセージを並列で削除（Botが送信したもののみ）
    const messagesArray = Array.from(messages.values()) as import('discord.js').Message[];
    await Promise.all(
      messagesArray.map(async (msg: import('discord.js').Message) => {
        try {
          if (msg.author.bot) {
            await msg.delete();
          }
        } catch (e) {
          console.warn(`⚠️ メッセージ ${msg.id} の削除に失敗しました:`, e);
        }
      })
    );

    if (!interaction.replied) {
      await interaction.editReply({
        content: `ボットのDM内のメッセージをすべて削除しました（${messagesArray.length} 件）。`,
      });
    } else {
      await interaction.followUp({
        content: `ボットのDM内のメッセージをすべて削除しました（${messagesArray.length} 件）。`,
        ephemeral: true,
      });
    }

    console.log(`✅ ボットのDM内のメッセージを削除しました (${messagesArray.length} 件)`);
  } catch (error) {
    console.error('❌ DM内のメッセージ削除に失敗しました:', error);

    try {
      const errorMsg = 'DM内のメッセージ削除中にエラーが発生しました。';
      if (!interaction.replied) {
        await interaction.editReply({ content: errorMsg });
      } else {
        await interaction.followUp({ content: errorMsg, ephemeral: true });
      }
    } catch (innerError) {
      console.error('⚠️ エラーメッセージの送信にも失敗しました:', innerError);
    }
  }
}
