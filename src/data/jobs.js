// FFXI jobs mapped directly to roles (tank, dps, healer, support)
const JOBS = [
  // Tank
  { code: 'PLD', name: 'Paladin', emoji: '🛡️', group: 'tank' },
  { code: 'NIN', name: 'Ninja', emoji: '🥷', group: 'tank' },

  // DPS
  { code: 'WAR', name: 'Warrior', emoji: '🪓', group: 'dps' },
  { code: 'MNK', name: 'Monk', emoji: '👊', group: 'dps' },
  { code: 'BLM', name: 'Black Mage', emoji: '🔥', group: 'dps' },
  { code: 'DRK', name: 'Dark Knight', emoji: '🌑', group: 'dps' },
  { code: 'BST', name: 'Beastmaster', emoji: '🐺', group: 'dps' },
  { code: 'RNG', name: 'Ranger', emoji: '🏹', group: 'dps' },
  { code: 'SAM', name: 'Samurai', emoji: '🗡️', group: 'dps' },
  { code: 'DRG', name: 'Dragoon', emoji: '🐉', group: 'dps' },

  // Healer
  { code: 'WHM', name: 'White Mage', emoji: '⛅', group: 'healer' },

  // Support
  { code: 'RDM', name: 'Red Mage', emoji: '🌹', group: 'support' },
  { code: 'BRD', name: 'Bard', emoji: '🎵', group: 'support' },
  { code: 'SMN', name: 'Summoner', emoji: '🔮', group: 'support' },
  { code: 'THF', name: 'Thief', emoji: '🗝️', group: 'support' },
];

const JOB_BY_CODE = new Map(JOBS.map((j) => [j.code, j]));

// Hàm lấy danh sách các Jobs thuộc về một Role cụ thể (VD: 'tank', 'dps', 'healer', 'support')
function getJobsByRole(roleGroup) {
  return JOBS.filter((j) => j.group === roleGroup.toLowerCase());
}

// Hàm lấy Role group của 1 Job cụ thể
function jobRole(code) {
  return JOB_BY_CODE.get(code)?.group || 'unknown';
}

function jobLabel(code) {
  const job = JOB_BY_CODE.get(code);
  return job ? job.code : code || '???';
}

function jobEmoji(code) {
  return JOB_BY_CODE.get(code)?.emoji || '❔';
}

function jobName(code) {
  return JOB_BY_CODE.get(code)?.name || code || 'No Job';
}

module.exports = { 
  JOBS, 
  JOB_BY_CODE, 
  getJobsByRole, 
  jobRole, 
  jobLabel, 
  jobEmoji, 
  jobName 
};
