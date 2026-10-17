const { Client, GatewayIntentBits, Collection, Options } = require('discord.js');
const config = require('./config');
const eventCommand = require('./commands/event');
const db = require('./db');
const { buildEventMessage } = require('./lib/embed');

// ==========================================
// 0. BẮT LỖI TOÀN CỤC ĐỂ CHỐNG SẬP NGUỒN (CRASH)
// ==========================================
process.on('unhandledRejection', error => {
  console.error('Lỗi Promise chưa được bắt (Unhandled Rejection):', error);
});

process.on('uncaughtException', error => {
  console.error('Lỗi ngoại lệ chưa được bắt (Uncaught Exception):', error);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: {
      interval: 3600,
      lifetime: 1800,
    },
  },
});

client.commands = new Collection();
client.commands.set(eventCommand.data.name, eventCommand);

// Cấu hình ID kênh lưu trữ build chuẩn
const MODERATOR_CHANNEL_ID = '1352408303371812868';

const managedEventRooms = new Set();
const emptyRoomTimeouts = new Map();
const activeEventsTracker = new Map();
const sentBuildUsers = new Set(); // Chống gửi trùng DM trong mỗi sự kiện

/**
 * 1. ĐĂNG KÝ THEO DÕI SỰ KIỆN ĐỂ TỰ ĐỘNG XÓA SAU 15 PHÚT KỂ TỪ GIỜ HẸN
 */
function trackEventForExpiration(channelId, messageId, eventId, startTimestamp, guildId) {
  const millis = startTimestamp < 10000000000 ? startTimestamp * 1000 : startTimestamp;
  const expirationTime = millis + (15 * 60 * 1000); // Giờ hẹn + 15 phút

  activeEventsTracker.set(eventId, {
    channelId,
    messageId,
    expirationTime,
    guildId,
  });
}

client.trackEventForExpiration = trackEventForExpiration;

/**
 * 2. Tự động tạo phòng thoại khi đến giờ hẹn và gửi Build chuẩn qua DM
 */
