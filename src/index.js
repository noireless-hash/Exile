const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config');
const eventCommand = require('./commands/event');
const db = require('./db');
const { buildEventMessage } = require('./lib/embed');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.commands = new Collection();
client.commands.set(eventCommand.data.name, eventCommand);

/**
 * Hàm thiết lập tự động xóa tin nhắn sự kiện sau thời gian diễn ra + 15 phút
 * @param {import('discord.js').TextChannel} channel 
 * @param {string} messageId 
 * @param {number} eventId 
 * @param {number} startTimestamp - Thời gian bắt đầu sự kiện (dạng timestamp mili-giây)
 */
function scheduleEventExpiration(channel, messageId, eventId, startTimestamp) {
  const now = Date.now();
  // Thời điểm xóa = Thời gian bắt đầu sự kiện + 15 phút (15 * 60 * 1000 ms)
  const expirationTime = startTimestamp + (15 * 60 * 1000);
  const delay = expirationTime - now;

  // Nếu thời gian hết hạn đã qua rồi thì không hẹn giờ nữa
  if (delay <= 0) return;

  setTimeout(async () => {
    try {
      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (message) {
        await message.delete();
        console.log(`🗑️ Đã tự động xóa sự kiện #${eventId} sau 15 phút kể từ giờ hẹn.`);
      }
    } catch (error) {
      console.error(`Không thể tự động xóa sự kiện #${eventId}:`, error);
    }
  }, delay);
}

// Gắn vào client để gọi từ các file khác
client.scheduleEventExpiration = scheduleEventExpiration;

client.once('ready', async () => {
  console.log(`🤖 Bot đã sẵn sàng với tên: ${client.user.tag}`);

  // (Tùy chọn thông minh) Khi bot vừa khởi động lại, nó sẽ quét các sự kiện chưa xóa 
  // trong Database để tiếp tục hẹn giờ xóa chính xác dù bot có bị sập nguồn/restart!
  try {
    const allEvents = db.getAllEvents ? db.getAllEvents() : [];
    for (const event of allEvents) {
      if (event.channel_id && event.message_id && event.start_ts) {
        const channel = await client.channels.fetch(event.channel_id).catch(() => null);
        if (channel) {
          scheduleEventExpiration(channel, event.message_id, event.id, event.start_ts);
        }
      }
    }
  } catch (err) {
    console.error('Lỗi khi khôi phục lịch hẹn xóa sự kiện:', err);
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
