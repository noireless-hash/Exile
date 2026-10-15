// Attending roles (mutually exclusive per member) and non-attending statuses.
const ROLES = [
  { key: 'Tank', label: 'Tank', emoji: '🛡️', group: 'Tank', icons: ['Tank'] },
  { key: 'DPS', label: 'DPS', emoji: '⚔️', group: 'DPS', icons: ['DPS'] },
  { key: 'Healer', label: 'Healer', emoji: '♻️', group: 'Healer', icons: ['Healer'] },
  { key: 'Support', label: 'Support', emoji: '🚸', group: 'Support', icons: ['Support'] },
];

const LEGACY_ROLES = [];
const ROLE_BY_KEY = new Map(ROLES.map((r) => [r.key, r]));

// Khôi phục lại 4 nút bấm chính ban đầu (Tank, DPS, Healer, Support)
const MAIN_ROLE_BUTTONS = [
  { kind: 'role', key: 'Tank', label: 'Tank', emoji: '🛡️', icons: ['Tank'] },
  { kind: 'role', key: 'DPS', label: 'DPS', emoji: '⚔️', icons: ['DPS'] },
  { kind: 'role', key: 'Healer', label: 'Healer', emoji: '♻️', icons: ['Healer'] },
  { kind: 'role', key: 'Support', label: 'Support', emoji: '🚸', icons: ['Support'] },
];

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
  ROLES,
  LEGACY_ROLES,
  ROLE_BY_KEY,
  MAIN_ROLE_BUTTONS,
  DPS_ROLES,
  ROLE_GROUPS,
  STATUS,
  EXTRA_STATUSES,
};
