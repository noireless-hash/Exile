const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config');
const eventCommand = require('./commands/event');
const db = require('./db');
const { buildEventMessage } = require('./lib/embed');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates, // Bắt buộc để theo dõi voice channel
  ],
});

client.commands = new Collection();
client.commands.set(eventCommand.data.name, eventCommand);

// Quản lý danh sách phòng và bộ đếm chờ dọn dẹp
const managedEventRooms = new Set();
const emptyRoomTimeouts = new Map();

/**
 * 1. Tự động xóa tin nhắn sự kiện sau thời gian diễn ra + 15 phút
 */
function scheduleEventExpiration(channel, messageId, eventId, startTimestamp) {
  const now = Date.now();
  const expirationTime = startTimestamp + (15 * 60 * 1000);
  const delay = expirationTime - now;

  if (delay <= 0) return;

  setTimeout(async () => {
    try {
      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (message) {
        await message.delete();
        console.log(`🗑️ Đã tự động xóa sự kiện #${eventId} sau 15 phút kể từ giờ hẹn.`);
      }
    } catch (error) {
      console.error(`Không thể tự động xóa tin nhắn sự kiện #${eventId}:`, error);
    }
  }, delay);
}

/**
 * 2. Tự động tạo phòng thoại khi đến giờ hẹn, phân quyền và ping gọi thành viên bên trong
 */
function scheduleEventRoomCreation(client, event) {
  const now = Date.now();
  const delay = event.start_ts - now;

  if (delay <= 0) return;

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

      // Cấu hình quyền riêng tư
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
        type: 2, // Voice Channel
        permissionOverwrites: permissionOverwrites,
      });

      managedEventRooms.add(createdChannel.id);
      console.log(`🏰 Đã tự động tạo phòng thoại cho sự kiện #${event.id}: ${createdChannel.name}`);

      // Ping gọi tên thành viên fill role trực tiếp bên trong phòng thoại mới
      try {
        const mentions = attendingMembers.map(m => `<@${m.user_id}>`).join(' ');
        await createdChannel.send(
          `🚨 **ĐÃ ĐẾN GIỜ SỰ KIỆN: [${event.title}]!**\n` +
          `Mời các chiến hữu nhanh chóng ổn định vị trí, chuẩn bị xuất phát:\n${mentions}`
        );
      } catch (err) {
        console.error('Không thể gửi tin nhắn ping trong voice channel, chuyển về kênh gốc.');
        const originalChannel = await guild.channels.fetch(event.channel_id).catch(() => null);
        if (originalChannel) {
          const mentions = attendingMembers.map(m => `<@${m.user_id}>`).join(' ');
          await originalChannel.send(`🚨 **[${event.title}] Đã đến giờ!** Phòng riêng: <#${createdChannel.id}>\n${mentions}`);
        }
      }
    } catch (error) {
      console.error(`Lỗi khi tự động tạo phòng cho sự kiện #${event.id}:`, error);
    }
  }, delay);
}

// Gắn hàm vào client để gọi từ bên ngoài
client.scheduleEventExpiration = scheduleEventExpiration;
client.scheduleEventRoomCreation = scheduleEventRoomCreation;

client.once('ready', async () => {
  console.log(`🤖 Bot đã sẵn sàng với tên: ${client.user.tag}`);

  // Khôi phục lịch hẹn khi bot khởi động lại
  try {
    const allEvents = db.getAllEvents ? db.getAllEvents() : [];
    for (const event of allEvents) {
      if (event.channel_id && event.message_id && event.start_ts) {
        const channel = await client.channels.fetch(event.channel_id).catch(() => null);
        if (channel) {
          scheduleEventExpiration(channel, event.message_id, event.id, event.start_ts);
          scheduleEventRoomCreation(client, event);
        }
      }
    }
  } catch (err) {
    console.error('Lỗi khi khôi phục lịch hẹn sự kiện:', err);
  }
});

/**
 * 3. Tự động dọn dẹp phòng thoại thông minh (Có 5 phút chờ người vào trễ)
 */
client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    // Khi có người bước vào phòng -> Hủy lịch hẹn xóa (nếu có) vì đã có người vào trễ
    if (newChannelId && managedEventRooms.has(newChannelId)) {
      if (emptyRoomTimeouts.has(newChannelId)) {
        clearTimeout(emptyRoomTimeouts.get(newChannelId));
        emptyRoomTimeouts.delete(newChannelId);
      }
    }

    // Khi có người rời phòng và phòng trở nên trống trơn
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
          }, 5 * 60 * 1000); // Chờ 5 phút cho người vào trễ

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
