import {
    Client,
    GatewayIntentBits,
    Events,
    Message,
    AttachmentBuilder,
    Partials,
  } from 'discord.js';
  import * as dotenv from 'dotenv';
  import fs from 'fs';
  import path from 'path';
  
  dotenv.config();
  
  const TOKEN = process.env.DISCORD_TOKEN!;
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

  client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user?.tag}`);
  });
  
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (message.channel.id !== TARGET_CHANNEL_ID) return;
  
    // 添付ファイルがない場合、URLが含まれているかを確認
    const hasAttachments = message.attachments.size > 0;
    const hasURL = /(https?:\/\/[^\s]+)/.test(message.content);
  
    if (!hasAttachments && !hasURL) return;
  
    // メッセージ数をカウント
    const userId = message.author.id;
    const currentCount = messageCounts.get(userId) || 0;
    messageCounts.set(userId, currentCount + 1);
    saveMessageCounts(); // メッセージ数を保存
  
    try {
      const dmChannel = await message.author.createDM();
  
      // 添付ファイルの処理
      const files: AttachmentBuilder[] = [];
      for (const attachment of message.attachments.values()) {
        const file = new AttachmentBuilder(attachment.url, {
          name: attachment.name || 'file',
        });
        files.push(file);
      }
  
      // 送信するテキスト（URLが含まれている場合はその内容を送信）
      const content = message.content.trim() !== ''
        ? `あなたが送ったメッセージ:\n> ${message.content}\n\nこれまでに送信したメッセージ数: ${messageCounts.get(userId)}`
        : `これまでに送信したメッセージ数: ${messageCounts.get(userId)}`;
  
      await dmChannel.send({
        content,
        files,
      });
  
      console.log(`DM sent to ${message.author.tag}`);
    } catch (error) {
      console.error(`DM送信に失敗しました (${message.author.tag}):`, error);
    }
  });
  
  client.login(TOKEN);
