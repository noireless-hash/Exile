// Danh sách các build vũ khí chuẩn xác theo hệ thống Albion Online của bạn
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

/**
 * Kiểm tra xem một vũ khí có thuộc role chỉ định hay không
 */
function isValidJobForRole(role, job) {
  if (!role || !job) return false;
  const upperRole = role.toUpperCase();
  const validJobs = JOBS_DATA[upperRole] || [];
  return validJobs.includes(job);
}

/**
 * Lấy toàn bộ danh sách jobs
 */
function getAllJobs() {
  return JOBS_DATA;
}

module.exports = {
  JOBS_DATA,
  isValidJobForRole,
  getAllJobs,
};
