/**
 * Danh sách các Role chính thức trong hệ thống sự kiện Albion Online
 */
const ROLES = {
  TANK: {
    key: 'TANK',
    name: 'Tank',
    emoji: '🛡️',
    color: '#3498DB'
  },
  DPS: {
    key: 'DPS',
    name: 'DPS',
    emoji: '⚔️',
    color: '#E74C3C'
  },
  HEALER: {
    key: 'HEALER',
    name: 'Healer',
    emoji: '🌿',
    color: '#2ECC71'
  },
  SUPPORT: {
    key: 'SUPPORT',
    name: 'Support',
    emoji: '⚡',
    color: '#F1C40F'
  }
};

/**
 * Kiểm tra xem một chuỗi role có hợp lệ hay không
 */
function isValidRole(roleKey) {
  if (!roleKey) return false;
  return Object.prototype.hasOwnProperty.call(ROLES, roleKey.toUpperCase());
}

/**
 * Lấy danh sách tất cả các role dưới dạng mảng
 */
function getAllRoles() {
  return Object.values(ROLES);
}

module.exports = {
  ROLES,
  isValidRole,
  getAllRoles,
};
