// Danh sách vũ khí đại diện cho từng nhánh trong Albion Online (16 cây / 16 nhánh)
const JOBS = [
  // ==================== TANKS ====================
  { code: 'MACE', name: 'Mace (Mace Tree)', emoji: '🔨', group: 'Tank' },
  { code: 'HAMMER', name: 'Hammer (Hammer Tree)', emoji: '⚒️', group: 'Tank' },
  { code: 'QSTAFF', name: 'Quarterstaff (Quarterstaff Tree)', emoji: '🦯', group: 'Tank' },

  // ==================== HEALERS ====================
  { code: 'HOLY', name: 'Holy Staff (Holy Tree)', emoji: '✨', group: 'Healer' },
  { code: 'NATURE', name: 'Nature Staff (Nature Tree)', emoji: '🌿', group: 'Healer' },

  // ==================== SUPPORT ====================
  { code: 'ARCANE', name: 'Arcane Staff (Arcane Tree)', emoji: '🔮', group: 'Support' },

  // ==================== DPS (MELEE & RANGED) ====================
  { code: 'SWORD', name: 'Sword (Sword Tree)', emoji: '🗡️', group: 'DPS' },
  { code: 'AXE', name: 'Axe (Axe Tree)', emoji: '🪓', group: 'DPS' },
  { code: 'DAGGER', name: 'Dagger (Dagger Tree)', emoji: '🔪', group: 'DPS' },
  { code: 'SPEAR', name: 'Spear (Spear Tree)', emoji: '🔱', group: 'DPS' },
  { code: 'BOW', name: 'Bow (Bow Tree)', emoji: '🏹', group: 'DPS' },
  { code: 'CROSSBOW', name: 'Crossbow (Crossbow Tree)', emoji: '🎯', group: 'DPS' },
  { code: 'CURSED', name: 'Cursed Staff (Cursed Tree)', emoji: '💀', group: 'DPS' },
  { code: 'FIRE', name: 'Fire Staff (Fire Tree)', emoji: '🔥', group: 'DPS' },
  { code: 'FROST', name: 'Frost Staff (Frost Tree)', emoji: '❄️', group: 'DPS' },
  { code: 'SHAPESHIFTER', name: 'Shapeshifter (Shapeshifter Tree)', emoji: '🐾', group: 'DPS' },
];

const JOB_BY_CODE = new Map(JOBS.map((j) => [j.code, j]));

function getJobsByRole(roleGroup) {
  return JOBS.filter((j) => j.group.toLowerCase() === roleGroup.toLowerCase());
}

function jobRole(code) {
  return JOB_BY_CODE.get(code)?.group || 'unknown';
}

function jobLabel(code) {
  const job = JOB_BY_CODE.get(code);
  return job ? `${job.name} (${job.code})` : code || '???';
}

function jobEmoji(code) {
  return JOB_BY_CODE.get(code)?.emoji || '❔';
}

function jobName(code) {
  return JOB_BY_CODE.get(code)?.name || code || 'No Weapon Selected';
}

module.exports = {
  JOBS,
  JOB_BY_CODE,
  getJobsByRole,
  jobRole,
  jobLabel,
  jobEmoji,
  jobName,
};
