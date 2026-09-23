const moduleRepository = require('../repositories/moduleRepository');
const permissionRepository = require('../repositories/permissionRepository');

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

function filterTree(tree, grantedModuleIds) {
  return tree
    .map((node) => {
      const children = filterTree(node.children, grantedModuleIds);
      const selfGranted = node.always_visible || grantedModuleIds.has(node.id);
      if (!selfGranted && children.length === 0) {
        return null;
      }
      return { ...node, children };
    })
    .filter(Boolean);
}

function filterSuperadminTree(tree) {
  return tree
    .map((node) => {
      const children = filterSuperadminTree(node.children);
      if (!node.visible_to_superadmin && children.length === 0) {
        return null;
      }
      return { ...node, children };
    })
    .filter(Boolean);
}

async function getModules() {
  const modules = await moduleRepository.findMany({ orderBy: { created_at: 'asc' } });
  const tree = buildTree(modules);
  return filterSuperadminTree(tree);
}

async function getAccessibleModules(company_id) {
  const [modules, permissions] = await Promise.all([
    moduleRepository.findMany({ orderBy: { created_at: 'asc' } }),
    permissionRepository.findMany({ where: { company_id, view: true } }),
  ]);

  const grantedModuleIds = new Set(permissions.map((p) => p.module_id));
  const tree = buildTree(modules);
  return filterTree(tree, grantedModuleIds);
}

module.exports = { getModules, getAccessibleModules };
