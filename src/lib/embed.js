const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { discordTime, googleCalendarLink } = require('./time');

function buildEventMessage(event, signups = []) {
  const embed = new EmbedBuilder()
    .setColor(0xAA8833) // Tông màu Vàng Đồng chuẩn Albion
    .setTitle(`👑 ${event.title}`);

  if (event.description) {
    embed.setDescription(event.description);
  }

  // Hiển thị thời gian trực tiếp, mượt mà chuẩn Discord Timestamp
  const timeFormatted = `${discordTime(event.start_ts, 'F')} (${discordTime(event.start_ts, 'R')})`;
  embed.addFields(
    { name: '📅 Thời Gian', value: timeFormatted, inline: false },
    { name: '🛡️ Tank', value: `${signups.filter(s => s.role === 'TANK').length}`, inline: true },
    { name: '⚔️ DPS', value: `${signups.filter(s => s.role === 'DPS').length}`, inline: true },
    { name: '🌿 Healer', value: `${signups.filter(s => s.role === 'HEALER').length}`, inline: true },
    { name: '⚡ Support', value: `${signups.filter(s => s.role === 'SUPPORT').length}`, inline: true },
    { name: '👥 Tổng tham gia', value: `${signups.filter(s => s.status === 'attending').length} người`, inline: true }
  );

  // Link Google Calendar
  const gCalUrl = googleCalendarLink({
    title: event.title,
    startTs: event.start_ts,
    durationMin: event.duration_min,
    details: event.description,
  });

  embed.addFields({ name: '🗓️ Lịch', value: `[Thêm vào Google Calendar](${gCalUrl})`, inline: false });
  embed.setFooter({ text: `Event #${event.id} • Tạo bởi ${event.creator_name || 'Admin'}` });

  // 3 Hàng Tương Tác Bấm Nút & Menu
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tank_${event.id}`).setLabel('Tank').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
    new ButtonBuilder().setCustomId(`dps_${event.id}`).setLabel('DPS').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId(`healer_${event.id}`).setLabel('Healer').setStyle(ButtonStyle.Primary).setEmoji('🌿'),
    new ButtonBuilder().setCustomId(`support_${event.id}`).setLabel('Support').setStyle(ButtonStyle.Primary).setEmoji('⚡'),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tentative_${event.id}`).setLabel('Tentative').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
    new ButtonBuilder().setCustomId(`absence_${event.id}`).setLabel('Absence').setStyle(ButtonStyle.Secondary).setEmoji('❌'),
    new ButtonBuilder().setCustomId(`withdraw_${event.id}`).setLabel('Withdraw').setStyle(ButtonStyle.Danger).setEmoji('🚪'),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`weapon_${event.id}`)
      .setPlaceholder('Chọn Vũ khí / Build của bạn...')
      .addOptions([
        { label: '🔥 Fire Staff', value: 'Fire Staff', description: 'Damage diện rộng (DPS)' },
        { label: '❄️ Frost Staff', value: 'Frost Staff', description: 'Control / Slow (DPS)' },
        { label: '🛡️ Heavy Mace', value: 'Heavy Mace', description: 'Tank mở giao tranh' },
        { label: '🌿 Holy / Nature', value: 'Healer Set', description: 'Hồi máu chính (Healer)' },
      ])
  );

  return {
    embeds: [embed],
    components: [row1, row2, row3],
  };
}

function buildCreateBoardMessage() {
  const embed = new EmbedBuilder()
    .setColor(0xAA8833)
    .setTitle('🏰 HỆ THỐNG SỰ KIỆN ALBION ONLINE')
    .setDescription('Bấm nút bên dưới để tạo nhanh sự kiện mới cho Guild!');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_create_event_modal')
      .setLabel('Tạo Sự Kiện Mới')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📅')
  );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  buildEventMessage,
  buildCreateBoardMessage,
};
