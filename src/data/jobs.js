// Khai báo danh sách FFXI Jobs
const JOBS = [
  // Tank
  { code: 'PLD', name: 'Paladin', emoji: '🛡️', group: 'Tank' },
  { code: 'NIN', name: 'Ninja', emoji: '🥷', group: 'Tank' },

  // DPS
  { code: 'WAR', name: 'Warrior', emoji: '🪓', group: 'DPS' },
  { code: 'MNK', name: 'Monk', emoji: '👊', group: 'DPS' },
  { code: 'BLM', name: 'Black Mage', emoji: '🔥', group: 'DPS' },
  { code: 'DRK', name: 'Dark Knight', emoji: '🌑', group: 'DPS' },
  { code: 'BST', name: 'Beastmaster', emoji: '🐺', group: 'DPS' },
  { code: 'RNG', name: 'Ranger', emoji: '🏹', group: 'DPS' },
  { code: 'SAM', name: 'Samurai', emoji: '🗡️', group: 'DPS' },
  { code: 'DRG', name: 'Dragoon', emoji: '🐉', group: 'DPS' },

  // Healer
  { code: 'WHM', name: 'White Mage', emoji: '⛅', group: 'Healer' },

  // Support
  { code: 'RDM', name: 'Red Mage', emoji: '🌹', group: 'Support' },
  { code: 'BRD', name: 'Bard', emoji: '🎵', group: 'Support' },
  { code: 'SMN', name: 'Summoner', emoji: '🔮', group: 'Support' },
  { code: 'THF', name: 'Thief', emoji: '🗝️', group: 'Support' },
];

// Danh sách Role chính
const ROLES = [
  { key: 'Tank', label: 'Tank', emoji: '🛡️', group: 'Tank', icons: ['Tank'] },
  { key: 'DPS', label: 'DPS', emoji: '⚔️', group: 'DPS', icons: ['DPS'] },
  { key: 'Healer', label: 'Healer', emoji: '♻️', group: 'Healer', icons: ['Healer'] },
  { key: 'Support', label: 'Support', emoji: '🚸', group: 'Support', icons: ['Support'] },
];

const LEGACY_ROLES = [];
const ROLE_BY_KEY = new Map(ROLES.map((r) => [r.key, r]));

// CHUYỂN DỔI JOBS THÀNH NÚT BẤM (Tránh lỗi ActionRow rỗng)
const MAIN_ROLE_BUTTONS = JOBS.map((job) => ({
  kind: 'role',
  key: job.code,
  label: job.name,
  emoji: job.emoji,
  icons: [job.code],
}));

const DPS_ROLES = ROLES.filter((r) => r.group === 'DPS');

const ROLE_GROUPS = [
  { label: 'Tank', emoji: '🛡️', icons: ['Tank'], keys: ['Tank'] },
  { label: 'DPS', emoji: '⚔️', icons: ['DPS'], keys: ['DPS'] },
  { label: 'Healer', emoji: '♻️', icons: ['Healer'], keys: ['Healer'] },
  { label: 'Support', emoji: '🚸', icons: ['Support'], keys: ['Support'] },
];

const STATUS = {
  ATTENDING: 'attending',
  TENTATIVE: 'tentative',
  ABSENCE: 'absence',
};

const EXTRA_STATUSES = [
  { key: STATUS.TENTATIVE, label: 'Tentative', emoji: '❔' },
  { key: STATUS.ABSENCE, label: 'Absence', emoji: '❌' },
];

module.exports = {
  JOBS,
  ROLES,
  LEGACY_ROLES,
  ROLE_BY_KEY,
  MAIN_ROLE_BUTTONS,
  DPS_ROLES,
  ROLE_GROUPS,
  STATUS,
  EXTRA_STATUSES,
};
