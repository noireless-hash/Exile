const JOBS = [
  { code: 'PLD', name: 'Paladin', emoji: '🛡️', group: 'Tank' },
  { code: 'NIN', name: 'Ninja', emoji: '🥷', group: 'Tank' },
  { code: 'WAR', name: 'Warrior', emoji: '🪓', group: 'DPS' },
  { code: 'MNK', name: 'Monk', emoji: '👊', group: 'DPS' },
  { code: 'BLM', name: 'Black Mage', emoji: '🔥', group: 'DPS' },
  { code: 'DRK', name: 'Dark Knight', emoji: '🌑', group: 'DPS' },
  { code: 'BST', name: 'Beastmaster', emoji: '🐺', group: 'DPS' },
  { code: 'RNG', name: 'Ranger', emoji: '🏹', group: 'DPS' },
  { code: 'SAM', name: 'Samurai', emoji: '🗡️', group: 'DPS' },
  { code: 'DRG', name: 'Dragoon', emoji: '🐉', group: 'DPS' },
  { code: 'WHM', name: 'White Mage', emoji: '⛅', group: 'Healer' },
  { code: 'RDM', name: 'Red Mage', emoji: '🌹', group: 'Support' },
  { code: 'BRD', name: 'Bard', emoji: '🎵', group: 'Support' },
  { code: 'SMN', name: 'Summoner', emoji: '🔮', group: 'Support' },
  { code: 'THF', name: 'Thief', emoji: '🗝️', group: 'Support' },
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
