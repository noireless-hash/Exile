const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { parseEventTime } = require('../lib/time');
const { buildEventMessage, buildCreateBoardMessage } = require('../lib/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Quản lý sự kiện Albion Online')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Tạo một sự kiện mới trong ngày')
        .addStringOption((opt) =>
          opt.setName('title').setDescription('Tên sự kiện (VD: ZvZ Martlock / Ava Raid)').setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('time').setDescription('Giờ hẹn (VD: 20:00, 20h30, 8pm)').setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('description').setDescription('Ghi chú / Yêu cầu IP (tùy chọn)').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('board')
        .setDescription('Đăng bảng bấm nút tạo Event cố định vào kênh này'),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'board') {
      const msgData = buildCreateBoardMessage();
      await interaction.channel.send(msgData);
      return interaction.editReply({ content: '✅ Đã gửi bảng tạo Event vào kênh!' });
    }

    if (subcommand === 'create') {
      try {
        const title = interaction.options.getString('title');
        const timeStr = interaction.options.getString('time');
        const description = interaction.options.getString('description') || null;

        // Tự động truyền 'today' làm ngày mặc định
        const parsed = parseEventTime('today', timeStr, 'Asia/Ho_Chi_Minh');
        if (!parsed.valid) {
          return interaction.editReply({ content: `❌ Định dạng giờ không hợp lệ: ${parsed.error}` });
        }

        const eventId = db.createEvent({
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

        const event = db.getEvent(eventId);
        const signups = db.getSignups(eventId);
        const msgData = buildEventMessage(event, signups);

        const sent = await interaction.channel.send(msgData);
        db.updateEventMessageId(eventId, sent.id);

        return interaction.editReply({ content: `✅ Đã tạo Event **#${eventId}** thành công!` });
      } catch (err) {
        console.error('Lỗi khi tạo event:', err);
        return interaction.editReply({ content: `❌ Lỗi hệ thống: ${err.message}` });
      }
    }
  },
};
