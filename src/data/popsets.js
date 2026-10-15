// Pop-item checklists cho Albion Online. 
// Quản lý danh sách các trang bị, nguyên liệu hoặc vật phẩm quan trọng mà người chơi cần mang theo trước mỗi buổi Raid/ZvZ.

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildTemplate(groups) {
  return groups.map((g) => ({
    name: g.name,
    emoji: g.emoji,
    image: g.image || null,
    items: g.items.map((it) => ({
      key: `${slug(g.name)}__${slug(it.item)}`,
      item: it.item,
      nm: it.nm,
      pop: Boolean(it.pop),
      trophy: Boolean(it.trophy),
    })),
  }));
}

const TEMPLATES = {
  // Checklist cho Avalonian Raid / High-end PVE
  ava_raid: {
    id: 'ava_raid',
    title: 'Avalonian Raid — Gear & Consumables Checklist',
    emoji: '⚔️',
    groups: buildTemplate([
      {
        name: 'Consumables & Food',
        emoji: '🧪',
        items: [
          { nm: 'Buff Food', item: 'Pork Roast T8', pop: true },
          { nm: 'Potions', item: 'Major Poison Potion T8', pop: true },
          { nm: 'Resilience Potions', item: 'Gigantic Potion T8', pop: true },
        ],
      },
      {
        name: 'Essential Tank & Support Gear',
        emoji: '🛡️',
        items: [
          { nm: 'Incubus Mace', item: 'Incubus Mace T8.3', pop: true },
          { nm: 'Shadowcaller', item: 'Shadowcaller T8.3', pop: true },
          { nm: 'Enigmatic Staff', item: 'Enigmatic Staff T8.3', pop: true },
        ],
      },
    ]),
  },
};

function getTemplate(id) {
  return TEMPLATES[id] || null;
}

function templateItems(template) {
  if (!template || !template.groups) return [];
  return template.groups.flatMap((g) =>
    g.items.map((it) => ({ ...it, group: g.name, groupEmoji: g.emoji })),
  );
}

function findItem(template, key) {
  return templateItems(template).find((it) => it.key === key) || null;
}

module.exports = { TEMPLATES, getTemplate, templateItems, findItem, slug };
