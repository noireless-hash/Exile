const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { discordTime, googleCalendarLink } = require('./time');

/**
 * Danh mục Vũ khí chính thức theo dữ liệu ID & Role từ server Discord của bạn
 */
const WEAPONS_BY_ROLE = {
  TANK: [
    { label: 'Bedrock Mace', description: 'Bedrock Mace', emoji: '<:BedrockMace:1560804439030239233>' },
    { label: 'Dreadstorm Monarch', description: 'Dreadstorm Monarch', emoji: '<:DreadstormMonarch:1560804258985550005>' },
    { label: 'Earthrune Staff', description: 'Earthrune Staff', emoji: '<:EarthruneStaff:1560782564321665054>' },
    { label: 'Forcepulse Bracers', description: 'Forcepulse Bracers', emoji: '<:ForcepulseBracers:1560784181649346580>' },
    { label: 'Forge Hammers', description: 'Forge Hammers', emoji: '<:ForgeHammers:1560804214610067456>' },
    { label: 'Great Arcane Staff', description: 'Great Arcane Staff', emoji: '<:GreatArcaneStaff:1560782040457027705>' },
    { label: 'Hand of Justice', description: 'Hand of Justice', emoji: '<:HandofJustice:1560804317026451517>' },
    { label: 'Heavy Mace', description: 'Heavy Mace', emoji: '<:HeavyMace:1560804414275719289>' },
    { label: 'Polehammer', description: 'Polehammer', emoji: '<:Polehammer:1560795012835577948>' },
    { label: 'Primal Staff', description: 'Primal Staff', emoji: '<:PrimalStaff:1560782485481201734>' },
    { label: 'Truebolt Hammer', description: 'Truebolt Hammer', emoji: '<:TrueboltHammer:1560804387452887040>' },
  ],
  HEALER: [
    { label: 'Blight Staff', description: 'Blight Staff', emoji: '<:BlightStaff:1560782614602711110>' },
    { label: 'Fallen Staff', description: 'Fallen Staff', emoji: '<:FallenStaff:1560781876828839956>' },
    { label: 'Forgebark Staff', description: 'Forgebark Staff', emoji: '<:ForgebarkStaff:1560782665924481034>' },
    { label: 'Hallowfall', description: 'Hallowfall', emoji: '<:Hallowfall:1560781939982475346>' },
    { label: 'Rampant Staff', description: 'Rampant Staff', emoji: '<:RampantStaff:1560782640238567505>' },
    { label: 'Redemption Staff', description: 'Redemption Staff', emoji: '<:RedemptionStaff:1560781907568889967>' },
  ],
  SUPPORT: [
    { label: 'Arcane Staff', description: 'Arcane Staff', emoji: '<:ArcaneStaff:1560781976380641411>' },
    { label: 'Enigmatic Staff', description: 'Enigmatic Staff', emoji: '<:EnigmaticStaff:1560782004742660106>' },
    { label: 'Lifecurse Staff', description: 'Lifecurse Staff', emoji: '<:LifecurseStaff:1560782202529390692>' },
    { label: 'Oathkeepers', description: 'Oathkeepers', emoji: '<:Oathkeepers:1560804473381847112>' },
    { label: 'Rootbound Staff', description: 'Rootbound Staff', emoji: '<:RootboundStaff:1560782458457165834>' },
    { label: 'Rotcaller Staff', description: 'Rotcaller Staff', emoji: '<:RotcallerStaff:1560782174700183632>' },
  ],
  DPS: [
    { label: 'Arclight Blasters', description: 'Arclight Blasters', emoji: '<:ArclightBlasters:1560782694584025088>' },
    { label: 'Arctic Staff', description: 'Arctic Staff', emoji: '<:ArcticStaff:1560782143028731968>' },
    { label: 'Astral Staff', description: 'Astral Staff', emoji: '<:AstralStaff:1560782073847881790>' },
    { label: 'Bloodmoon Staff', description: 'Bloodmoon Staff', emoji: '<:BloodmoonStaff:1560782513327312958>' },
    { label: 'Bow of Badon', description: 'Bow of Badon', emoji: '<:BowofBadon:1560782257776623678>' },
    { label: 'Carrioncaller', description: 'Carrioncaller', emoji: '<:Carrioncaller:1560804522484301824>' },
    { label: 'Crystal Reaper', description: 'Crystal Reaper', emoji: '<:CrystalReaper:1560804582517645442>' },
    { label: 'Dawnsong', description: 'Dawnsong', emoji: '<:Dawnsong:1560781806742016020>' },
    { label: 'Daybreaker', description: 'Daybreaker', emoji: '<:Daybreaker:1560782408188694669>' },
    { label: 'Fists of Avalon', description: 'Fists of Avalon', emoji: '<:FistsofAvalon:1560784156034732132>' },
    { label: 'Halberd', description: 'Halberd', emoji: '<:Halberd:1560804499197657209>' },
    { label: 'Hellspawn Staff', description: 'Hellspawn Staff', emoji: '<:HellspawnStaff:1560782540573384794>' },
    { label: 'Heron Spear', description: 'Heron Spear', emoji: '<:HeronSpear:1560782343449608202>' },
    { label: 'Infernal Staff', description: 'Infernal Staff', emoji: '<:InfernalStaff:1560781838035853422>' },
    { label: 'Infinity Blade', description: 'Infinity Blade', emoji: '<:InfinityBlade:1560804640944169031>' },
    { label: 'Kingmaker', description: 'Kingmaker', emoji: '<:Kingmaker:1560804607494590604>' },
    { label: 'Lightcaller', description: 'Lightcaller', emoji: '<:Lightcaller:1560782589864968272>' },
    { label: 'Longbow', description: 'Longbow', emoji: '<:Longbow:1560782230035366059>' },
    { label: 'Mistpiercer', description: 'Mistpiercer', emoji: '<:Mistpiercer:1560782377704235099>' },
    { label: 'Permafrost Prism', description: 'Permafrost Prism', emoji: '<:PermafrostPrism:1560782111517048973>' },
    { label: 'Phantom Twinblade', description: 'Phantom Twinblade', emoji: '<:PhantomTwinblade:1560782431047393402>' },
    { label: 'Realmbreaker', description: 'Realmbreaker', emoji: '<:Realmbreaker:1560804559176339456>' },
    { label: 'Spiked Gauntlets', description: 'Spiked Gauntlets', emoji: '<:SpikedGauntlets:1560784098681684089>' },
    { label: 'Twin Slayers', description: 'Twin Slayers', emoji: '<:TwinSlayers:1560782313460080770>' },
    { label: 'Ursine Maulers', description: 'Ursine Maulers', emoji: '<:UrsineMaulers:1560784130600468570>' },
  ]
};

