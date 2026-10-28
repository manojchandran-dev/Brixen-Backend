const { Router } = require('express');
const prisma = require('../../prisma/client');
const asyncHandler = require('../../middleware/asyncHandler');
const prefixedId = require('../../utils/prefixedId');
const { success, error } = require('../../core/responses/apiResponse');
const { parseCompanyId } = require('../../utils/companyScope');
const { dateIn, parseDay } = require('../../utils/timezone');
const { sendPiecePayEmail } = require('../../utils/mailer');
const { companyTz } = require('../attendance/service');

// Piece-rate pay, entered after a sale: an employee, a work type (its rate
// from Masters -> Work Type) and the quantity -- in pieces, or in combos of
// a product (x its combo size). A DRAFT can be changed or deleted;
// CONFIRMED is locked, can be emailed to the employee as a payslip, and
// counts in the salary report. Mounted at /payroll/piece-pays (the
// Employees permission, like the rest of salary).

class PiecePayError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const DRAFT = 'DRAFT';
const CONFIRMED = 'CONFIRMED';
const MAX_QUANTITY = 1000000;
const round2 = (n) => Math.round(n * 100) / 100;
const fullName = (e) => [e.first_name, e.last_name].filter(Boolean).join(' ');

const INCLUDE = {
  employees: { select: { id: true, employee_code: true, first_name: true, last_name: true, email: true, department: true } },
  work_types: { select: { name: true } },
  products: { select: { product_name: true } },
};

function shape(p) {
  return {
    id: p.id,
    employee_id: p.employee_id,
    employee: {
      id: p.employees.id,
      employee_code: p.employees.employee_code,
      name: fullName(p.employees),
      email: p.employees.email,
      department: p.employees.department,
    },
    work_type_id: p.work_type_id,
    work_type_name: p.work_types?.name ?? null,
    product_id: p.product_id,
    product_name: p.products?.product_name ?? null,
    pay_date: p.pay_date.toISOString().slice(0, 10),
    unit: p.unit,
    quantity: p.quantity,
    combo_size: p.combo_size,
    pieces: p.pieces,
    rate: Number(p.rate),
    amount: Number(p.amount),
    notes: p.notes,
    status: p.status,
    confirmed_at: p.confirmed_at,
    emailed_at: p.emailed_at,
    email_error: p.email_error,
  };
}

// The checked columns for an entry. [current] = the saved one when editing:
// its work type keeps its rate (and may stay even if made inactive since).
async function columns(company_id, body, current = null) {
  const today = dateIn(await companyTz(company_id));

  const employee_id = Number(body.employee_id ?? current?.employee_id);
  if (!Number.isInteger(employee_id) || employee_id <= 0) throw new PiecePayError('Pick an employee');
  const employee = await prisma.employees.findFirst({
    where: { id: employee_id, company_id },
    select: { salary_type: true, first_name: true, last_name: true },
  });
  if (!employee) throw new PiecePayError('Employee not found', 404);
  if (employee.salary_type !== 'PIECE_RATE' && employee_id !== current?.employee_id) {
    throw new PiecePayError(`${fullName(employee)} isn't on piece rate`);
  }

  const day = body.pay_date ?? (current ? current.pay_date.toISOString().slice(0, 10) : today);
  const pay_date = parseDay(day);
  if (!pay_date) throw new PiecePayError('pay_date must be a date as YYYY-MM-DD');
  if (day > today) throw new PiecePayError(`The date can't be in the future (today is ${today})`);

  const work_type_id = String(body.work_type_id ?? current?.work_type_id ?? '');
  const type = await prisma.work_types.findFirst({ where: { id: work_type_id, company_id } });
  const sameType = current && current.work_type_id === work_type_id;
  if (!type && !sameType) throw new PiecePayError('Pick a work type from Masters → Work Type');
  if (type && type.status !== 'ACTIVE' && !sameType) throw new PiecePayError(`Work type "${type.name}" is inactive`);

  const unit = String(body.unit ?? current?.unit ?? 'PIECE').toUpperCase();
  if (!['PIECE', 'COMBO'].includes(unit)) throw new PiecePayError('unit must be PIECE or COMBO');
  const quantity = Number(body.quantity ?? current?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new PiecePayError(`Quantity must be a whole number from 1 to ${MAX_QUANTITY}`);
  }

  let product_id = null;
  let combo_size = null;
  if (unit === 'COMBO') {
    product_id = String(body.product_id ?? current?.product_id ?? '');
    const product = await prisma.products.findFirst({
      where: { id: product_id, company_id },
      select: { combo_size: true, product_name: true },
    });
    if (!product) throw new PiecePayError('Pick the product sold in combos');
    if (!product.combo_size) throw new PiecePayError(`${product.product_name} isn't sold as a combo`);
    combo_size = product.combo_size;
  }

  const pieces = quantity * (combo_size ?? 1);
  const rate = sameType ? Number(current.rate) : Number(type.rate);
  return {
    employee_id,
    work_type_id,
    product_id,
    pay_date,
    unit,
    quantity,
    combo_size,
    pieces,
    rate,
    amount: round2(pieces * rate),
    notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 500) : null,
  };
}

async function findEntry(id, company_id) {
  const entry = await prisma.piece_pays.findFirst({ where: { id, company_id } });
  if (!entry) throw new PiecePayError('Piece pay not found', 404);
  return entry;
}

