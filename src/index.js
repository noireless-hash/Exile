const { Client, GatewayIntentBits, Collection, Options } = require('discord.js');
const config = require('./config');
const eventCommand = require('./commands/event');
const db = require('./db');
const { buildEventMessage } = require('./lib/embed');

// ==========================================
// 0. BẮT LỖI TOÀN CỤC CHỐNG SẬP BOT (CRASH)
// ==========================================
process.on('unhandledRejection', error => console.error('Lỗi Promise chưa được bắt:', error));
process.on('uncaughtException', error => console.error('Lỗi Exception chưa được bắt:', error));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: { interval: 3600, lifetime: 1800 },
  },
});

client.commands = new Collection();
client.commands.set(eventCommand.data.name, eventCommand);

const managedEventRooms = new Set();
const emptyRoomTimeouts = new Map();

/**
 * 1. QUÉT HỆ THỐNG XÓA BÀI ĐĂNG HẾT HẠN (GIỜ HẸN + 15 PHÚT)
 */
async function cleanupExpiredEvents() {
  try {
    const allEvents = db.getAllEvents ? db.getAllEvents() : [];
    const nowMs = Date.now();

    for (const event of allEvents) {
      if (!event.channel_id || !event.message_id || !event.start_ts) continue;

      // Chuẩn hóa timestamp về Miligiây
      const startMs = event.start_ts < 10000000000 ? event.start_ts * 1000 : event.start_ts;
      const expireMs = startMs + (15 * 60 * 1000); // Giờ hẹn + 15 phút

      // Nếu đã quá 15 phút so với giờ hẹn
      if (nowMs >= expireMs) {
        try {
          const channel = await client.channels.fetch(event.channel_id).catch(() => null);
          if (channel) {
            const message = await channel.messages.fetch(event.message_id).catch(() => null);
            if (message) {
              await message.delete().catch(() => {});
              console.log(`🗑️ [Xóa tự động] Đã xóa bài đăng Event #${event.id} (${event.title}) sau 15 phút.`);
            }
          }
        } catch (err) {
          console.error(`Không thể xóa tin nhắn Event #${event.id}:`, err.message);
        }

        // Xóa hoặc đánh dấu trong DB nếu cần
        if (typeof db.deleteEvent === 'function') {
          db.deleteEvent(event.id);
        }
      }
    }
  } catch (err) {
    console.error('Lỗi khi quét dọn dẹp Event:', err);
  }
}

/**
 * 2. TỰ ĐỘNG TẠO PHÒNG VOICE KHI ĐẾN GIỜ HẸN
 */
function scheduleEventRoomCreation(client, event) {
  const now = Date.now();
  const startMs = event.start_ts < 10000000000 ? event.start_ts * 1000 : event.start_ts;
  const delay = startMs - now;

  // Nếu quá 15 phút rồi thì bỏ qua không tạo voice
  if (delay < -15 * 60 * 1000) return;

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

      const permissionOverwrites = [
        { id: guild.roles.everyone.id, deny: ['ViewChannel', 'Connect'] },
        { id: client.user.id, allow: ['ViewChannel', 'Connect', 'Speak', 'ManageChannels'] }
      ];

      for (const memberSignup of attendingMembers) {
        permissionOverwrites.push({
          id: memberSignup.user_id,
          allow: ['ViewChannel', 'Connect', 'Speak'],
        });
      }

      const roomName = `⚔️│${event.title}`.toLowerCase().replace(/\s+/g, '-');
      const createdChannel = await guild.channels.create({
        name: roomName,
        type: 2,
        permissionOverwrites: permissionOverwrites,
      });

      managedEventRooms.add(createdChannel.id);
      console.log(`🏰 Đã tự động tạo phòng thoại cho sự kiện #${event.id}: ${createdChannel.name}`);

      try {
        const mentions = attendingMembers.map(m => `<@${m.user_id}>`).join(' ');
        await createdChannel.send(
          `🚨 **ĐÃ ĐẾN GIỜ SỰ KIỆN: [${event.title}]!**\n` +
          `Mời các chiến hữu nhanh chóng ổn định vị trí, chuẩn bị xuất phát:\n${mentions}`
        );
      } catch (err) {}

    } catch (error) {
      console.error(`Lỗi khi tạo voice cho sự kiện #${event.id}:`, error);
    }
  }, Math.max(0, delay));
}

// Khai báo lại để gọi từ các file command nếu cần
client.scheduleEventRoomCreation = scheduleEventRoomCreation;
client.trackEventForExpiration = () => {}; 

client.once('ready', async () => {
  console.log(`🤖 Bot đã sẵn sàng với tên: ${client.user.tag}`);

  try {
    const allEvents = db.getAllEvents ? db.getAllEvents() : [];
    for (const event of allEvents) {
      if (event.channel_id && event.message_id && event.start_ts) {
        scheduleEventRoomCreation(client, event);
      }
    }
  } catch (err) {
    console.error('Lỗi khi nạp sự kiện:', err);
  }

  // Chạy kiểm tra xóa bài đăng quá hạn ngay khi bật bot và mỗi 10 giây
  cleanupExpiredEvents();
  setInterval(cleanupExpiredEvents, 10 * 1000);
});

/**
 * 3. TỰ ĐỘNG DỌN DẸP PHÒNG TRỐNG SAU 10 GIÂY
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
            } catch (err) {}
            emptyRoomTimeouts.delete(oldChannelId);
          }, 10 * 1000);

          emptyRoomTimeouts.set(oldChannelId, timeoutId);
        }
      }
    }
  } catch (error) {}
});

/**
 * 4. XỬ LÝ TƯƠNG TÁC NÚT BẤM & MENU CHỌN VŨ KHÍ
 */
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
        
        const currentSignup = db.getSignup(eventId, userId);
        if (currentSignup && currentSignup.role !== roleName) {
          db.upsertSignup(eventId, userId, username, { role: roleName, job: null, status: 'attending' });
        } else {
          db.upsertSignup(eventId, userId, username, { role: roleName, status: 'attending' });
        }
        
        activeRoleForMenu = roleName; 
      } else if (action === 'withdraw') {
        db.removeSignup(eventId, userId);
      } else if (action === 'tentative') {
        db.upsertSignup(eventId, userId, username, { status: 'tentative', job: null });
      } else if (action === 'absence') {
        db.upsertSignup(eventId, userId, username, { status: 'absence', job: null });
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
  }
});

client.login(config.token);
