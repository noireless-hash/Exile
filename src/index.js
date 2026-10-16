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
const sentBuildUsers = new Set();

/**
 * 1. QUÉT THỜI GIAN THỰC (REAL-TIME CLEANUP): Kiểm tra liên tục mỗi 30 giây
 * Nếu thời gian thực tế > (Giờ sự kiện bắt đầu + 15 phút) -> Tự động xóa bài đăng!
 */
async function cleanupExpiredEventsRealtime(client) {
  try {
    const allEvents = db.getAllEvents ? db.getAllEvents() : [];
    const now = Date.now();

    for (const event of allEvents) {
      if (!event.channel_id || !event.message_id || !event.start_ts) continue;

      // Quy đổi start_ts sang chuẩn ms
      const millis = event.start_ts < 10000000000 ? event.start_ts * 1000 : event.start_ts;
      const expirationTime = millis + (15 * 60 * 1000); // Giờ hẹn thực tế + 15 phút

      // SO SÁNH THỜI GIAN THỰC
      if (now >= expirationTime) {
        const channel = await client.channels.fetch(event.channel_id).catch(() => null);
        if (channel) {
          const message = await channel.messages.fetch(event.message_id).catch(() => null);
          if (message) {
            await message.delete().catch(() => {});
            console.log(`🗑️ [Thời gian thực] Đã tự động xóa bài đăng sự kiện #${event.id} (${event.title}) do quá mốc 15 phút!`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Lỗi khi thực thi bộ quét thời gian thực:', err);
  }
}

/**
 * 2. Tự động tạo phòng thoại khi đến giờ hẹn và gửi đúng build riêng cho từng thành viên
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

      // Tạo Voice Channel
      const roomName = `⚔️│${event.title}`.toLowerCase().replace(/\s+/g, '-');
      const createdChannel = await guild.channels.create({
        name: roomName,
        type: 2,
        permissionOverwrites: permissionOverwrites,
      });

      createdChannelId = createdChannel.id;
      managedEventRooms.add(createdChannel.id);
      console.log(`🏰 Đã tự động tạo phòng thoại cho sự kiện #${event.id}: ${createdChannel.name}`);

      // Thông báo chung trong phòng voice
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

      // --- QUÉT KÊNH MODERATOR-ONLY ĐỂ TÌM VÀ GỬI ĐÚNG BUILD RIÊNG CHO TỪNG THÀNH VIÊN ---
      const modChannel = await guild.channels.fetch(MODERATOR_CHANNEL_ID).catch(() => null);
      let modMessages = [];
      if (modChannel) {
        const fetched = await modChannel.messages.fetch({ limit: 50 }).catch(() => null);
        if (fetched) modMessages = Array.from(fetched.values());
      }

      for (const memberSignup of attendingMembers) {
        try {
          const userKey = `${event.id}_${memberSignup.user_id}`;
          if (sentBuildUsers.has(userKey)) {
            continue;
          }

          const member = await guild.members.fetch(memberSignup.user_id).catch(() => null);
          if (!member) continue;

          const userRole = (memberSignup.role || '').trim().toLowerCase();
          const userWeapon = (memberSignup.job || '').trim().toLowerCase();

          let bestMatchUrl = null;
          let highestScore = -1;

          // THUẬT TOÁN TÌM RIÊNG ẢNH CHO TỪNG USER DỰA TRÊN VŨ KHÍ/ROLE ĐĂNG KÝ
          for (const msg of modMessages) {
            let score = 0;
            const content = (msg.content || '').toLowerCase();
            const embedDesc = msg.embeds.length > 0 ? (msg.embeds[0].description || '').toLowerCase() : '';
            const embedTitle = msg.embeds.length > 0 ? (msg.embeds[0].title || '').toLowerCase() : '';
            const fullText = `${content} \n ${embedDesc} \n ${embedTitle}`;

            const hasImage = msg.attachments.size > 0 || (msg.embeds.length > 0 && msg.embeds[0].image);
            if (!hasImage) continue;

            if (userWeapon && fullText.includes(userWeapon)) {
              score += 20;
            }
            if (userRole && fullText.includes(userRole)) {
              score += 5;
            }

            if (score > highestScore) {
              highestScore = score;
              if (msg.attachments.size > 0) {
                bestMatchUrl = msg.attachments.first().url;
              } else if (msg.embeds.length > 0 && msg.embeds[0].image) {
                bestMatchUrl = msg.embeds[0].image.url;
              }
            }
          }

          if (!bestMatchUrl && modMessages.length > 0) {
            const fallbackMsg = modMessages.find(msg => msg.attachments.size > 0 || msg.embeds.some(e => e.image));
            if (fallbackMsg) {
              bestMatchUrl = fallbackMsg.attachments.size > 0 ? fallbackMsg.attachments.first().url : fallbackMsg.embeds[0].image.url;
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

  // 1. Chạy kiểm tra xóa bài viết quá hạn lập tức khi bot mở
  await cleanupExpiredEventsRealtime(client);

  // 2. Kích hoạt bộ quét tự động chạy liên tục mỗi 30 giây theo thời gian thực
  setInterval(() => {
    cleanupExpiredEventsRealtime(client);
  }, 30 * 1000);

  // 3. Khôi phục hẹn giờ tạo room voice
  try {
    const allEvents = db.getAllEvents ? db.getAllEvents() : [];
    for (const event of allEvents) {
      if (event.channel_id && event.message_id && event.start_ts) {
        scheduleEventRoomCreation(client, event);
      }
    }
  } catch (err) {
    console.error('Lỗi khi khôi phục lịch hẹn sự kiện:', err);
  }
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
        activeRoleForMenu = roleName; 
      } else if (action === 'withdraw') {
        db.removeSignup(eventId, userId);
      } else if (action === 'tentative') {
        db.upsertSignup(eventId, userId, username, { status: 'tentative' });
      } else if (action === 'absence') {
        db.upsertSignup(eventId, userId, username, { status: 'absence' });
      } else if (action === 'weapon') {
        const roleType = parts[1] ? parts[1].toUpperCase() : null;
        const selectedWeapon = interaction.values[0];
        
        db.upsertSignup(eventId, userId, username, { job: selectedWeapon });
        activeRoleForMenu = roleType;
      }

      const signups = db.getSignups(eventId);
      
      const userSignup = db.getSignup(eventId, userId);
      if (userSignup && userSignup.role) {
        activeRoleForMenu = userSignup.role;
      }

      const msgData = buildEventMessage(event, signups, activeRoleForMenu);

      if (interaction.message) {
        await interaction.message.edit(msgData);
      }
    }
  } catch (error) {
    console.error('Lỗi khi xử lý tương tác:', error);
    const content = '❌ Có lỗi xảy ra khi thực hiện tương tác này!';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content, ephemeral: true }).catch(() => {});
    }
  }
});

client.login(config.token);
