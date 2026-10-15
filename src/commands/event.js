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
        // 1. Kiểm tra điều kiện sự kiện trước đó (Phải có tối thiểu 4 người tham gia)
        const previousEvent = db.getLatestEvent ? db.getLatestEvent() : null;
        if (previousEvent) {
          const previousSignups = db.getSignups(previousEvent.id);
          const attendingCount = previousSignups.filter(s => s.status === 'attending').length;

          if (attendingCount < 4) {
            return interaction.editReply({
              content: `❌ **Không thể tạo sự kiện mới!** Sự kiện trước đó (**#${previousEvent.id} - ${previousEvent.title}**) chỉ có **${attendingCount}/4** người tham gia tối thiểu. Cần đảm bảo đủ lực lượng hoặc xử lý sự kiện cũ trước để tránh thiếu người!`,
            });
          }
        }

        const title = interaction.options.getString('title');
        const timeStr = interaction.options.getString('time');
        const description = interaction.options.getString('description') || null;

        // Tự động truyền 'today' làm ngày mặc định
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

        const eventId = event.id;
        const signups = db.getSignups(eventId);
        const msgData = buildEventMessage(event, signups);

        const sent = await interaction.channel.send(msgData);
        db.setEventMessage(eventId, sent.id);

        // 2. Kích hoạt tự động hẹn giờ xóa tin nhắn sau 15 phút tính từ giờ hẹn bắt đầu (start_ts)
        if (typeof interaction.client.scheduleEventExpiration === 'function') {
          interaction.client.scheduleEventExpiration(interaction.channel, sent.id, eventId, event.start_ts);
        }

        return interaction.editReply({ content: `✅ Đã tạo Event **#${eventId}** thành công!` });
      } catch (err) {
        console.error('Lỗi khi tạo event:', err);
        return interaction.editReply({ content: `❌ Lỗi hệ thống: ${err.message}` });
      }
    }
  },
};
