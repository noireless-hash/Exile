const { Client, GatewayIntentBits, Collection, Options, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('./config');
const eventCommand = require('./commands/event');
const db = require('./db');
const { buildEventMessage } = require('./lib/embed');
const { parseEventTime } = require('./lib/time');
const BUILDS_DATA = require('./data/builds');

// ID Kênh Moderator chứa các bài đăng Build chuẩn
const MODERATOR_CHANNEL_ID = '1352408303371812868';
const sentBuildUsers = new Set();

// ==========================================
// 0. BẮT LỖI TOÀN CỤC CHỐNG SẬP BOT
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
 * 1. QUÉT HỆ THỐNG XÓA BÀI ĐĂNG SỰ KIỆN HẾT HẠN (GIỜ HẸN + 15 PHÚT)
 */
async function cleanupExpiredEvents() {
  try {
    if (typeof db.getAllEvents !== 'function') return;

    const allEvents = db.getAllEvents() || [];
    const nowMs = Date.now();

    for (const event of allEvents) {
      if (!event.channel_id || !event.message_id || !event.start_ts) continue;

      // Chuẩn hóa Unix timestamp (giây) sang miligiây
      const startMs = Number(event.start_ts) < 10000000000 ? Number(event.start_ts) * 1000 : Number(event.start_ts);
      const expireMs = startMs + (15 * 60 * 1000); // Giờ hẹn + 15 phút

      // Đã quá thời hạn 15 phút
      if (nowMs >= expireMs) {
        try {
          const channel = await client.channels.fetch(event.channel_id).catch(() => null);
          if (channel) {
            const message = await channel.messages.fetch(event.message_id).catch(() => null);
            if (message) {
              await message.delete().catch(err => console.error(`Lỗi xóa tin nhắn Event #${event.id}:`, err.message));
              console.log(`🗑️ [Xóa tự động] Đã xóa bài đăng Event #${event.id} (${event.title})`);
            }
          }
        } catch (fetchErr) {
          console.error(`Không thể xóa bài đăng Event #${event.id}:`, fetchErr.message);
        }

        // Xóa Event khỏi SQLite CSDL để không quét lại lần sau
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
 * 2. TỰ ĐỘNG TẠO PHÒNG VOICE & GỬI DM BUILD THEO MESSAGE ID CHÍNH XÁC
 */
function scheduleEventRoomCreation(client, event) {
  const now = Date.now();
  const startMs = Number(event.start_ts) < 10000000000 ? Number(event.start_ts) * 1000 : Number(event.start_ts);
  const delay = startMs - now;

  // Nếu sự kiện đã quá 15 phút thì bỏ qua không tạo voice
  if (delay < -15 * 60 * 1000) return;

  setTimeout(async () => {
    try {
      const guild = await client.guilds.fetch(event.guild_id).catch(() => null);
      if (!guild) return;

      const signups = db.getSignups(event.id);
      const attendingMembers = signups.filter(s => s.status === 'attending');

      if (attendingMembers.length === 0) {
        console.log(`⚠️ Sự kiện #${event.id} (${event.title}) đến giờ nhưng không có ai tham gia.`);
        return;
      }

      // Phân quyền cho phòng thoại riêng
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

      // Nhắc nhở người tham gia trong voice
      try {
        const mentions = attendingMembers.map(m => `<@${m.user_id}>`).join(' ');
        await createdChannel.send(
          `🚨 **ĐÃ ĐẾN GIỜ SỰ KIỆN: [${event.title}]!**\n` +
          `Mời các chiến hữu nhanh chóng tập trung:\n${mentions}\n` +
          `*(Ảnh Build chuẩn đã được tự động gửi qua DM cho từng người)*`
        );
      } catch (err) {}

      const modChannel = await guild.channels.fetch(MODERATOR_CHANNEL_ID).catch(() => null);

      // Gửi DM Build riêng cho từng người tham gia
      for (const memberSignup of attendingMembers) {
        try {
          const userKey = `${event.id}_${memberSignup.user_id}`;
          if (sentBuildUsers.has(userKey)) continue;

          const member = await guild.members.fetch(memberSignup.user_id).catch(() => null);
          if (!member) continue;

          const userWeapon = memberSignup.job;
          let attachments = [];

          // Tìm Message ID chính xác của Build từ data/builds.js
          if (userWeapon && BUILDS_DATA[userWeapon] && modChannel) {
            const targetMessageId = BUILDS_DATA[userWeapon].messageId;
            const buildMessage = await modChannel.messages.fetch(targetMessageId).catch(() => null);

            if (buildMessage && buildMessage.attachments.size > 0) {
              attachments = Array.from(buildMessage.attachments.values()).map(a => a.url);
            }
          }

          const dmPayload = {
            content: `🚨 **ĐÃ ĐẾN GIỜ SỰ KIỆN: [${event.title}]!**\n` +
                     `• Role: **${memberSignup.role || 'Chưa chọn'}**\n` +
                     `• Vũ khí: **${memberSignup.job || 'Chưa chọn'}**\n` +
                     `• Phòng voice đã mở: <#${createdChannel.id}>\n` +
                     `Dưới đây là **Build chuẩn** dành cho bạn:`
          };

          if (attachments.length > 0) {
            dmPayload.files = attachments;
          }

          await member.send(dmPayload);
          sentBuildUsers.add(userKey);

          // Tạm dừng 0.5s để tránh dính Rate Limit DM từ Discord
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error(`Không thể gửi DM cho user ${memberSignup.user_id}:`, err.message);
        }
      }

    } catch (error) {
      console.error(`Lỗi khi xử lý sự kiện #${event.id}:`, error);
    }
  }, Math.max(0, delay));
}

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
    console.error('Lỗi khi nạp danh sách sự kiện:', err);
  }

  // Quét dọn dẹp ngay khi bật bot và mỗi 10 giây
  cleanupExpiredEvents();
  setInterval(cleanupExpiredEvents, 10 * 1000);
});

/**
 * 3. TỰ ĐỘNG XÓA PHÒNG VOICE TRỐNG SAU 10 GIÂY
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
 * 4. XỬ LÝ TƯƠNG TÁC NÚT BẤM, MODAL SUBMIT & MENU CHỌN VŨ KHÍ
 */
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    // Xử lý nút bấm mở Modal Form Farm Camp
    if (interaction.isButton() && interaction.customId === 'open_farm_camp_modal') {
      const modal = new ModalBuilder()
        .setCustomId('submit_farm_camp_modal')
        .setTitle('🏕️ TẠO SỰ KIỆN FARM CAMP GROUP');

      const timeInput = new TextInputBuilder()
        .setCustomId('farm_time')
        .setLabel('Giờ hẹn (Ví dụ: 20:00, 20h30, 8pm)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Nhập giờ hẹn...')
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('farm_desc')
        .setLabel('Yêu cầu Min IP / Gear')
        .setStyle(TextInputStyle.Paragraph)
        .setValue('Min 1400 IP - Chuẩn bị đầy đủ food/potion!')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(timeInput),
        new ActionRowBuilder().addComponents(descInput)
      );

      await interaction.showModal(modal);
      return;
    }

    // Xử lý khi người dùng ấn "Gửi" từ Form Modal Farm Camp
    if (interaction.isModalSubmit() && interaction.customId === 'submit_farm_camp_modal') {
      await interaction.deferReply({ ephemeral: true });

      const timeStr = interaction.fields.getTextInputValue('farm_time');
      const description = interaction.fields.getTextInputValue('farm_desc') || 'Min 1400 IP - Chuẩn bị đầy đủ food/potion!';
      const title = 'FARM CAMP GROUP';

      const parsed = parseEventTime('today', timeStr, 'Asia/Ho_Chi_Minh');
      if (!parsed.valid) {
        return interaction.editReply({ content: `❌ Định dạng giờ không hợp lệ: ${parsed.error}` });
      }

      const event = db.createEvent({
        guild_id: interaction.guildId,
        channel_id: interaction.channelId,
        creator_id: interaction.user.id,
        creator_name: interaction.user.displayName || interaction.user.username,
        title,
        description,
        start_ts: parsed.startTs,
        timezone: 'Asia/Ho_Chi_Minh',
        leader: interaction.user.displayName || interaction.user.username,
      });

      const signups = db.getSignups(event.id) || [];
      const msgData = buildEventMessage(event, signups, null);

      const sent = await interaction.channel.send(msgData);
      db.setEventMessage(event.id, sent.id);
      event.message_id = sent.id;

      client.scheduleEventRoomCreation(client, event);

      return interaction.editReply({ content: `✅ Đã tạo sự kiện **FARM CAMP GROUP #${event.id}** thành công!` });
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
        
        // NẾU ĐỔI ROLE: Reset lại vũ khí (job = null) để không bị dính vũ khí cũ
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
