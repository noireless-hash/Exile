// Attending roles (mutually exclusive per member) and non-attending statuses.

// Roles a member fills when they ARE coming. `icons` lists the custom role-icon
// emoji names to try, in priority order (most specific first), falling back to
// the unicode `emoji`. `group` is the summary bucket (tank / dps / healer).
const ROLES = [
  { key: 'Tank', label: 'Tank', emoji: '🛡️', group: 'DPS', icons: ['Tank'] },
  { key: 'DPS', label: 'DPS', emoji: '⚔️', group: 'DPS', icons: ['DPS'] },
  { key: 'Healer', label: 'Healer', emoji: '♻️', group: 'Healer', icons: ['Healer'] },
  { key: 'Support', label: 'Support', emoji: '🚸', group: 'Support', icons: ['Support'] },
];

const ROLE_BY_KEY = new Map(ROLES.map((r) => [r.key, r]));

// ĐÃ XÓA CÁC NÚT BẤM MAIN ROLE (Để mảng rỗng để không hiển thị nút ra giao diện)
const MAIN_ROLE_BUTTONS = [];

// The DPS subtype choices shown in the ephemeral picker.
const DPS_ROLES = ROLES.filter((r) => r.group === 'DPS');

// How the header summary line is grouped/labelled.
const ROLE_GROUPS = [
  { label: 'Tank', emoji: '🛡️', icons: ['Tank'], keys: ['Tank'] },
  { label: 'DPS', emoji: '⚔️', icons: ['DPS'], keys: ['DPS'] },
  { label: 'Healer', emoji: '♻️', icons: ['Healer'], keys: ['Healer'] },
  { label: 'Support', emoji: '🚸', icons: ['Support'], keys: ['Support'] },
];

// Signup statuses. "attending" means they filled a role above.
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
  ROLES,
  ROLE_BY_KEY,
  MAIN_ROLE_BUTTONS,
  DPS_ROLES,
  ROLE_GROUPS,
  STATUS,
  EXTRA_STATUSES,
};
