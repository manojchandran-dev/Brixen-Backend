const { Router } = require('express');
const prisma = require('../../prisma/client');
const asyncHandler = require('../../middleware/asyncHandler');
const prefixedId = require('../../utils/prefixedId');
const { success, error } = require('../../core/responses/apiResponse');
const { parseCompanyId } = require('../../utils/companyScope');
const { dateIn, parseDay } = require('../../utils/timezone');
const { AttendanceError, companyTz } = require('./service');

// Piece lots: piece work counted once a lot is delivered rather than day by
// day -- e.g. 800 dozen of a work type at 0.40 a piece = 800 x 12 x 0.40.
// One row per employee, work type and delivery; salary generation adds the
// lots whose delivery date falls in its period. Mounted at /attendance/lots
// (the Attendance permission).

const UNITS = { PIECE: 1, DOZEN: 12 };
const MAX_QUANTITY = 1000000;
const round2 = (n) => Math.round(n * 100) / 100;
const fullName = (e) => [e.first_name, e.last_name].filter(Boolean).join(' ');

const INCLUDE = {
  employees: { select: { id: true, employee_code: true, first_name: true, last_name: true, department: true } },
  work_types: { select: { name: true } },
};

function shape(l) {
  return {
    id: l.id,
    employee_id: l.employee_id,
    employee: {
      id: l.employees.id,
      employee_code: l.employees.employee_code,
      name: fullName(l.employees),
      department: l.employees.department,
    },
    work_type_id: l.work_type_id,
    work_type_name: l.work_types?.name ?? null,
    lot_date: l.lot_date.toISOString().slice(0, 10),
    unit: l.unit,
    quantity: l.quantity,
    pieces: l.pieces,
    rate: Number(l.rate),
    amount: Number(l.amount),
    notes: l.notes,
  };
}

// The checked columns for a lot. [current] = the saved lot when editing: its
// work type keeps its rate (and may stay even if made inactive since).
async function columns(company_id, body, current = null) {
  const today = dateIn(await companyTz(company_id));

  const employee_id = current ? current.employee_id : Number(body.employee_id);
  if (!current) {
    if (!Number.isInteger(employee_id) || employee_id <= 0) throw new AttendanceError('Pick an employee');
    const employee = await prisma.employees.findFirst({ where: { id: employee_id, company_id }, select: { id: true } });
    if (!employee) throw new AttendanceError('Employee not found', 404);
  }

  const day = body.lot_date ?? (current ? current.lot_date.toISOString().slice(0, 10) : today);
  const lot_date = parseDay(day);
  if (!lot_date) throw new AttendanceError('lot_date must be a date as YYYY-MM-DD');
  if (day > today) throw new AttendanceError(`A delivery can't be in the future (today is ${today})`);

  const work_type_id = String(body.work_type_id ?? current?.work_type_id ?? '');
  const type = await prisma.work_types.findFirst({ where: { id: work_type_id, company_id } });
  const sameType = current && current.work_type_id === work_type_id;
  if (!type && !sameType) throw new AttendanceError('Pick a work type from the Work Type master');
  if (type && type.status !== 'ACTIVE' && !sameType) throw new AttendanceError(`Work type "${type.name}" is inactive`);

  const unit = String(body.unit ?? current?.unit ?? 'PIECE').toUpperCase();
  if (!UNITS[unit]) throw new AttendanceError('unit must be PIECE or DOZEN');
  const quantity = Number(body.quantity ?? current?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new AttendanceError(`Quantity must be a whole number from 1 to ${MAX_QUANTITY}`);
  }
  const pieces = quantity * UNITS[unit];
  const rate = sameType ? Number(current.rate) : Number(type.rate);
  return {
    employee_id,
    work_type_id,
    lot_date,
    unit,
    quantity,
    pieces,
    rate,
    amount: round2(pieces * rate),
    notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 500) : null,
  };
}

const router = Router();

const handle = (fn) =>
  asyncHandler(async (req, res) => {
    const company_id = parseCompanyId(req.query.company_id ?? req.body?.company_id);
    if (!company_id) return error(res, 'company_id is required and must be a positive integer', 400);
    try {
      return await fn(req, res, company_id);
    } catch (err) {
      if (err instanceof AttendanceError) return error(res, err.message, err.status);
      throw err;
    }
  });

// ?from=&to= (YYYY-MM-DD, delivery dates), ?employee_id=.
router.get(
  '/',
  handle(async (req, res, company_id) => {
    const from = req.query.from ? parseDay(req.query.from) : null;
    const to = req.query.to ? parseDay(req.query.to) : null;
    if ((req.query.from && !from) || (req.query.to && !to)) throw new AttendanceError('Dates must be YYYY-MM-DD');
    const rows = await prisma.piece_lots.findMany({
      where: {
        company_id,
        ...(from || to ? { lot_date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        ...(req.query.employee_id ? { employee_id: Number(req.query.employee_id) || -1 } : {}),
      },
      include: INCLUDE,
      orderBy: [{ lot_date: 'desc' }, { created_at: 'desc' }],
      take: 1000,
    });
    return success(res, { items: rows.map(shape) });
  })
);

router.post(
  '/',
  handle(async (req, res, company_id) => {
    const data = await columns(company_id, req.body ?? {});
    const lot = await prisma.piece_lots.create({
      data: { id: prefixedId('PLOT'), company_id, recorded_by: req.auth?.userId ?? null, ...data },
      include: INCLUDE,
    });
    return success(res, shape(lot), 201);
  })
);

router.put(
  '/:id',
  handle(async (req, res, company_id) => {
    const current = await prisma.piece_lots.findFirst({ where: { id: req.params.id, company_id } });
    if (!current) return error(res, 'Lot not found', 404);
    const { employee_id: _same, ...data } = await columns(company_id, req.body ?? {}, current);
    const lot = await prisma.piece_lots.update({
      where: { id: current.id },
      data: { ...data, recorded_by: req.auth?.userId ?? null, updated_at: new Date() },
      include: INCLUDE,
    });
    return success(res, shape(lot));
  })
);

router.delete(
  '/:id',
  handle(async (req, res, company_id) => {
    const { count } = await prisma.piece_lots.deleteMany({ where: { id: req.params.id, company_id } });
    if (!count) return error(res, 'Lot not found', 404);
    return res.status(204).send();
  })
);

module.exports = { router, shape, INCLUDE };