async function reload(id) {
  return shape(await prisma.piece_pays.findFirst({ where: { id }, include: INCLUDE }));
}

// Confirmed entries with dates in ?from=&to=, for the salary report and an
// employee's own payslips.
async function confirmedIn(company_id, { from, to, employee_id } = {}) {
  const rows = await prisma.piece_pays.findMany({
    where: {
      company_id,
      status: CONFIRMED,
      ...(employee_id ? { employee_id } : {}),
      ...(from || to ? { pay_date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    include: INCLUDE,
    orderBy: [{ pay_date: 'desc' }, { created_at: 'desc' }],
    take: 2000,
  });
  return rows.map(shape);
}

const router = Router();

const handle = (fn) =>
  asyncHandler(async (req, res) => {
    const company_id = parseCompanyId(req.query.company_id ?? req.body?.company_id);
    if (!company_id) return error(res, 'company_id is required and must be a positive integer', 400);
    try {
      return await fn(req, res, company_id);
    } catch (err) {
      if (err instanceof PiecePayError) return error(res, err.message, err.status);
      throw err;
    }
  });

// ?from=&to= (YYYY-MM-DD), ?employee_id=, ?status=DRAFT|CONFIRMED.
router.get(
  '/',
  handle(async (req, res, company_id) => {
    const from = req.query.from ? parseDay(req.query.from) : null;
    const to = req.query.to ? parseDay(req.query.to) : null;
    if ((req.query.from && !from) || (req.query.to && !to)) throw new PiecePayError('Dates must be YYYY-MM-DD');
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const rows = await prisma.piece_pays.findMany({
      where: {
        company_id,
        ...(from || to ? { pay_date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        ...(req.query.employee_id ? { employee_id: Number(req.query.employee_id) || -1 } : {}),
        ...(status ? { status } : {}),
      },
      include: INCLUDE,
      orderBy: [{ pay_date: 'desc' }, { created_at: 'desc' }],
      take: 2000,
    });
    return success(res, { items: rows.map(shape) });
  })
);

router.post(
  '/',
  handle(async (req, res, company_id) => {
    const data = await columns(company_id, req.body ?? {});
    const entry = await prisma.piece_pays.create({
      data: { id: prefixedId('PPAY'), company_id, created_by: req.auth?.userId ?? null, ...data },
    });
    return success(res, await reload(entry.id), 201);
  })
);

router.put(
  '/:id',
  handle(async (req, res, company_id) => {
    const current = await findEntry(req.params.id, company_id);
    if (current.status !== DRAFT) throw new PiecePayError('This piece pay is confirmed. Tap Edit again to change it', 409);
    const data = await columns(company_id, req.body ?? {}, current);
    await prisma.piece_pays.update({ where: { id: current.id }, data: { ...data, updated_at: new Date() } });
    return success(res, await reload(current.id));
  })
);

router.delete(
  '/:id',
  handle(async (req, res, company_id) => {
    const current = await findEntry(req.params.id, company_id);
    if (current.status !== DRAFT) throw new PiecePayError("A confirmed piece pay can't be deleted. Tap Edit again first", 409);
    await prisma.piece_pays.delete({ where: { id: current.id } });
    return res.status(204).send();
  })
);

router.post(
  '/:id/confirm',
  handle(async (req, res, company_id) => {
    const current = await findEntry(req.params.id, company_id);
    if (current.status === CONFIRMED) throw new PiecePayError('Already confirmed', 409);
    await prisma.piece_pays.update({
      where: { id: current.id },
      data: { status: CONFIRMED, confirmed_at: new Date(), updated_at: new Date() },
    });
    return success(res, await reload(current.id));
  })
);

router.post(
  '/:id/reopen',
  handle(async (req, res, company_id) => {
    const current = await findEntry(req.params.id, company_id);
    if (current.status !== CONFIRMED) throw new PiecePayError("It isn't confirmed", 409);
    await prisma.piece_pays.update({
      where: { id: current.id },
      data: { status: DRAFT, confirmed_at: null, updated_at: new Date() },
    });
    return success(res, await reload(current.id));
  })
);

// Emails the confirmed entry to the employee, as a plain-text payslip.
router.post(
  '/:id/send',
  handle(async (req, res, company_id) => {
    const current = await findEntry(req.params.id, company_id);
    if (current.status !== CONFIRMED) throw new PiecePayError('Confirm it before sending', 409);
    const entry = await reload(current.id);
    if (!entry.employee.email) throw new PiecePayError(`${entry.employee.name} has no email address`);
    const company = await prisma.companies.findFirst({ where: { id: company_id }, select: { company_name: true } });
    try {
      await sendPiecePayEmail(entry.employee.email, { entry, companyName: company?.company_name });
      await prisma.piece_pays.update({ where: { id: current.id }, data: { emailed_at: new Date(), email_error: null } });
    } catch (err) {
      const message = String(err?.message ?? err).slice(0, 300);
      await prisma.piece_pays.update({ where: { id: current.id }, data: { email_error: message } });
      throw new PiecePayError(`Couldn't send the email (${message})`, 502);
    }
    return success(res, await reload(current.id));
  })
);

module.exports = { router, confirmedIn };
