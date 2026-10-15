const JOBS_DATA = {
  TANK: [
    'Dreadstorm Monarch',
    'Heavy Mace'
  ],
  DPS: [
    'Crystal Reaper',
    'Lightcaller',
    'Hellspawn Staff',
    'Permafrost Prism',
    'Astral Staff'
  ],
  HEALER: [
    'Hallowfall',
    'Blight Staff'
  ],
  SUPPORT: [
    'Rootbound Staff'
  ]
};

function isValidJobForRole(role, job) {
  if (!role || !job) return false;
  const upperRole = role.toUpperCase();
  const validJobs = JOBS_DATA[upperRole] || [];
  return validJobs.includes(job);
}

function getAllJobs() {
  return JOBS_DATA;
}

module.exports = {
  JOBS_DATA,
  isValidJobForRole,
  getAllJobs,
};
