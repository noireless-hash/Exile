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
    GatewayIntentBits.GuildVoiceStates, // Bắt buộc để theo dõi voice channel
  ],
  // Tự động dọn dẹp message cũ trong RAM định kỳ để tiết kiệm tài nguyên VPS
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

// Cấu hình ID kênh lưu trữ build từ kho moderator-only của bạn
const MODERATOR_CHANNEL_ID = '1352408303371812865';

// Quản lý danh sách phòng, bộ đếm dọn dẹp và chống spam DM
const managedEventRooms = new Set();
const emptyRoomTimeouts = new Map();
const sentBuildUsers = new Set(); // Chống spam gửi lặp build cho user

/**
 * 1. Tự động xóa tin nhắn sự kiện sau thời gian diễn ra + 15 phút
 * @param {boolean} isStartup - true nếu gọi lúc bot khởi động lại (để dọn dẹp rác cũ), false nếu vừa tạo event mới
 */
function scheduleEventExpiration(channel, messageId, eventId, startTimestamp, isStartup = false) {
  const now = Date.now();
  const expirationTime = startTimestamp + (15 * 60 * 1000); // Giờ hẹn + 15 phút
  const delay = expirationTime - now;

  // CHỈ NẾU LÀ LÚC BOT KHỞI ĐỘNG LẠI VÀ ĐÃ QUÁ THỜI GIAN -> Mới xóa ngay lập tức
  if (isStartup && delay <= 0) {
    (async () => {
      try {
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (message) {
          await message.delete();
          console.log(`🗑️ [Xóa ngay lúc khởi động] Đã xóa tin nhắn sự kiện quá hạn #${eventId}.`);
        }
      } catch (error) {
        console.error(`Không thể xóa tin nhắn sự kiện quá hạn #${eventId}:`, error);
      }
    })();
    return;
  }

  // NẾU VỪA MỚI TẠO MÀ DELAY <= 0 -> Không tự ý xóa nhầm, bỏ qua
  if (delay <= 0) {
    return;
  }

  // Hẹn giờ xóa bình thường khi đến đúng mốc (Giờ hẹn + 15 phút)
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
 * 2. Tự động tạo phòng thoại khi đến giờ hẹn, phân quyền và gửi build riêng thông minh cho từng thành viên
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
        type: 2, // Voice Channel
        permissionOverwrites: permissionOverwrites,
      });

      managedEventRooms.add(createdChannel.id);
      console.log(`🏰 Đã tự động tạo phòng thoại cho sự kiện #${event.id}: ${createdChannel.name}`);

      // Thông báo chung ngắn gọn trong phòng mới tạo
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

      // --- QUÉT KÊNH MODERATOR-ONLY ĐỂ GỬI BUILD RIÊNG CHO TỪNG THÀNH VIÊN ---
      const modChannel = await guild.channels.fetch(MODERATOR_CHANNEL_ID).catch(() => null);
      let modMessages = [];
      if (modChannel) {
        modMessages = (await modChannel.messages.fetch({ limit: 50 })).values();
      }

      for (const memberSignup of attendingMembers) {
        try {
          // KIỂM TRA CHỐNG SPAM: Nếu đã gửi build cho user này rồi thì bỏ qua
          if (sentBuildUsers.has(memberSignup.user_id)) {
            continue;
          }

          const member = await guild.members.fetch(memberSignup.user_id).catch(() => null);
          if (!member) continue;

          const userRole = (memberSignup.role || '').trim().toLowerCase();
          const userWeapon = (memberSignup.job || '').trim().toLowerCase();
          const eventTitle = (event.title || '').trim().toLowerCase();

          let bestMatchUrl = null;
          let highestScore = -1;

          // Thuật toán chấm điểm thông minh tìm ảnh build chuẩn
          for (const msg of modMessages) {
            let score = 0;
            const content = (msg.content || '').toLowerCase();
            const embedDesc = msg.embeds.length > 0 ? (msg.embeds[0].description || '').toLowerCase() : '';
            const embedTitle = msg.embeds.length > 0 ? (msg.embeds[0].title || '').toLowerCase() : '';
            const fullText = `${content} \n ${embedDesc} \n ${embedTitle}`;

            const hasImage = msg.attachments.size > 0 || (msg.embeds.length > 0 && msg.embeds[0].image);
            if (!hasImage) continue;

            // Khớp chính xác tên vũ khí/job (Điểm cao nhất)
            if (userWeapon && fullText.includes(userWeapon)) {
              score += 10;
            }
            // Khớp loại Role (Tank, Healer, DPS, Support)
            if (userRole && fullText.includes(userRole)) {
              score += 5;
            }
            // Khớp từ khóa tên sự kiện
            if (eventTitle) {
              const titleKeywords = eventTitle.split(' ');
              for (const keyword of titleKeywords) {
                if (keyword.length > 2 && fullText.includes(keyword)) {
                  score += 3;
                }
              }
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

          // Dự phòng nếu không khớp điểm: lấy ảnh build mới nhất
          if (!bestMatchUrl && modMessages.length > 0) {
            const fallbackMsg = Array.from(modMessages).find(msg => msg.attachments.size > 0 || msg.embeds.some(e => e.image));
            if (fallbackMsg) {
              bestMatchUrl = fallbackMsg.attachments.size > 0 ? fallbackMsg.attachments.first().url : fallbackMsg.embeds[0].image.url;
            }
          }

          // Soạn nội dung DM gửi cho user
          const dmPayload = {
            content: `🚨 **ĐÃ ĐẾN GIỜ SỰ KIỆN: [${event.title}]!**\n` +
                     `Role của bạn: **${memberSignup.role || 'Chưa rõ'}** | Vũ khí: **${memberSignup.job || 'Chưa chọn'}**\n` +
                     `Phòng thoại riêng đã sẵn sàng: <#${createdChannel.id}>\n` +
                     `Dưới đây là **Build chuẩn** dành riêng cho nhiệm vụ của bạn:`
          };

          if (bestMatchUrl) {
            dmPayload.files = [bestMatchUrl];
          }

          await member.send(dmPayload);

          // Đánh dấu đã gửi thành công để chống spam trong 24 giờ
          sentBuildUsers.add(memberSignup.user_id);
          setTimeout(() => {
            sentBuildUsers.delete(memberSignup.user_id);
          }, 24 * 60 * 60 * 1000);

          // Nghỉ nhẹ 0.5 giây giữa mỗi lần gửi DM để tránh bị Discord giới hạn (Rate Limit)
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (err) {
          console.error(`Không thể gửi DM cho user ${memberSignup.user_id} (có thể họ chặn tin nhắn riêng).`);
        }
      }

    } catch (error) {
      console.error(`Lỗi khi xử lý giờ hẹn cho sự kiện #${event.id}:`, error);
    }
  }, delay);
}

// Gắn hàm vào client để gọi từ bên ngoài
client.scheduleEventExpiration = scheduleEventExpiration;
client.scheduleEventRoomCreation = scheduleEventRoomCreation;

client.once('ready', async () => {
  console.log(`🤖 Bot đã sẵn sàng với tên: ${client.user.tag}`);

  // Khôi phục lịch hẹn khi bot khởi động lại (Truyền true để quét dọn dẹp các event cũ quá hạn)
  try {
    const allEvents = db.getAllEvents ? db.getAllEvents() : [];
    for (const event of allEvents) {
      if (event.channel_id && event.message_id && event.start_ts) {
        const channel = await client.channels.fetch(event.channel_id).catch(() => null);
        if (channel) {
          scheduleEventExpiration(channel, event.message_id, event.id, event.start_ts, true);
          scheduleEventRoomCreation(client, event);
        }
      }
    }
  } catch (err) {
    console.error('Lỗi khi khôi phục lịch hẹn sự kiện:', err);
  }
});

/**
 * 3. Tự động dọn dẹp phòng thoại thông minh (Thời gian chờ 10 phút cho người vào trễ)
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
          }, 10 * 60 * 1000); // 10 phút chờ người vào trễ

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
