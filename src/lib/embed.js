const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { discordTime, googleCalendarLink } = require('./time');

// Bản đồ tra cứu Custom Emoji chuẩn từ server Discord của bạn
const WEAPON_EMOJIS = {
  'Dreadstorm Monarch': '<:EldersDreadstormMonarch:1560414109680541797>',
  'Heavy Mace': '<:EldersHeavyMace:1560414517995901138>',
  'Crystal Reaper': '<:EldersCrystalReaper:1560415626898571385>',
  'Hallowfall': '<:EldersHallowfall:1560415652945072220>',
  'Blight Staff': '<:EldersBlightStaff:1560415698780684448>',
  'Lightcaller': '<:EldersLightcaller:1560415730787160194>',
  'Hellspawn Staff': '<:EldersHellspawnStaff:1560415780372480100>',
  'Permafrost Prism': '<:EldersPermafrostPrism:1560415806825959604>',
  'Astral Staff': '<:EldersAstralStaff:1560415832331264010>',
  'Rootbound Staff': '<:EldersRootboundStaff:1560415947653648555>'
};

function buildWeaponSelectMenu(eventId, role) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`weapon_${role ? role.toLowerCase() : 'none'}_${eventId}`);

  const roleUpper = role ? role.toUpperCase() : null;

  if (roleUpper === 'TANK') {
    selectMenu
      .setPlaceholder('🛡️ Chọn Vũ khí Tank của bạn...')
      .addOptions([
        { label: 'Heavy Mace', value: 'Heavy Mace', description: 'Mở giao tranh tổng lực & câm lặng', emoji: WEAPON_EMOJIS['Heavy Mace'] },
      ]);
  } else if (roleUpper === 'DPS') {
    selectMenu
      .setPlaceholder('⚔️ Chọn Vũ khí DPS của bạn...')
      .addOptions([
        { label: 'Dreadstorm Monarch', value: 'Dreadstorm Monarch', description: 'DPS Bruiser cận chiến ZvZ cực mạnh', emoji: WEAPON_EMOJIS['Dreadstorm Monarch'] },
        { label: 'Crystal Reaper', value: 'Crystal Reaper', description: 'Sát thương diện rộng chí mạng', emoji: WEAPON_EMOJIS['Crystal Reaper'] },
        { label: 'Lightcaller', value: 'Lightcaller', description: 'Cấu rỉa tầm xa', emoji: WEAPON_EMOJIS['Lightcaller'] },
        { label: 'Hellspawn Staff', value: 'Hellspawn Staff', description: 'Sát thương lửa cực mạnh', emoji: WEAPON_EMOJIS['Hellspawn Staff'] },
        { label: 'Permafrost Prism', value: 'Permafrost Prism', description: 'Đóng băng & dồn sát thương', emoji: WEAPON_EMOJIS['Permafrost Prism'] },
        { label: 'Astral Staff', value: 'Astral Staff', description: 'Sát thương phép thuật diện rộng', emoji: WEAPON_EMOJIS['Astral Staff'] },
      ]);
  } else if (roleUpper === 'HEALER') {
    selectMenu
      .setPlaceholder('🌿 Chọn Vũ khí Healer của bạn...')
      .addOptions([
        { label: 'Hallowfall', value: 'Hallowfall', description: 'Hồi máu nhóm cơ động cao', emoji: WEAPON_EMOJIS['Hallowfall'] },
        { label: 'Blight Staff', value: 'Blight Staff', description: 'Hồi máu theo thời gian (HoT)', emoji: WEAPON_EMOJIS['Blight Staff'] },
      ]);
  } else if (roleUpper === 'SUPPORT') {
    selectMenu
      .setPlaceholder('⚡ Chọn Vũ khí Support của bạn...')
      .addOptions([
        { label: 'Rootbound Staff', value: 'Rootbound Staff', description: 'Khống chế diện rộng', emoji: WEAPON_EMOJIS['Rootbound Staff'] },
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
