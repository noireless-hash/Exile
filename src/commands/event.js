const { SlashCommandBuilder } = require('discord.js');
const db = require('../db');
const { parseEventTime } = require('../lib/time');
const { buildEventMessage, buildCreateBoardMessage } = require('../lib/embed');

const creationLocks = new Set();

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
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }
    } catch (e) {
      console.error('Không thể deferReply:', e);
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'board') {
      try {
        const msgData = buildCreateBoardMessage();
        await interaction.channel.send(msgData);
        return interaction.editReply({ content: '✅ Đã gửi bảng tạo Event vào kênh!' });
      } catch (err) {
        return interaction.editReply({ content: '❌ Không thể gửi bảng tạo Event!' });
      }
    }

    if (subcommand === 'create') {
      const userId = interaction.user.id;

      if (creationLocks.has(userId)) {
        return interaction.editReply({ content: '⚠️ Đang xử lý yêu cầu tạo Event, vui lòng chờ trong giây lát...' });
      }

      creationLocks.add(userId);

      try {
        if (typeof db.getLatestEvent === 'function') {
          const previousEvent = db.getLatestEvent();
          if (previousEvent) {
            const previousSignups = (typeof db.getSignups === 'function' ? db.getSignups(previousEvent.id) : []) || [];
            const attendingCount = previousSignups.filter(s => s.status === 'attending').length;

            if (attendingCount < 4) {
              creationLocks.delete(userId);
              return interaction.editReply({
                content: `❌ **Không thể tạo sự kiện mới!** Sự kiện trước đó (**#${previousEvent.id} -${previousEvent.title}**) chỉ có **${attendingCount}/4** người tham gia tối thiểu.`,
              });
            }
          }
        }

        const title = interaction.options.getString('title');
        const timeStr = interaction.options.getString('time');
        const description = interaction.options.getString('description') || null;

        const parsed = parseEventTime('today', timeStr, 'Asia/Ho_Chi_Minh');
        if (!parsed.valid) {
          creationLocks.delete(userId);
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
        const signups = (typeof db.getSignups === 'function' ? db.getSignups(eventId) : []) || [];

        // Soạn giao diện đơn giản - không cần truyền tham số guild
        const msgData = buildEventMessage(event, signups, null);

        const sent = await interaction.channel.send(msgData);
        if (typeof db.setEventMessage === 'function') {
          db.setEventMessage(eventId, sent.id);
        }
        event.message_id = sent.id;

        if (typeof interaction.client.trackEventForExpiration === 'function') {
          interaction.client.trackEventForExpiration(interaction.channel.id, sent.id, eventId, event.start_ts, interaction.guildId);
        }

        if (typeof interaction.client.scheduleEventRoomCreation === 'function') {
          interaction.client.scheduleEventRoomCreation(interaction.client, event);
        }

        creationLocks.delete(userId);
        return interaction.editReply({ content: `✅ Đã tạo Event **#${eventId}** thành công!` });

      } catch (err) {
        creationLocks.delete(userId);
        console.error('Lỗi khi tạo event:', err);
        return interaction.editReply({ content: `❌ Lỗi hệ thống: \`${err.message}\`` }).catch(() => {});
      }
    }
  },
};
