const moduleRepository = require('./repository');
const permissionRepository = require('../../permissions/repository');

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

// always_visible modules (Support, Chatbot) show unless the superadmin has
// explicitly switched them off for this company.
function filterTree(tree, grantedModuleIds, deniedModuleIds) {
  return tree
    .map((node) => {
      const children = filterTree(node.children, grantedModuleIds, deniedModuleIds);
      const selfGranted =
        grantedModuleIds.has(node.id) || (node.always_visible && !deniedModuleIds.has(node.id));
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
    permissionRepository.findMany({ where: { company_id } }),
  ]);

  const grantedModuleIds = new Set(permissions.filter((p) => p.view).map((p) => p.module_id));
  const deniedModuleIds = new Set(permissions.filter((p) => !p.view).map((p) => p.module_id));
  // Superadmin-only modules never reach a company, whatever old permission
  // rows say.
  const tree = buildTree(modules.filter((m) => m.grantable));
  return filterTree(tree, grantedModuleIds, deniedModuleIds);
}

// What a superadmin can grant a company, for the Permissions screen: every
// module except the superadmin-only ones (grantable = false). A group
// (Masters) keeps only its grantable children.
function filterGrantableTree(tree) {
  return tree
    .filter((node) => node.grantable)
    .map((node) => {
      const children = filterGrantableTree(node.children);
      return node.children.length && !children.length ? null : { ...node, children };
    })
    .filter(Boolean);
}

async function getGrantableModules() {
  const modules = await moduleRepository.findMany({ orderBy: { created_at: 'asc' } });
  return filterGrantableTree(buildTree(modules));
}

module.exports = { getModules, getAccessibleModules, getGrantableModules };
