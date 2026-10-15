// Roles using Full Names as key
const JOBS = [
  // Tank
  { code: 'Paladin', name: 'Paladin', emoji: '🛡️', group: 'tank' },
  { code: 'Ninja', name: 'Ninja', emoji: '🥷', group: 'tank' },

  // DPS
  { code: 'Warrior', name: 'Warrior', emoji: '🪓', group: 'dps' },
  { code: 'Monk', name: 'Monk', emoji: '👊', group: 'dps' },
  { code: 'Black Mage', name: 'Black Mage', emoji: '🔥', group: 'dps' },
  { code: 'Dark Knight', name: 'Dark Knight', emoji: '🌑', group: 'dps' },
  { code: 'Beastmaster', name: 'Beastmaster', emoji: '🐺', group: 'dps' },
  { code: 'Ranger', name: 'Ranger', emoji: '🏹', group: 'dps' },
  { code: 'Samurai', name: 'Samurai', emoji: '🗡️', group: 'dps' },
  { code: 'Dragoon', name: 'Dragoon', emoji: '🐉', group: 'dps' },

  // Healer
  { code: 'White Mage', name: 'White Mage', emoji: '⛅', group: 'healer' },

  // Support
  { code: 'Red Mage', name: 'Red Mage', emoji: '🌹', group: 'support' },
  { code: 'Bard', name: 'Bard', emoji: '🎵', group: 'support' },
  { code: 'Summoner', name: 'Summoner', emoji: '🔮', group: 'support' },
  { code: 'Thief', name: 'Thief', emoji: '🗝️', group: 'support' },
];

const JOB_BY_CODE = new Map(JOBS.map((j) => [j.code, j]));

function getJobsByRole(roleGroup) {
  return JOBS.filter((j) => j.group === roleGroup.toLowerCase());
}

function jobRole(code) {
  return JOB_BY_CODE.get(code)?.group || 'unknown';
}

function jobLabel(code) {
  const job = JOB_BY_CODE.get(code);
  return job ? job.name : code || '???';
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
