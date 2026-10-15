// Attending roles (mutually exclusive per member) and non-attending statuses.

// Roles a member fills when they ARE coming. `icons` lists the custom role-icon
// emoji names to try, in priority order (most specific first), falling back to
// the unicode `emoji`. `group` is the summary bucket (tank / dps / healer).
const ROLES = [
  { key: 'Tank', label: 'Tank', emoji: '🛡️', group: 'Tank', icons: ['Tank'] },
  { key: 'DPS', label: 'DPS', emoji: '⚔️', group: 'DPS', icons: ['DPS'] },
  { key: 'Healer', label: 'Healer', emoji: '♻️', group: 'Healer', icons: ['Healer'] },
  { key: 'Support', label: 'Support', emoji: '🚸', group: 'Support', icons: ['Support'] },
];

// Legacy/compat role keys that may still exist in the database from older
// signups but are no longer offered as buttons. Rendered, never selectable.
const ROLE_BY_KEY = new Map(ROLES.map((r) => [r.key, r]));

// The three top-level role buttons on the public board. `dps` is not a role on
// its own — clicking it opens an ephemeral picker for the three DPS subtypes.
const MAIN_ROLE_BUTTONS = [
  { kind: 'role', key: 'Tank', label: 'Tank', emoji: '🛡️', icons: ['Tank'] },
  { kind: 'role', label: 'DPS', emoji: '⚔️', icons: ['DPS'] },
  { kind: 'role', key: 'Healer', label: 'Healer', emoji: '♻️', icons: ['Healer'] },
  { kind: 'role', key: 'Support', label: 'Support', emoji: '🚸', icons: ['Support'] },
];

// The DPS subtype choices shown in the ephemeral picker.
const DPS_ROLES = ROLES.filter((r) => r.group === 'dps');

// How the header summary line is grouped/labelled (the DPS subtypes collapse
// into one "DPS" bucket), matching the compact Tank / DPS / Healer-Support row.
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
