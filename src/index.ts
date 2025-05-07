import {
    Client,
    GatewayIntentBits,
    Events,
    Message,
    AttachmentBuilder,
    Partials,
  } from 'discord.js';
  import * as dotenv from 'dotenv';
  
  dotenv.config();
  
  const TOKEN = process.env.DISCORD_TOKEN!;
  const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID!;
  
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });
  
  client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user?.tag}`);
  });
  
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (message.channel.id !== TARGET_CHANNEL_ID) return;
  
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
  
      // 送信するテキスト（空の場合は省略）
      const content = message.content.trim() !== ''
        ? `あなたが送ったメッセージ:\n> ${message.content}`
        : undefined;
  
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
  