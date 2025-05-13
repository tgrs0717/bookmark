"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const firestoreMessageCount_1 = require("./firestoreMessageCount");
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("./firebase");
const sendCommandModule = __importStar(require("./commands/text"));
const text_1 = require("./commands/text"); // スラッシュコマンドをインポート
dotenv.config();
// Firestore 書き込みテスト
firebase_1.db.collection("messageCounts").doc("test").set({ count: 1 })
    .then(() => {
    console.log("✅ Firestore write test successful");
})
    .catch((err) => {
    console.error("❌ Firestore write test failed:", err);
});
// Expressサーバーの設定
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.get('/', (_req, res) => {
    res.send('Hello from Render with Express + TypeScript!');
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
const MESSAGE_COUNTS_FILE = path_1.default.join(__dirname, 'messageCounts.json');
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.GuildMessageReactions,
        discord_js_1.GatewayIntentBits.DirectMessageReactions,
        discord_js_1.GatewayIntentBits.DirectMessages,
    ],
    partials: [discord_js_1.Partials.Channel, discord_js_1.Partials.Message, discord_js_1.Partials.Reaction],
});
// ユーザーごとのメッセージ数を追跡
// メッセージ数を保存する関数
// メッセージ数を読み込む関数
// メッセージ削除時にFirestoreにバックアップ
function backupDeletedMessageToFirestore(message) {
    const deletedMessage = {
        id: message.id,
        content: message.content,
        author: message.author.tag,
        timestamp: message.createdTimestamp,
    };
    // Firestoreにメッセージを保存
    const deletedMessagesRef = firebase_1.db.collection('deletedMessages');
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
    text_1.sendCommand.toJSON(),
    text_1.clearDmCommand.toJSON(),
    text_1.restoreCommand.toJSON(),
];
const rest = new discord_js_1.REST({ version: '10' }).setToken(TOKEN);
(async () => {
    try {
        console.log('⏳ スラッシュコマンドを登録中...');
        await rest.put(discord_js_1.Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ スラッシュコマンドが登録されました');
    }
    catch (error) {
        console.error('❌ スラッシュコマンドの登録に失敗しました:', error);
    }
})();
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    try {
        if (interaction.commandName === 'send') {
            await sendCommandModule.execute(interaction);
        }
        else if (interaction.commandName === 'cleardm') {
            await sendCommandModule.clearDmExecute(interaction); // ← これが必要！
        }
    }
    catch (error) {
        console.error(`❌ ${interaction.commandName} コマンドの実行に失敗しました:`, error);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: 'エラーが発生しました。', ephemeral: true });
        }
        else {
            await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
        }
    }
});
client.on(discord_js_1.Events.MessageCreate, async (message) => {
    if (message.author.bot)
        return;
    if (message.channel.id !== TARGET_CHANNEL_ID)
        return;
    // 添付ファイルがない場合、URLが含まれているかを確認
    const hasAttachments = message.attachments.size > 0;
    const hasURL = /(https?:\/\/[^\s]+)/.test(message.content);
    if (!hasAttachments && !hasURL)
        return;
    // メッセージ数をカウント（Firestoreを使用）
    try {
        const userId = message.author.id;
        const newCount = await (0, firestoreMessageCount_1.incrementMessageCount)(userId);
        console.log(`✅ ユーザー ${message.author.tag} のメッセージ数は Firestore 上で ${newCount} になりました`);
        const dmChannel = await message.author.createDM();
        // 添付ファイルの処理
        const files = [];
        for (const attachment of message.attachments.values()) {
            const file = new discord_js_1.AttachmentBuilder(attachment.url, {
                name: attachment.name || 'file',
            });
            files.push(file);
        }
        // 送信するテキスト（Firestoreのカウントを含む）
        const content = message.content.trim() !== ''
            ? `> 現在のブックマーク数: ${newCount}\n${message.content}`
            : `> 現在のブックマーク数: ${newCount}`;
        await dmChannel.send({
            content,
            files,
        });
        console.log(`DM sent to ${message.author.tag}`);
    }
    catch (error) {
        console.error(`DM送信に失敗しました (${message.author.tag}):`, error);
    }
});
client.on(discord_js_1.Events.MessageCreate, async (message) => {
    try {
        // DMチャンネルかどうかを確認
        if (message.channel.type !== discord_js_1.ChannelType.GuildText ||
            message.channel.id !== TARGET_CHANNEL_ID)
            return;
        // 添付ファイルがあるか、またはURLが含まれているかを確認
        const hasAttachments = message.attachments.size > 0;
        const hasURL = /(https?:\/\/[^\s]+)/.test(message.content);
        if (!hasAttachments && !hasURL)
            return; // 添付ファイルもURLもない場合はスキップ
        try {
            await message.react('⭐');
            console.log(`✅ ${message.author.tag} のメッセージにリアクションを追加しました`);
        }
        catch (error) {
            console.error('❌ リアクションの追加に失敗しました:', error);
        }
        // メッセージ数をカウント（Firestoreを使用）
        const userId = message.author.id;
        const userDocRef = firebase_1.db.collection('messageCounts').doc(userId);
        // Firestoreでカウントをインクリメント
        await userDocRef.set({ count: firestore_1.FieldValue.increment(1) }, { merge: true });
        console.log(`✅ ユーザー ${message.author.tag} のメッセージをカウントしました。`);
    }
    catch (error) {
        console.error('❌ DM内のメッセージカウント中にエラーが発生しました:', error);
    }
});
client.on(discord_js_1.Events.MessageCreate, async (message) => {
    try {
        // ボットのメッセージは無視
        if (message.author.bot)
            return;
        // DMチャンネルかどうかを確認
        if (message.channel.type !== discord_js_1.ChannelType.DM)
            return;
        // 添付ファイルがあるか、またはURLが含まれているかを確認
        const hasAttachments = message.attachments.size > 0;
        const hasURL = /(https?:\/\/[^\s]+)/.test(message.content);
        if (!hasAttachments && !hasURL)
            return; // 添付ファイルもURLもない場合はスキップ
        // メッセージ数をカウント（Firestoreを使用）
        const userId = message.author.id;
        const userDocRef = firebase_1.db.collection('messageCounts').doc(userId);
        // Firestoreでカウントをインクリメント
        await userDocRef.set({ count: firestore_1.FieldValue.increment(1) }, { merge: true });
        console.log(`✅ ユーザー ${message.author.tag} のメッセージをカウントしました。`);
    }
    catch (error) {
        console.error('❌ DM内のメッセージカウント中にエラーが発生しました:', error);
    }
});
client.on(discord_js_1.Events.MessageReactionAdd, async (reaction, user) => {
    try {
        if (user.bot)
            return;
        // 部分的なリアクションやメッセージを完全に取得
        if (reaction.partial)
            await reaction.fetch();
        if (reaction.message.partial)
            await reaction.message.fetch();
        const message = reaction.message;
        // ⭐リアクションを検知し、リアクションを付けたユーザーにメッセージをDMで送信＆カウント
        if (reaction.emoji.name === '⭐' &&
            (message.channel.type === discord_js_1.ChannelType.GuildText || message.channel.type === discord_js_1.ChannelType.PublicThread)) {
            const targetUser = user;
            const targetMessage = message;
            if (targetMessage.partial) {
                console.log('ℹ️ 部分的なメッセージが削除されました。処理をスキップします。');
                return;
            }
            const hasAttachments = targetMessage.attachments.size > 0;
            const hasURL = /(https?:\/\/[^\s]+)/.test(targetMessage.content);
            if (!hasAttachments && !hasURL) {
                console.log('ℹ️ 対象メッセージに添付またはURLがないため、スキップします。');
                return;
            }
            try {
                const dm = await targetUser.createDM();
                const files = [];
                for (const attachment of targetMessage.attachments.values()) {
                    const file = new discord_js_1.AttachmentBuilder(attachment.url, {
                        name: attachment.name || 'file',
                    });
                    files.push(file);
                }
                // Firestore カウントを更新
                const userId = targetUser.id;
                const newCount = await (0, firestoreMessageCount_1.incrementMessageCount)(userId);
                const content = targetMessage.content.trim() !== ''
                    ? `> 現在のブックマーク数: ${newCount}\n${targetMessage.content}`
                    : `> 現在のブックマーク数: ${newCount}`;
                await dm.send({
                    content,
                    files,
                });
                console.log(`✅ ${targetUser.tag} にメッセージをDMで送信しました（⭐リアクション）`);
            }
            catch (err) {
                console.error(`❌ ${targetUser.tag} へのDM送信に失敗しました:`, err);
            }
        }
        // ❌ リアクション && DMチャンネル限定
        if (reaction.emoji.name === '❌' &&
            message.channel.type === discord_js_1.ChannelType.DM &&
            message.author?.id === client.user?.id // Bot自身のDMメッセージに限定
        ) {
            // 削除前にFirestoreにバックアップ
            if (message instanceof discord_js_1.Message) {
                backupDeletedMessageToFirestore(message);
            }
            else {
                console.error('❌ メッセージが完全に取得されていません。');
                return;
            }
            // メッセージ削除
            await message.delete();
            console.log(`✅ DM内のボットメッセージ ${message.id} を削除しました`);
            // カウントを減らす処理
            const userId = user.id;
            try {
                const userDocRef = firebase_1.db.collection('messageCounts').doc(userId);
                const userDoc = await userDocRef.get();
                if (userDoc.exists) {
                    const currentCount = userDoc.data()?.count || 0;
                    if (currentCount > 0) {
                        await userDocRef.update({
                            count: firestore_1.FieldValue.increment(-1),
                        });
                        console.log(`✅ Firestoreでユーザー ${userId} のカウントを減らしました。現在のカウント: ${currentCount - 1}`);
                    }
                    else {
                        console.log(`ℹ️ ユーザー ${userId} のカウントは既に 0 です。減算をスキップしました。`);
                    }
                }
                else {
                    console.log(`ℹ️ Firestoreにユーザー ${userId} のカウントデータが存在しません。`);
                }
            }
            catch (err) {
                console.error(`❌ Firestoreでユーザー ${userId} のカウント減少に失敗しました:`, err);
            }
        }
    }
    catch (error) {
        console.error('❌ リアクションによるメッセージ削除に失敗しました:', error);
    }
}); // ここで MessageReactionAdd イベントリスナーを閉じる
client.on(discord_js_1.Events.MessageDelete, async (message) => {
    try {
        // メッセージが部分的な場合はスキップ
        if (message.partial) {
            console.log('ℹ️ 部分的なメッセージが削除されました。処理をスキップします。');
            return;
        }
        // DMチャンネルかどうかを確認
        if (message.channel.type !== discord_js_1.ChannelType.DM)
            return;
        // ボットのメッセージは無視
        if (message.author?.bot)
            return;
        // URLまたは添付ファイルが含まれているか確認
        const hasAttachments = message.attachments.size > 0;
        const hasURL = /(https?:\/\/[^\s]+)/.test(message.content);
        if (!hasAttachments && !hasURL) {
            console.log('ℹ️ メッセージにURLまたは添付ファイルが含まれていないため、カウントを減らしません。');
            return;
        }
        // カウントを減らす処理
        const userId = message.author.id;
        try {
            const userDocRef = firebase_1.db.collection('messageCounts').doc(userId);
            const userDoc = await userDocRef.get();
            if (userDoc.exists) {
                const currentCount = userDoc.data()?.count || 0;
                if (currentCount > 0) {
                    await userDocRef.update({
                        count: firestore_1.FieldValue.increment(-1),
                    });
                    console.log(`✅ Firestoreでユーザー ${userId} のカウントを減らしました。現在のカウント: ${currentCount - 1}`);
                }
                else {
                    console.log(`ℹ️ ユーザー ${userId} のカウントは既に 0 です。減算をスキップしました。`);
                }
            }
            else {
                console.log(`ℹ️ Firestoreにユーザー ${userId} のカウントデータが存在しません。`);
            }
        }
        catch (err) {
            console.error(`❌ Firestoreでユーザー ${userId} のカウント減少に失敗しました:`, err);
        }
    }
    catch (error) {
        console.error('❌ メッセージ削除時のカウント減少処理に失敗しました:', error);
    }
});
client.login(TOKEN); // クライアントのログイン処理