function scheduleEventRoomCreation(client, event) {
  const now = Date.now();
  const millis = event.start_ts < 10000000000 ? event.start_ts * 1000 : event.start_ts;
  const delay = millis - now;

  if (delay < -15 * 60 * 1000) {
    return;
  }

  const executionDelay = Math.max(0, delay);

  setTimeout(async () => {
    let createdChannelId = null;
    try {
      const guild = await client.guilds.fetch(event.guild_id).catch(() => null);
      if (!guild) return;

      const signups = db.getSignups(event.id);
      const attendingMembers = signups.filter(s => s.status === 'attending');

      if (attendingMembers.length === 0) {
        console.log(`⚠️ Sự kiện #${event.id} (${event.title}) đến giờ nhưng không có ai đăng ký.`);
        return;
      }

      // Cấu hình quyền riêng tư cho Voice Channel
      const permissionOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: ['ViewChannel', 'Connect'],
        },
        {
          id: client.user.id,
          allow: ['ViewChannel', 'Connect', 'Speak', 'ManageChannels'],
        }
      ];

      for (const memberSignup of attendingMembers) {
        permissionOverwrites.push({
          id: memberSignup.user_id,
          allow: ['ViewChannel', 'Connect', 'Speak'],
        });
      }

      // Tạo Voice Channel riêng cho sự kiện
      const roomName = `⚔️│${event.title}`.toLowerCase().replace(/\s+/g, '-');
      const createdChannel = await guild.channels.create({
        name: roomName,
        type: 2,
        permissionOverwrites: permissionOverwrites,
      });

      createdChannelId = createdChannel.id;
      managedEventRooms.add(createdChannel.id);
      console.log(`🏰 Đã tự động tạo phòng thoại cho sự kiện #${event.id}: ${createdChannel.name}`);

      // Thông báo chung trong phòng thoại
      try {
        const mentions = attendingMembers.map(m => `<@${m.user_id}>`).join(' ');
        await createdChannel.send(
          `🚨 **ĐÃ ĐẾN GIỜ SỰ KIỆN: [${event.title}]!**\n` +
          `Mời các chiến hữu nhanh chóng ổn định vị trí, chuẩn bị xuất phát:\n${mentions}\n` +
          `*(Hệ thống đã tự động gửi Build chuẩn riêng qua tin nhắn trực tiếp - DM cho từng người)*`
        );
      } catch (err) {
        console.error('Không thể gửi thông báo trong voice channel.');
      }

      // Quét kho Moderator để gửi đúng Build riêng theo ID / Vũ khí qua DM
      const modChannel = await guild.channels.fetch(MODERATOR_CHANNEL_ID).catch(() => null);
      let modMessages = [];
      if (modChannel) {
        const fetched = await modChannel.messages.fetch({ limit: 100 }).catch(() => null);
        if (fetched) modMessages = Array.from(fetched.values());
      }

      for (const memberSignup of attendingMembers) {
        try {
          const userKey = `${event.id}_${memberSignup.user_id}`;
          if (sentBuildUsers.has(userKey)) continue;

          const member = await guild.members.fetch(memberSignup.user_id).catch(() => null);
          if (!member) continue;

          const userRole = (memberSignup.role || '').trim().toLowerCase();
          const userWeapon = (memberSignup.job || '').trim().toLowerCase();

          let bestMatchUrl = null;

          // Thuật toán tìm kiếm theo ID / Tên vũ khí chính xác 100%
          for (const msg of modMessages) {
            const content = (msg.content || '').toLowerCase();
            const embedDesc = msg.embeds.length > 0 ? (msg.embeds[0].description || '').toLowerCase() : '';
            const embedTitle = msg.embeds.length > 0 ? (msg.embeds[0].title || '').toLowerCase() : '';
            const fullText = `${content} \n ${embedDesc} \n ${embedTitle}`;

            const hasImage = msg.attachments.size > 0 || (msg.embeds.length > 0 && msg.embeds[0].image);
            if (!hasImage) continue;

            if (userWeapon && fullText.includes(userWeapon)) {
              if (msg.attachments.size > 0) {
                bestMatchUrl = msg.attachments.first().url;
              } else if (msg.embeds.length > 0 && msg.embeds[0].image) {
                bestMatchUrl = msg.embeds[0].image.url;
              }
              break;
            }
          }

          // Dự phòng theo Role nếu chưa chọn vũ khí cụ thể
          if (!bestMatchUrl && userRole) {
            for (const msg of modMessages) {
              const fullText = `${msg.content || ''} ${msg.embeds[0]?.description || ''}`.toLowerCase();
              const hasImage = msg.attachments.size > 0 || (msg.embeds.length > 0 && msg.embeds[0].image);
              if (hasImage && fullText.includes(userRole)) {
                bestMatchUrl = msg.attachments.size > 0 ? msg.attachments.first().url : msg.embeds[0].image.url;
                break;
              }
            }
          }

          const channelMention = createdChannelId ? `<#${createdChannelId}>` : 'Phòng thoại sự kiện';
          const dmPayload = {
            content: `🚨 **ĐÃ ĐẾN GIỜ SỰ KIỆN: [${event.title}]!**\n` +
                     `Role của bạn: **${memberSignup.role || 'Chưa rõ'}** | Vũ khí: **${memberSignup.job || 'Chưa chọn'}**\n` +
                     `Phòng thoại riêng đã sẵn sàng: ${channelMention}\n` +
                     `Dưới đây là **Build chuẩn** dành riêng cho nhiệm vụ của bạn:`
          };

          if (bestMatchUrl) {
            dmPayload.files = [bestMatchUrl];
          }

          await member.send(dmPayload);
          sentBuildUsers.add(userKey);

          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error(`Không thể gửi DM cho user ${memberSignup.user_id}:`, err);
        }
      }

    } catch (error) {
      console.error(`Lỗi khi xử lý giờ hẹn cho sự kiện #${event.id}:`, error);
    }
  }, executionDelay);
}

