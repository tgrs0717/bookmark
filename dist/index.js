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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const firestoreMessageCount_1 = require("./firestoreMessageCount");
const firebase_1 = require("./firebase"); // 上記ファイルを import
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
dotenv.config();
const TOKEN = process.env.DISCORD_TOKEN;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
const MESSAGE_COUNTS_FILE = path_1.default.join(__dirname, 'messageCounts.json');
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.DirectMessages,
    ],
    partials: [discord_js_1.Partials.Channel],
});
const messageCounts = new Map(); // ユーザーごとのメッセージ数を追跡
// メッセージ数を保存する関数
function saveMessageCounts() {
    fs_1.default.writeFileSync(MESSAGE_COUNTS_FILE, JSON.stringify(Object.fromEntries(messageCounts)));
}
// メッセージ数を読み込む関数
function loadMessageCounts() {
    if (fs_1.default.existsSync(MESSAGE_COUNTS_FILE)) {
        const data = fs_1.default.readFileSync(MESSAGE_COUNTS_FILE, 'utf-8');
        const parsedData = JSON.parse(data);
        for (const [key, value] of Object.entries(parsedData)) {
            messageCounts.set(key, value);
        }
    }
}
loadMessageCounts(); // 起動時にメッセージ数を読み込む
client.once(discord_js_1.Events.ClientReady, () => {
    console.log(`Logged in as ${client.user?.tag}`);
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
        const newCount = await (0, firestoreMessageCount_1.incrementMessageCount)(userId); // メッセージ数をFirestoreで更新
        const currentCount = messageCounts.get(userId) || 0;
        messageCounts.set(userId, currentCount + 1);
        saveMessageCounts(); // メッセージ数を保存
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
            ? `あなたが送ったメッセージ:\n> ${message.content}\n\nこれまでに送信したメッセージ数: ${newCount}`
            : `これまでに送信したメッセージ数: ${newCount}`;
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
client.login(TOKEN);
