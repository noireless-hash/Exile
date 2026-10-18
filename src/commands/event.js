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
        .setDescription('Tạo một sự kiện mới trong ngày (SMC, ZvZ, Gank...)')
        .addStringOption((opt) =>
          opt.setName('title').setDescription('Tên sự kiện (VD: ZvZ Martlock / SMC OP+GANK)').setRequired(true)
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
        .setName('farm_camp_group')
        .setDescription('Tạo nhanh sự kiện FARM CAMP GROUP với các slot Core ghim sẵn')
        .addStringOption((opt) =>
          opt.setName('time').setDescription('Giờ hẹn (VD: 20:00, 20h30, 8pm)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('description').setDescription('Yêu cầu Min IP / Gear Tier (Mặc định: Min 1400 IP)').setRequired(false)
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

    // 1. XỬ LÝ ĐĂNG BẢNG TẠO EVENT CỐ ĐỊNH
    if (subcommand === 'board') {
      try {
        const msgData = buildCreateBoardMessage();
        await interaction.channel.send(msgData);
        return interaction.editReply({ content: '✅ Đã gửi bảng tạo Event vào kênh!' });
      } catch (err) {
        return interaction.editReply({ content: '❌ Không thể gửi bảng tạo Event!' });
      }
    }

    // 2. XỬ LÝ TẠO EVENT CHUNG HOẶC EVENT FARM CAMP GROUP
    if (subcommand === 'create' || subcommand === 'farm_camp_group') {
      const userId = interaction.user.id;

      if (creationLocks.has(userId)) {
        return interaction.editReply({ content: '⚠️ Đang xử lý yêu cầu tạo Event, vui lòng chờ trong giây lát...' });
      }

      creationLocks.add(userId);

      try {
        // Kiểm tra điều kiện Event trước đó có đủ 4 người hay chưa
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

        // Đặt tiêu đề và ghi chú tùy theo subcommand
        let title = '';
        let description = null;

        if (subcommand === 'farm_camp_group') {
          title = 'FARM CAMP GROUP';
          description = interaction.options.getString('description') || 'Min 1400 IP - Chuẩn bị đầy đủ food/potion!';
        } else {
          title = interaction.options.getString('title');
          description = interaction.options.getString('description') || null;
        }

        const timeStr = interaction.options.getString('time');

        const parsed = parseEventTime('today', timeStr, 'Asia/Ho_Chi_Minh');
        if (!parsed.valid) {
          creationLocks.delete(userId);
          return interaction.editReply({ content: `❌ Định dạng giờ không hợp lệ: ${parsed.error}` });
        }

        const createdEvent = db.createEvent({
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

        const eventId = createdEvent.id;
        const signups = (typeof db.getSignups === 'function' ? db.getSignups(eventId) : []) || [];

        const msgData = buildEventMessage(createdEvent, signups, null);

        const sent = await interaction.channel.send(msgData);
        if (typeof db.setEventMessage === 'function') {
          db.setEventMessage(eventId, sent.id);
        }
        createdEvent.message_id = sent.id;

        if (typeof interaction.client.scheduleEventRoomCreation === 'function') {
          interaction.client.scheduleEventRoomCreation(interaction.client, createdEvent);
        }

        creationLocks.delete(userId);
        return interaction.editReply({ content: `✅ Đã tạo Sự kiện **${title} #${eventId}** thành công!` });

      } catch (err) {
        creationLocks.delete(userId);
        console.error('Lỗi khi tạo event:', err);
        return interaction.editReply({ content: `❌ Lỗi hệ thống: \`${err.message}\`` }).catch(() => {});
      }
    }
  },
};
