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

const managedEventRooms = new Set();
const emptyRoomTimeouts = new Map();
const activeEventsTracker = new Map();

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
 * 2. Tự động tạo phòng thoại khi đến giờ hẹn (Đã bỏ hoàn toàn tính năng gửi build qua DM)
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

      managedEventRooms.add(createdChannel.id);
      console.log(`🏰 Đã tự động tạo phòng thoại cho sự kiện #${event.id}: ${createdChannel.name}`);

      // Thông báo chung trong phòng voice
      try {
        const mentions = attendingMembers.map(m => `<@${m.user_id}>`).join(' ');
        await createdChannel.send(
          `🚨 **ĐÃ ĐẾN GIỜ SỰ KIỆN: [${event.title}]!**\n` +
          `Mời các chiến hữu nhanh chóng ổn định vị trí, chuẩn bị xuất phát:\n${mentions}`
        );
      } catch (err) {
        console.error('Không thể gửi thông báo trong voice channel.');
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

  // BỘ QUÉT THỜI GIAN THỰC CHẠY MỖI 10 GIÂY ĐỂ XÓA SỰ KIỆN QUÁ HẠN
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

      const msgData = buildEventMessage(event, signups, activeRoleForMenu, interaction.guild);

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
