const moduleRepository = require('../repositories/moduleRepository');

function buildTree(modules) {
  const byId = new Map(modules.map((m) => [m.id, { ...m, children: [] }]));
  const roots = [];

  for (const module of byId.values()) {
    if (module.parent_id && byId.has(module.parent_id)) {
      byId.get(module.parent_id).children.push(module);
    } else {
      roots.push(module);
    }
  }

  return roots;
}

async function getModules() {
  const modules = await moduleRepository.findMany({ orderBy: { created_at: 'asc' } });
  return buildTree(modules);
}

module.exports = { getModules };
