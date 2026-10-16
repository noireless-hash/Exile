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
          opt.setName('title').setDescription('Tên sự kiện (VD: ZvZ Martlock / Ava Raid)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('time').setDescription('Giờ hẹn (VD: 20:00, 20h30, 8pm)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('description').setDescription('Ghi chú / Yêu cầu IP (Không bắt buộc)').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('board')
        .setDescription('Đăng bảng bấm nút tạo Event cố định vào kênh này')
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
        const previousEvent = db.getLatestEvent ? db.getLatestEvent() : null;
        if (previousEvent) {
          const previousSignups = db.getSignups(previousEvent.id);
          const attendingCount = previousSignups.filter(s => s.status === 'attending').length;

          if (attendingCount < 4) {
            return interaction.editReply({
              content: `❌ **Không thể tạo sự kiện mới!** Sự kiện trước đó (**#${previousEvent.id} - ${previousEvent.title}**) chỉ có **${attendingCount}/4** người tham gia tối thiểu.`,
            });
          }
        }

        const title = interaction.options.getString('title');
        const timeStr = interaction.options.getString('time');
        const description = interaction.options.getString('description') || null;

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
        event.message_id = sent.id;

        // Đăng ký theo dõi thời gian thực để xóa sau 15 phút
        if (typeof interaction.client.trackEventForExpiration === 'function') {
          interaction.client.trackEventForExpiration(interaction.channel.id, sent.id, eventId, event.start_ts, interaction.guildId);
        }

        if (typeof interaction.client.scheduleEventRoomCreation === 'function') {
          interaction.client.scheduleEventRoomCreation(interaction.client, event);
        }

        return interaction.editReply({ content: `✅ Đã tạo Event **#${eventId}** thành công!` });

      } catch (err) {
        console.error('Lỗi khi tạo event:', err);
        return interaction.editReply({ content: `❌ Lỗi hệ thống: ${err.message}` });
      }
    }
  },
};
