const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config');
const eventCommand = require('./commands/event');

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
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Lỗi khi thực thi lệnh:', error);
    const content = '❌ Có lỗi xảy ra khi thực hiện lệnh này!';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  }
});

client.login(config.token);
