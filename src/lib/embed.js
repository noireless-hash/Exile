const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { discordTime, googleCalendarLink } = require('./time');
const BUILDS_DATA = require('../data/builds');

/**
 * Tự động tạo bảng WEAPONS_BY_ROLE trực tiếp từ file data/builds.js
 */
const WEAPONS_BY_ROLE = { TANK: [], HEALER: [], SUPPORT: [], DPS: [] };

for (const [weaponName, data] of Object.entries(BUILDS_DATA)) {
  const cleanEmojiName = weaponName.replace(/[^a-zA-Z0-9]/g, '');
  if (WEAPONS_BY_ROLE[data.role]) {
    WEAPONS_BY_ROLE[data.role].push({
      label: weaponName,
      description: weaponName,
      emoji: `<:${cleanEmojiName}:${data.emojiId}>`,
    });
  }
}

/**
 * Tạo Menu Chọn Vũ Khí (Select Menu) phân loại theo Role
 */
function buildWeaponSelectMenu(eventId, role) {
  const roleUpper = role ? role.toUpperCase() : null;
  const roleClean = roleUpper ? roleUpper.toLowerCase() : 'none';

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`weapon_${roleClean}_${eventId}`);

  if (roleUpper && WEAPONS_BY_ROLE[roleUpper]) {
    // Discord giới hạn tối đa 25 tùy chọn trong 1 Select Menu
    const weaponsList = WEAPONS_BY_ROLE[roleUpper].slice(0, 25);

    selectMenu
      .setPlaceholder(`🎯 Chọn Vũ khí ${roleUpper} của bạn...`)
      .addOptions(weaponsList.map(w => ({
        label: w.label,
        value: w.label,
        description: w.description,
        emoji: w.emoji
      })));
  } else {
    selectMenu
      .setPlaceholder('🎯 Vui lòng chọn Role (Tank/DPS/Healer/Support) ở trên trước...')
      .addOptions([
        { 
          label: 'Hướng dẫn', 
          value: 'guide', 
          description: 'Bấm nút Tank, DPS, Healer hoặc Support để chọn danh sách vũ khí', 
          emoji: 'ℹ️' 
        }
      ]);
  }

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Tạo Bảng Thông Báo Sự Kiện (Embed + Buttons + Select Menu)
 */
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
          let weaponEmojiStr = '';
          if (s.job && BUILDS_DATA[s.job]) {
            const cleanEmojiName = s.job.replace(/[^a-zA-Z0-9]/g, '');
            weaponEmojiStr = `<:${cleanEmojiName}:${BUILDS_DATA[s.job].emojiId}> `;
          }
          return `• **${s.username}** ${s.job ? `(${weaponEmojiStr}${s.job})` : ''}`;
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

  // Nút bấm chọn Role
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tank_${event.id}`).setLabel('Tank').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
    new ButtonBuilder().setCustomId(`dps_${event.id}`).setLabel('DPS').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId(`healer_${event.id}`).setLabel('Healer').setStyle(ButtonStyle.Primary).setEmoji('🌿'),
    new ButtonBuilder().setCustomId(`support_${event.id}`).setLabel('Support').setStyle(ButtonStyle.Primary).setEmoji('⚡'),
  );

  // Nút bấm chọn Trạng Thái
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tentative_${event.id}`).setLabel('Tentative').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
    new ButtonBuilder().setCustomId(`absence_${event.id}`).setLabel('Absence').setStyle(ButtonStyle.Secondary).setEmoji('❌'),
    new ButtonBuilder().setCustomId(`withdraw_${event.id}`).setLabel('Withdraw').setStyle(ButtonStyle.Danger).setEmoji('🚪'),
  );

  // Select Menu chọn Vũ khí
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