client.scheduleEventRoomCreation = scheduleEventRoomCreation;

client.once('ready', async () => {
  console.log(`🤖 Bot đã sẵn sàng với tên: ${client.user.tag}`);

  try {
    const allEvents = db.getAllEvents ? db.getAllEvents() : [];
    for (const event of allEvents) {
      if (event.channel_id && event.message_id && event.start_ts) {
        trackEventForExpiration(event.channel_id, event.message_id, event.id, event.start_ts, event.guild_id);
        scheduleEventRoomCreation(client, event);
      }
    }
  } catch (err) {
    console.error('Lỗi khi nạp sự kiện:', err);
  }

  // Quét thời gian thực mỗi 10 giây để xóa bài đăng quá 15 phút
  setInterval(async () => {
    const now = Date.now();
    for (const [eventId, data] of activeEventsTracker.entries()) {
      if (now >= data.expirationTime) {
        try {
          const channel = await client.channels.fetch(data.channelId).catch(() => null);
          if (channel) {
            const message = await channel.messages.fetch(data.messageId).catch(() => null);
            if (message) {
              await message.delete().catch(() => {});
              console.log(`🗑️ [Xóa tự động] Đã xóa thành công bài đăng sự kiện #${eventId} sau 15 phút.`);
            }
          }
        } catch (err) {
          console.error(`Không thể xóa tin nhắn sự kiện #${eventId}:`, err);
        }
        activeEventsTracker.delete(eventId);
      }
    }
  }, 10 * 1000);
});

/**
 * 3. Tự động dọn dẹp phòng thoại trống sau 10 giây
 */
client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (newChannelId && managedEventRooms.has(newChannelId)) {
      if (emptyRoomTimeouts.has(newChannelId)) {
        clearTimeout(emptyRoomTimeouts.get(newChannelId));
        emptyRoomTimeouts.delete(newChannelId);
      }
    }

    if (oldChannelId && managedEventRooms.has(oldChannelId)) {
      const channel = oldState.channel;
      if (channel && channel.members.size === 0) {
        if (!emptyRoomTimeouts.has(oldChannelId)) {
          const timeoutId = setTimeout(async () => {
            try {
              const currentChannel = await channel.guild.channels.fetch(oldChannelId).catch(() => null);
              if (currentChannel && currentChannel.members.size === 0) {
                await currentChannel.delete();
                managedEventRooms.delete(oldChannelId);
                console.log(`🧹 Đã dọn dẹp phòng thoại trống: ${currentChannel.name}`);
              }
            } catch (err) {
              console.error('Lỗi khi xóa phòng trống:', err);
            }
            emptyRoomTimeouts.delete(oldChannelId);
          }, 10 * 1000);

          emptyRoomTimeouts.set(oldChannelId, timeoutId);
        }
      }
    }
  } catch (error) {
    console.error('Lỗi xử lý voiceStateUpdate:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      const parts = customId.split('_');
      const action = parts[0]; 
      const eventId = Number(parts[parts.length - 1]);

      if (isNaN(eventId)) return;

      const event = db.getEvent(eventId);
      if (!event) {
        return interaction.reply({ content: '❌ Không tìm thấy sự kiện này!', ephemeral: true });
      }

      await interaction.deferUpdate();

      const userId = interaction.user.id;
      const username = interaction.user.displayName || interaction.user.username;
      let activeRoleForMenu = null;

      if (['tank', 'dps', 'healer', 'support'].includes(action)) {
        const roleName = action.toUpperCase();
        db.upsertSignup(eventId, userId, username, { role: roleName, status: 'attending' });
        activeRoleForMenu
