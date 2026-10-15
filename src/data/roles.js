// Attending roles (mutually exclusive per member) and non-attending statuses.

// Roles a member fills when they ARE coming.
const ROLES = [
  { key: 'Tank', label: 'Tank', emoji: '🛡️', group: 'Tank', icons: ['Tank'] },
  { key: 'DPS', label: 'DPS', emoji: '⚔️', group: 'DPS', icons: ['DPS'] },
  { key: 'Healer', label: 'Healer', emoji: '♻️', group: 'Healer', icons: ['Healer'] },
  { key: 'Support', label: 'Support', emoji: '🚸', group: 'Support', icons: ['Support'] },
];

// Để mảng rỗng để tương thích với các file cũ đang require LEGACY_ROLES
const LEGACY_ROLES = [];

const ROLE_BY_KEY = new Map(ROLES.map((r) => [r.key, r]));

// ĐIỀU CHỈNH: Trả về nút giả định hoặc để mảng rỗng (Discord không cho phép ActionRow rỗng)
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
  LEGACY_ROLES,
  ROLE_BY_KEY,
  MAIN_ROLE_BUTTONS,
  DPS_ROLES,
  ROLE_GROUPS,
  STATUS,
  EXTRA_STATUSES,
};
