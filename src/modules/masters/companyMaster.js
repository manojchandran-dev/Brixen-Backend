const { Router } = require('express');
const { Prisma } = require('@prisma/client');
const prisma = require('../../prisma/client');
const asyncHandler = require('../../middleware/asyncHandler');
const restoreHandler = require('../../utils/restore');
const prefixedId = require('../../utils/prefixedId');
const { choice, compact } = require('../../utils/listFilters');
const { parseCompanyId, resolveListScope } = require('../../utils/companyScope');
const { success, error } = require('../../core/responses/apiResponse');

// A company's own simple master list (Departments, Work Types): name,
// description, ACTIVE/INACTIVE, soft delete and restore, like the Expense
// Category master. Ids are made by the server ("DEPT123456789012"). Names
// are unique within a company (ignoring case) among the live rows.
//
// config:
//   model   -- Prisma model, e.g. 'departments'
//   prefix  -- id prefix, e.g. 'DEPT'
//   label   -- for messages, e.g. 'department'
//   rate    -- true: a required "rate" (money, more than 0) on create
//   inUse   -- optional async (id) => message|null; blocks delete when set

const STATUSES = ['ACTIVE', 'INACTIVE'];
const MAX_ID_ATTEMPTS = 5;

function companyMasterRouter({ model, prefix, label, rate = false, inUse }) {
  const table = prisma[model];
  const idPattern = new RegExp(`^${prefix}\\d{${16 - prefix.length}}$`);

  // Checks and tidies the body; `creating` makes name (and rate) required.
  function clean(body, creating) {
    const errors = [];
    const out = {};
    if (body.name !== undefined || creating) {
      if (typeof body.name !== 'string' || !body.name.trim()) errors.push('name is required');
      else if (body.name.trim().length > 150) errors.push('name must be at most 150 characters');
      else out.name = body.name.trim();
    }
    if (body.description !== undefined) {
      if (body.description !== null && typeof body.description !== 'string') errors.push('description must be text');
      else out.description = body.description?.trim() || null;
    }
    if (body.status !== undefined) {
      const s = String(body.status).toUpperCase();
      if (!STATUSES.includes(s)) errors.push(`status must be one of: ${STATUSES.join(', ')}`);
      else out.status = s;
    }
    if (rate && (body.rate !== undefined || creating)) {
      const n = Number(body.rate);
      if (body.rate === null || body.rate === '' || Number.isNaN(n) || n <= 0) {
        errors.push('rate is required and must be more than 0');
      } else if (n > 9999999999) {
        errors.push('rate is too large');
      } else {
        out.rate = Math.round(n * 100) / 100;
      }
    }
    if (!creating && !Object.keys(out).length && !errors.length) errors.push('At least one field is required to update');
    return { errors, data: out };
  }

  async function assertNameFree(company_id, name, selfId) {
    const clash = await table.findFirst({
      where: { company_id, name: { equals: name, mode: 'insensitive' }, ...(selfId ? { id: { not: selfId } } : {}) },
      select: { id: true },
    });
    if (clash) return `A ${label} named "${name}" already exists`;
    return null;
  }

  const companyOf = (req) => parseCompanyId(req.body?.company_id ?? req.query.company_id);

  async function findOwn(req, res) {
    const company_id = parseCompanyId(req.query.company_id);
    if (!company_id) {
      error(res, 'company_id is required and must be a positive integer', 400);
      return null;
    }
    if (!idPattern.test(req.params.id)) {
      error(res, `Invalid ${label} id`, 400);
      return null;
    }
    const row = await table.findFirst({ where: { id: req.params.id, company_id } });
    if (!row) error(res, `${label[0].toUpperCase()}${label.slice(1)} not found`, 404);
    return row;
  }

  const router = Router();

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const company_id = companyOf(req);
      if (!company_id) return error(res, 'company_id is required and must be a positive integer', 400);
      const { errors, data } = clean(req.body, true);
      if (errors.length) return res.status(400).json({ success: false, errors });
      const clash = await assertNameFree(company_id, data.name);
      if (clash) return error(res, clash, 409);

      for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
        try {
          const row = await table.create({ data: { id: prefixedId(prefix), company_id, status: 'ACTIVE', ...data } });
          return success(res, row, 201);
        } catch (err) {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
        }
      }
      throw new Error(`Failed to generate a unique ${label} id, please retry`);
    })
  );

  // ?search= (name/description), ?status=ACTIVE|INACTIVE, ?deleted=true.
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { company_id, ok } = resolveListScope(req.query);
      if (!ok) return error(res, 'company_id is required and must be a positive integer', 400);
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const take = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
      const search = String(req.query.search || '').trim();
      const where = {
        ...(company_id ? { company_id } : {}),
        ...(req.query.deleted === 'true' ? { deleted_at: { not: null } } : {}),
        ...compact({ status: choice('status', req.query.status, STATUSES) }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        table.findMany({ where, skip: (page - 1) * take, take, orderBy: { created_at: 'desc' } }),
        table.count({ where }),
      ]);
      return success(res, { items, meta: { page, limit: take, total, pages: Math.ceil(total / take) } });
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const row = await findOwn(req, res);
      if (row) success(res, row);
    })
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const row = await findOwn(req, res);
      if (!row) return undefined;
      const { errors, data } = clean(req.body, false);
      if (errors.length) return res.status(400).json({ success: false, errors });
      if (data.name) {
        const clash = await assertNameFree(row.company_id, data.name, row.id);
        if (clash) return error(res, clash, 409);
      }
      return success(res, await table.update({ where: { id: row.id }, data: { ...data, updated_at: new Date() } }));
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const row = await findOwn(req, res);
      if (!row) return undefined;
      const blocked = inUse ? await inUse(row.id) : null;
      if (blocked) return error(res, blocked, 409);
      await table.delete({ where: { id: row.id } });
      return res.status(204).send();
    })
  );

  router.post('/:id/restore', asyncHandler(restoreHandler(model, { label })));

  return router;
}

module.exports = { companyMasterRouter };
