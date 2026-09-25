const { Prisma } = require('@prisma/client');
const permissionRepository = require('./repository');
const companyRepository = require('../companies/repository');
const moduleRepository = require('../masters/featureModules/repository');
const { generatePermissionId } = require('../../utils/permissionId');

const MAX_ID_ATTEMPTS = 5;
const FLAG_FIELDS = ['view', 'create', 'edit', 'delete'];

class PermissionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function withAccessLevel(permission) {
  if (!permission) return permission;

  const allOn = FLAG_FIELDS.every((f) => permission[f] === true);
  const allOff = FLAG_FIELDS.every((f) => permission[f] === false);
  const access_level = allOn ? 'Full Access' : allOff ? 'No Access' : 'Custom';

  return { ...permission, access_level };
}

async function assertValidCompany(company_id) {
  const company = await companyRepository.findById(company_id);
  if (!company) {
    throw new PermissionError('company_id does not reference an existing company');
  }
}

async function assertValidModule(module_id) {
  const module_ = await moduleRepository.findById(module_id);
  if (!module_) {
    throw new PermissionError('module_id does not reference an existing module');
  }
}

async function createPermission(company_id, data) {
  await assertValidCompany(company_id);
  await assertValidModule(data.module_id);

  const existing = await permissionRepository.findByCompanyAndModule(company_id, data.module_id);
  if (existing) {
    throw new PermissionError('A permission for this company and module already exists', 409);
  }

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      const permission = await permissionRepository.create({
        id: generatePermissionId(),
        company_id,
        module_id: data.module_id,
        view: data.view ?? false,
        create: data.create ?? false,
        edit: data.edit ?? false,
        delete: data.delete ?? false,
      });
      return withAccessLevel(permission);
    } catch (err) {
      const isDuplicateId = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!isDuplicateId) {
        throw err;
      }
    }
  }

  throw new Error('Failed to generate a unique permission id, please retry');
}

async function createPermissionsBulk(company_id, permissionsInput) {
  await assertValidCompany(company_id);

  const moduleIds = permissionsInput.map((p) => p.module_id);
  const uniqueModuleIds = new Set(moduleIds);
  if (uniqueModuleIds.size !== moduleIds.length) {
    throw new PermissionError('Duplicate module_id found in the permissions list');
  }

  for (const module_id of uniqueModuleIds) {
    await assertValidModule(module_id);
  }

  const results = [];
  for (const item of permissionsInput) {
    const flags = FLAG_FIELDS.reduce((acc, field) => {
      acc[field] = item[field] ?? false;
      return acc;
    }, {});

    const permission = await permissionRepository.upsert(company_id, item.module_id, generatePermissionId(), flags);
    results.push(withAccessLevel(permission));
  }

  return results;
}

async function getPermissions(company_id, { page = 1, limit = 20, module_id }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    ...(company_id ? { company_id } : {}),
    ...(module_id ? { module_id } : {}),
  };

  const [data, total] = await Promise.all([
    permissionRepository.findMany({ where, skip, take, orderBy: { created_at: 'asc' } }),
    permissionRepository.count(where),
  ]);

  return {
    items: data.map(withAccessLevel),
    meta: {
      page,
      limit: take,
      total,
      pages: Math.ceil(total / take),
    },
  };
}

async function getPermissionById(id, company_id) {
  const permission = await permissionRepository.findByIdAndCompany(id, company_id);
  return withAccessLevel(permission);
}

async function updatePermission(id, data) {
  const payload = FLAG_FIELDS.reduce((acc, field) => {
    if (data[field] !== undefined) acc[field] = Boolean(data[field]);
    return acc;
  }, {});

  const permission = await permissionRepository.update(id, payload);
  return withAccessLevel(permission);
}

async function deletePermission(id) {
  return permissionRepository.delete(id);
}

// How a company's saved row (or its absence) for one module reads on the
// Permissions screen. Same rules the backend enforces: no row = no access,
// except always_visible modules (Support Ticket, Chatbot).
function accessLevel(row, module) {
  if (!row) return module.always_visible ? 'full' : 'none';
  if (!row.view) return 'none';
  return row.create && row.edit && row.delete ? 'full' : 'custom';
}

// Permissions screen list: the company list (same search, filters, paging and
// filter-chip counts as GET /companies) with each company's access summary
// over the grantable modules -- one request instead of one per company.
async function getCompanyAccessList(filters) {
  const companyService = require('../companies/service');
  const result = await companyService.getCompanies(filters);
  const ids = result.items.map((c) => c.id);

  const [modules, rows] = await Promise.all([
    moduleRepository.findMany({ where: { grantable: true } }),
    ids.length ? permissionRepository.findMany({ where: { company_id: { in: ids } } }) : [],
  ]);
  // Only the modules that get a row on the screen: a group (Masters) isn't one, its children are.
  const parentIds = new Set(modules.map((m) => m.parent_id).filter(Boolean));
  const leaves = modules.filter((m) => !parentIds.has(m.id));
  const rowFor = new Map(rows.map((r) => [`${r.company_id}:${r.module_id}`, r]));

  const items = result.items.map(({ password, ...company }) => {
    const access = { full: 0, custom: 0, none: 0, total: leaves.length };
    for (const m of leaves) access[accessLevel(rowFor.get(`${company.id}:${m.id}`), m)] += 1;
    return { ...company, access };
  });
  return { ...result, items };
}

module.exports = {
  getCompanyAccessList,
  PermissionError,
  createPermission,
  createPermissionsBulk,
  getPermissions,
  getPermissionById,
  updatePermission,
  deletePermission,
};
