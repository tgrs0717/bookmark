"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('send')
    .setDescription('送信者が送ったメッセージを代わりにボットが送信します')
    .addStringOption(option => option.setName('message')
    .setDescription('ボットが送信するメッセージ内容')
    .setRequired(true));
async function execute(interaction) {
    const messageContent = interaction.options.getString('message');
    try {
        // 応答を遅延
        await interaction.deferReply({ ephemeral: true });
        // 公開チャンネルにメッセージを送信
        await interaction.channel?.send(messageContent);
        // 遅延応答を編集
        await interaction.editReply({
            content: `ボットが以下のメッセージを送信しました:\n> ${messageContent}`,
        });
        console.log(`✅ メッセージを送信しました: ${messageContent}`);
    }
    catch (error) {
        console.error('❌ メッセージの送信に失敗しました:', error);
        // エラーが発生した場合も応答を編集
        if (!interaction.replied) {
            await interaction.editReply({
                content: 'メッセージの送信中にエラーが発生しました。',
            });
        }
    }
}
