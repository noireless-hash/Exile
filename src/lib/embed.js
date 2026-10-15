const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { discordTime, googleCalendarLink } = require('./time');

const WEAPON_EMOJIS = {
  'Heavy Mace': '🛡️',
  'Incubus Mace': '🦇',
  'Great Hammer': '⚓',
  'Enigmatic Staff': '🛡️',
  'Fire Staff': '🔥',
  'Frost Staff': '❄️',
  'Bow': '🏹',
  'Crossbow': '⚡',
  'Melee DPS': '🗡️',
  'Holy Healer': '🌿',
  'Nature Healer': '🍃',
  'Fallen Staff': '✨',
  'Arcane Support': '📯',
  'Utility Support': '🕯️'
};

function buildWeaponSelectMenu(eventId, role) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`weapon_${role ? role.toLowerCase() : 'none'}_${eventId}`);

  const roleUpper = role ? role.toUpperCase() : null;

  if (roleUpper === 'TANK') {
    selectMenu
      .setPlaceholder('🛡️ Chọn Vũ khí Tank của bạn...')
      .addOptions([
        { label: 'Heavy Mace', value: 'Heavy Mace', description: 'Mở giao tranh tổng lực', emoji: '🛡️' },
        { label: 'Incubus Mace', value: 'Incubus Mace', description: 'Giảm kháng chịu đòn', emoji: '🦇' },
        { label: 'Great Hammer', value: 'Great Hammer', description: 'Khống chế diện rộng', emoji: '⚓' },
        { label: 'Enigmatic Staff', value: 'Enigmatic Staff', description: 'Tạo giáp bảo kê', emoji: '🛡️' },
      ]);
  } else if (roleUpper === 'DPS') {
    selectMenu
      .setPlaceholder('⚔️ Chọn Vũ khí DPS của bạn...')
      .addOptions([
        { label: 'Fire Staff', value: 'Fire Staff', description: 'Sát thương diện rộng lớn', emoji: '🔥' },
        { label: 'Frost Staff', value: 'Frost Staff', description: 'Làm chậm & dồn sát thương', emoji: '❄️' },
        { label: 'Bow', value: 'Bow', description: 'Sát thương tầm xa liên tục', emoji: '🏹' },
        { label: 'Crossbow', value: 'Crossbow', description: 'Sát thương dồn cực mạnh', emoji: '⚡' },
        { label: 'Melee DPS', value: 'Melee DPS', description: 'Cận chiến cơ động / Cắt giáp', emoji: '🗡️' },
      ]);
  } else if (roleUpper === 'HEALER') {
    selectMenu
      .setPlaceholder('🌿 Chọn Vũ khí Healer của bạn...')
      .addOptions([
        { label: 'Holy Healer', value: 'Holy Healer', description: 'Hồi máu nhóm cực mạnh & cơ động', emoji: '🌿' },
        { label: 'Nature Healer', value: 'Nature Healer', description: 'Hồi máu theo thời gian (HoT)', emoji: '🍃' },
        { label: 'Fallen Staff', value: 'Fallen Staff', description: 'Hồi máu diện rộng diện tích lớn', emoji: '✨' },
      ]);
  } else if (roleUpper === 'SUPPORT') {
    selectMenu
      .setPlaceholder('⚡ Chọn Vũ khí Support của bạn...')
      .addOptions([
        { label: 'Arcane Support', value: 'Arcane Support', description: 'Buff kháng & tăng sát thương', emoji: '📯' },
        { label: 'Utility Support', value: 'Utility Support', description: 'Khống chế & hỗ trợ chiến thuật', emoji: '🕯️' },
      ]);
  } else {
    selectMenu
      .setPlaceholder('🎯 Chọn Role bên trên trước để hiện danh sách Vũ khí...')
      .addOptions([
        { label: 'Hướng dẫn', value: 'guide', description: 'Vui lòng bấm nút Tank, DPS, Healer hoặc Support ở trên', emoji: 'ℹ️' }
      ]);
  }

  return new ActionRowBuilder().addComponents(selectMenu);
}

function buildEventMessage(event, signups = [], currentRole = null) {
  const uppercaseTitle = (event.title || '').toUpperCase();
  
  // Dùng tiêu đề lớn cấp 1 của Markdown để phóng to tiêu đề
  const bigTitle = `# ⚔️ ${uppercaseTitle} ⚔️`;
  const descText = event.description ? `\n*${event.description}*` : '';

  const embed = new EmbedBuilder()
    .setColor(0xAA8833)
    .setDescription(`${bigTitle}${descText}`);

  const timeFormatted = `${discordTime(event.start_ts, 'F')} (${discordTime(event.start_ts, 'R')})`;
  embed.addFields({ name: '📅 Thời Gian', value: timeFormatted, inline: false });

  const roles = [
    { name: '🛡️ Tank', key: 'TANK' },
    { name: '⚔️ DPS', key: 'DPS' },
    { name: '🌿 Healer', key: 'HEALER' },
    { name: '⚡ Support', key: 'SUPPORT' },
  ];

  for (const r of roles) {
    const list = signups.filter(s => s.role === r.key && s.status === 'attending');
    const valueStr = list.length > 0 
      ? list.map(s => {
          const weaponEmoji = s.job && WEAPON_EMOJIS[s.job] ? `${WEAPON_EMOJIS[s.job]} ` : '';
          return `• **${s.username}** ${s.job ? `(${weaponEmoji}${s.job})` : ''}`;
        }).join('\n')
      : '_Trống_';
    
    embed.addFields({ name: `${r.name} (${list.length})`, value: valueStr, inline: true });
  }

  const attendingCount = signups.filter(s => s.status === 'attending').length;
  embed.addFields({ name: '👥 Tổng tham gia', value: `${attendingCount} người`, inline: false });

  const gCalUrl = googleCalendarLink({
    title: event.title,
    startTs: event.start_ts,
    durationMin: event.duration_min,
    details: event.description,
  });

  embed.addFields({ name: '🗓️ Lịch', value: `[Thêm vào Google Calendar](${gCalUrl})`, inline: false });
  embed.setFooter({ text: `Event #${event.id} • Tạo bởi ${event.creator_name || 'Admin'}` });

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
