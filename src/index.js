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
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      const parts = customId.split('_');
      const action = parts[0]; // tank, dps, healer, support, weapon, withdraw, v.v.
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
        activeRoleForMenu = roleName; // Hiển thị menu vũ khí tương ứng với role vừa chọn
      } else if (action === 'withdraw') {
        db.removeSignup(eventId, userId);
      } else if (action === 'tentative') {
        db.upsertSignup(eventId, userId, username, { status: 'tentative' });
      } else if (action === 'absence') {
        db.upsertSignup(eventId, userId, username, { status: 'absence' });
      } else if (action === 'weapon') {
        // Xử lý khi chọn loại vũ khí từ Menu động (VD: weapon_tank_1)
        const roleType = parts[1] ? parts[1].toUpperCase() : null;
        const selectedWeapon = interaction.values[0];
        
        // Cập nhật job vũ khí vào database cho user
        db.upsertSignup(eventId, userId, username, { job: selectedWeapon });
        activeRoleForMenu = roleType;
      }

      // Lấy danh sách đăng ký mới và cập nhật lại giao diện tin nhắn
      const signups = db.getSignups(eventId);
      
      // Nếu user hiện tại đã có role trong database, gán role đó để menu hiển thị đúng loại vũ khí của họ
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
