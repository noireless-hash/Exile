const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { discordTime, googleCalendarLink } = require('./time');

/**
 * Tạo danh sách vũ khí tương ứng với Role mà người dùng vừa chọn
 */
function buildWeaponSelectMenu(eventId, role) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`weapon_${role.toLowerCase()}_${eventId}`);

  if (role === 'TANK') {
    selectMenu
      .setPlaceholder('🛡️ Chọn Vũ khí Tank của bạn...')
      .addOptions([
        { label: '🛡️ Heavy Mace', value: 'Heavy Mace', description: 'Mở giao tranh tổng lực' },
        { label: '🦇 Incubus Mace', value: 'Incubus Mace', description: 'Giảm kháng chịu đòn' },
        { label: '⚓ Albion Hammer', value: 'Bridgebreaker / Great Hammer', description: 'Khống chế diện rộng' },
        { label: '🛡️ Enigmatic Staff', value: 'Enigmatic Staff', description: 'Tạo giáp bảo kê' },
      ]);
  } else if (role === 'DPS') {
    selectMenu
      .setPlaceholder('⚔️ Chọn Vũ khí DPS của bạn...')
      .addOptions([
        { label: '🔥 1H Fire / Wildfire', value: 'Fire Staff', description: 'Sơ đồ sát thương diện rộng lớn' },
        { label: '❄️ Permafrost / Great Frost', value: 'Frost Staff', description: 'Làm chậm & Dồn sát thương băng' },
        { label: '🏹 Badon / Longbow', value: 'Bow', description: 'Sát thương tầm xa liên tục' },
        { label: '⚡ Energy Shaper / Crossbow', value: 'Crossbow', description: 'Sát thương dồn cực mạnh' },
        { label: '🗡️ Bloodletter / Carving', value: 'Melee DPS', description: 'Cận chiến cơ động / Cắt giáp' },
      ]);
  } else if (role === 'HEALER') {
    selectMenu
      .setPlaceholder('🌿 Chọn Vũ khí Healer của bạn...')
      .addOptions([
        { label: '🌿 1H Holy / Hallowfall', value: 'Holy Healer', description: 'Hồi máu nhóm cực mạnh & Cơ động' },
        { label: '🍃 Great Nature / Blight Staff', value: 'Nature Healer', description: 'Hồi máu theo thời gian (HoT)' },
        { label: '✨ Fallen Staff', value: 'Fallen Staff', description: 'Hồi máu diện rộng diện tích lớn' },
      ]);
  } else if (role === 'SUPPORT') {
    selectMenu
      .setPlaceholder('⚡ Chọn Vũ khí Support của bạn...')
      .addOptions([
        { label: '📯 Arcane (Occult / Great Arcane)', value: 'Arcane Support', description: 'Buff kháng & Tăng sát thương đồng minh' },
        { label: '🕯️ Incubus / Rootbound', value: 'Utility Support', description: 'Khống chế & Hỗ trợ chiến thuật' },
      ]);
  } else {
    // Mặc định ban đầu nếu chưa chọn role cụ thể
    selectMenu
      .setPlaceholder('🎯 Chọn Role bên trên trước, sau đó chọn Vũ khí...')
      .addOptions([
        { label: 'ℹ️ Hướng dẫn', value: 'help', description: 'Vui lòng bấm nút Tank/DPS/Healer/Support trước' }
      ]);
  }

  return new ActionRowBuilder().addComponents(selectMenu);
}

function buildEventMessage(event, signups = [], currentRole = null) {
  const embed = new EmbedBuilder()
    .setColor(0xAA8833) // Vàng Đồng Albion
    .setTitle(`👑 ${event.title}`);

  if (event.description) {
    embed.setDescription(event.description);
  }

  const timeFormatted = `${discordTime(event.start_ts, 'F')} (${discordTime(event.start_ts, 'R')})`;
  embed.addFields(
    { name: '📅 Thời Gian', value: timeFormatted, inline: false },
    { name: '🛡️ Tank', value: `${signups.filter(s => s.role === 'TANK').length}`, inline: true },
    { name: '⚔️ DPS', value: `${signups.filter(s => s.role === 'DPS').length}`, inline: true },
    { name: '🌿 Healer', value: `${signups.filter(s => s.role === 'HEALER').length}`, inline: true },
    { name: '⚡ Support', value: `${signups.filter(s => s.role === 'SUPPORT').length}`, inline: true },
    { name: '👥 Tổng tham gia', value: `${signups.filter(s => s.status === 'attending').length} người`, inline: true }
  );

  const gCalUrl = googleCalendarLink({
    title: event.title,
    startTs: event.start_ts,
    durationMin: event.duration_min,
    details: event.description,
  });

  embed.addFields({ name: '🗓️ Lịch', value: `[Thêm vào Google Calendar](${gCalUrl})`, inline: false });
  embed.setFooter({ text: `Event #${event.id} • Tạo bởi ${event.creator_name || 'Admin'}` });

  // Hàng 1: Nút chọn Role
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tank_${event.id}`).setLabel('Tank').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
    new ButtonBuilder().setCustomId(`dps_${event.id}`).setLabel('DPS').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId(`healer_${event.id}`).setLabel('Healer').setStyle(ButtonStyle.Primary).setEmoji('🌿'),
    new ButtonBuilder().setCustomId(`support_${event.id}`).setLabel('Support').setStyle(ButtonStyle.Primary).setEmoji('⚡'),
  );

  // Hàng 2: Nút trạng thái phụ & Withdraw
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tentative_${event.id}`).setLabel('Tentative').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
    new ButtonBuilder().setCustomId(`absence_${event.id}`).setLabel('Absence').setStyle(ButtonStyle.Secondary).setEmoji('❌'),
    new ButtonBuilder().setCustomId(`withdraw_${event.id}`).setLabel('Withdraw').setStyle(ButtonStyle.Danger).setEmoji('🚪'),
  );

  // Hàng 3: Menu chọn vũ khí động thay đổi theo Role người dùng vừa chọn
  const row3 = buildWeaponSelectMenu(event.id, currentRole);

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
  buildWeaponSelectMenu,
};
