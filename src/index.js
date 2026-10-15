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

client.once('ready', () => {
  console.log(`🤖 Bot đã sẵn sàng với tên: ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  try {
    // 1. Xử lý Slash Commands (VD: /event create)
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    // 2. Xử lý Button / Select Menu tương tác trong Event
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      // Xử lý nút bấm tạo event nhanh từ bảng board (nếu có)
      if (customId === 'ev_create_modal') {
        // Nếu bot của bạn có dùng modal tạo event nhanh qua nút bấm
        return;
      }

      // Các nút bấm tương tác sự kiện (VD: signup role, withdraw, v.v.)
      // Tách customId theo định dạng (ví dụ: action_eventId)
      const parts = customId.split('_');
      const action = parts[0];
      const eventId = Number(parts[parts.length - 1]);

      if (!isNaN(eventId)) {
        const event = db.getEvent(eventId);
        if (!event) {
          return interaction.reply({ content: '❌ Không tìm thấy sự kiện này!', ephemeral: true });
        }

        // Phản hồi tạm thời để tránh lỗi timeout 3 giây của Discord
        await interaction.deferUpdate();

        const userId = interaction.user.id;
        const username = interaction.user.displayName || interaction.user.username;

        // Xử lý các action tương ứng với nút bấm hoặc menu
        if (['tank', 'dps', 'healer', 'support'].includes(action)) {
          db.upsertSignup(eventId, userId, username, { role: action.toUpperCase(), status: 'attending' });
        } else if (action === 'withdraw') {
          db.removeSignup(eventId, userId);
        } else if (action === 'tentative') {
          db.upsertSignup(eventId, userId, username, { status: 'tentative' });
        } else if (action === 'absence') {
          db.upsertSignup(eventId, userId, username, { status: 'absence' });
        } else if (interaction.isStringSelectMenu() && action === 'weapon') {
          // Xử lý khi chọn vũ khí từ Select Menu
          const selectedWeapon = interaction.values[0];
          db.upsertSignup(eventId, userId, username, { job: selectedWeapon });
        }

        // Cập nhật lại giao diện tin nhắn Event
        const signups = db.getSignups(eventId);
        const msgData = buildEventMessage(event, signups);

        if (interaction.message) {
          await interaction.message.edit(msgData);
        }
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