/**
 * 1. Tạo Menu Chọn Vũ Khí (Select Menu) phân loại theo Role
 */
function buildWeaponSelectMenu(eventId, role) {
  const roleUpper = role ? role.toUpperCase() : null;
  const roleClean = roleUpper ? roleUpper.toLowerCase() : 'none';

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`weapon_${roleClean}_${eventId}`);

  if (roleUpper && WEAPONS_BY_ROLE[roleUpper]) {
    // Discord giới hạn tối đa 25 tùy chọn trong 1 StringSelectMenu
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
          description: 'Bấm nút Tank, DPS, Healer hoặc Support để hiện danh sách vũ khí', 
          emoji: 'ℹ️' 
        }
      ]);
  }

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * 2. Tạo Bảng Thông Báo Sự Kiện (Embed + Buttons + Select Menu)
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
          // Tìm emoji tương ứng với vũ khí đã chọn của thành viên
          let weaponEmojiStr = '';
          if (s.job && WEAPONS_BY_ROLE[r.key]) {
            const foundWeapon = WEAPONS_BY_ROLE[r.key].find(w => w.label.toLowerCase() === s.job.toLowerCase());
            if (foundWeapon) weaponEmojiStr = `${foundWeapon.emoji} `;
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

  // Nút bấm phân vị trí Role
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tank_${event.id}`).setLabel('Tank').setStyle(ButtonStyle.Primary).setEmoji('🛡️'),
    new ButtonBuilder().setCustomId(`dps_${event.id}`).setLabel('DPS').setStyle(ButtonStyle.Primary).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId(`healer_${event.id}`).setLabel('Healer').setStyle(ButtonStyle.Primary).setEmoji('🌿'),
    new ButtonBuilder().setCustomId(`support_${event.id}`).setLabel('Support').setStyle(ButtonStyle.Primary).setEmoji('⚡'),
  );

  // Nút bấm trạng thái tham gia
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
