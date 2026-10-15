// 1. Định nghĩa sẵn danh sách Job tương ứng cho từng nhóm
const ROLE_GROUPS = [
  { 
    key: 'Tank', 
    label: 'Tank', 
    emoji: '🛡️', 
    icons: ['Tank'], 
    jobs: [
      { code: 'PLD', name: 'Paladin', emoji: '🛡️' },
      { code: 'NIN', name: 'Ninja', emoji: '🥷' }
    ]
  },
  { 
    key: 'DPS', 
    label: 'DPS', 
    emoji: '⚔️', 
    icons: ['DPS'], 
    jobs: [
      { code: 'WAR', name: 'Warrior', emoji: '🪓' },
      { code: 'MNK', name: 'Monk', emoji: '👊' },
      { code: 'BLM', name: 'Black Mage', emoji: '🔥' },
      { code: 'DRK', name: 'Dark Knight', emoji: '🌑' },
      { code: 'BST', name: 'Beastmaster', emoji: '🐺' },
      { code: 'RNG', name: 'Ranger', emoji: '🏹' },
      { code: 'SAM', name: 'Samurai', emoji: '🗡️' },
      { code: 'DRG', name: 'Dragoon', emoji: '🐉' }
    ]
  },
  { 
    key: 'Healer', 
    label: 'Healer', 
    emoji: '♻️', 
    icons: ['Healer'], 
    jobs: [
      { code: 'WHM', name: 'White Mage', emoji: '⛅' }
    ]
  },
  { 
    key: 'Support', 
    label: 'Support', 
    emoji: '🚸', 
    icons: ['Support'], 
    jobs: [
      { code: 'RDM', name: 'Red Mage', emoji: '🌹' },
      { code: 'BRD', name: 'Bard', emoji: '🎵' },
      { code: 'SMN', name: 'Summoner', emoji: '🔮' },
      { code: 'THF', name: 'Thief', emoji: '🗝️' }
    ]
  },
];

const ROLES = ROLE_GROUPS.map(g => ({
  key: g.key,
  label: g.label,
  emoji: g.emoji,
  group: g.key,
  icons: g.icons
}));

const LEGACY_ROLES = [];
const ROLE_BY_KEY = new Map(ROLES.map((r) => [r.key, r]));

// 2. Tạo đúng 4 nút bấm chính cho 4 nhóm (Nằm gọn trên 1 hàng duy nhất)
const MAIN_ROLE_BUTTONS = ROLE_GROUPS.map((group) => ({
  kind: 'role',
  key: group.key,
  label: group.label,
  emoji: group.emoji,
  icons: group.icons,
  jobs: group.jobs // Gắn kèm danh sách job vào nút để phần code tương tác (interaction) gọi ra menu
}));

const DPS_ROLES = ROLES.filter((r) => r.group === 'DPS');

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
