// Cấu hình các nhóm Vai trò (Role Groups) cho Albion Online
const ROLE_GROUPS = [
  {
    key: 'Tank',
    label: 'Tank',
    emoji: '🛡️',
    icons: ['Tank'],
    keys: ['Tank'],
  },
  {
    key: 'DPS',
    label: 'DPS',
    emoji: '⚔️',
    icons: ['DPS'],
    keys: ['DPS', 'Melee DPS', 'Ranged DPS'],
  },
  {
    key: 'Healer',
    label: 'Healer',
    emoji: '♻️',
    icons: ['Healer'],
    keys: ['Healer'],
  },
  {
    key: 'Support',
    label: 'Support',
    emoji: '🚸',
    icons: ['Support'],
    keys: ['Support', 'Utility'],
  },
];

// Danh sách các Vai trò (Roles) chính
const ROLES = ROLE_GROUPS.map((g) => ({
  key: g.key,
  label: g.label,
  emoji: g.emoji,
  group: g.key,
  icons: g.icons,
}));

const LEGACY_ROLES = [];
const ROLE_BY_KEY = new Map(ROLES.map((r) => [r.key, r]));

// 4 Nút bấm vai trò chính hiển thị trên Hàng 1 của Event Message
const MAIN_ROLE_BUTTONS = ROLE_GROUPS.map((group) => ({
  kind: 'role',
  key: group.key,
  label: group.label,
  emoji: group.emoji,
  icons: group.icons,
}));

const DPS_ROLES = ROLES.filter((r) => r.group === 'DPS');

// Định nghĩa các trạng thái tham gia sự kiện
const STATUS = {
  ATTENDING: 'attending',
  TENTATIVE: 'tentative',
  ABSENCE: 'absence',
};

// Các nút trạng thái bổ trợ hiển thị trên Hàng 2
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
