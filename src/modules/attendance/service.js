const { Prisma } = require('@prisma/client');
const prisma = require('../../prisma/client');
const prefixedId = require('../../utils/prefixedId');
const { DEFAULT_TZ, dateIn, localTime, parseDay } = require('../../utils/timezone');

// One record per employee per day (the company's local date). What it holds
// follows the employee's salary type:
//   SHIFT_RATE -- 1 to 3 shifts, each from 1/4 to 3 shifts in quarters;
//   PIECE_RATE -- one or more work types with the quantity done; each line
//                 keeps the work type's rate as it was, so amount = qty x rate
//                 doesn't change when the rate does later;
//   HOURLY     -- the hours worked (1/4 hour steps, up to 24);
//   WEEKLY / MONTHLY -- a full day (1) or a half day (0.5).

class AttendanceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// 1/4, 1/2, 3/4, 1, 1 1/4 ... 2 3/4, 3.
const SHIFT_UNITS = Array.from({ length: 12 }, (_, i) => (i + 1) / 4);
const MAX_SHIFTS = 3;
const MAX_QUANTITY = 1000000;
const MAX_HOURS = 24;
const DAY_UNITS = [0.5, 1];
const DAY_KINDS = ['WEEKLY', 'MONTHLY'];

const INCLUDE = {
  employees: {
    select: {
      id: true,
      employee_code: true,
      first_name: true,
      last_name: true,
      department: true,
      salary_type: true,
      salary_period: true,
      salary: true,
    },
  },
  shifts: { orderBy: { shift_no: 'asc' } },
  pieces: { include: { work_types: { select: { name: true } } }, orderBy: { id: 'asc' } },
};

const round2 = (n) => Math.round(n * 100) / 100;
const fullName = (e) => [e.first_name, e.last_name].filter(Boolean).join(' ');

async function companyTz(company_id) {
  const company = await prisma.companies.findFirst({ where: { id: company_id }, select: { timezone: true } });
  return company?.timezone || DEFAULT_TZ;
}

// The API shape: plain numbers, the date as YYYY-MM-DD, the employee, and
// the day's totals. The day's amount: pieces x rates, shifts x the per-shift
// salary, hours x the hourly one. A weekly or monthly salary isn't a per-day
// figure (salary generation works it out), so null.
function shape(r) {
  const e = r.employees;
  const shifts = r.shifts.map((s) => ({ shift_no: s.shift_no, units: Number(s.units) }));
  const pieces = r.pieces.map((p) => ({
    work_type_id: p.work_type_id,
    work_type_name: p.work_types?.name ?? null,
    quantity: p.quantity,
    rate: Number(p.rate),
    amount: Number(p.amount),
  }));
  const totalShifts = shifts.reduce((a, s) => a + s.units, 0);
  const salary = e.salary === null ? null : Number(e.salary);
  const hours = r.hours === null ? null : Number(r.hours);
  const dayUnits = r.day_units === null ? null : Number(r.day_units);
  // The salary only prices the day while the employee is still paid that way.
  const rate = e.salary_type === r.kind ? salary : null;
  const amount =
    r.kind === 'PIECE_RATE'
      ? round2(pieces.reduce((a, p) => a + p.amount, 0))
      : r.kind === 'SHIFT_RATE' && rate
        ? round2(totalShifts * rate)
        : r.kind === 'HOURLY' && rate && hours !== null
          ? round2(hours * rate)
          : null;
  return {
    id: r.id,
    company_id: r.company_id,
    employee_id: r.employee_id,
    employee: {
      id: e.id,
      employee_code: e.employee_code,
      name: fullName(e),
      department: e.department,
      salary_type: e.salary_type,
      salary_period: e.salary_period,
      salary,
    },
    work_date: r.work_date.toISOString().slice(0, 10),
    kind: r.kind,
    timezone: r.timezone,
    recorded_at: r.recorded_at,
    recorded_local: localTime(r.timezone, r.recorded_at),
    notes: r.notes,
    shifts,
    pieces,
    hours,
    day_units: DAY_KINDS.includes(r.kind) ? (dayUnits ?? 1) : null,
    total_shifts: totalShifts,
    total_pieces: pieces.reduce((a, p) => a + p.quantity, 0),
    total_amount: amount,
  };
}

// The checked shift or piece rows, hours or day for [kind]. [previous] = the
// record's current pieces when editing: a work type already on it keeps its
// rate (and may stay even if made inactive since).
async function entries(company_id, kind, body, previous = []) {
  const shifts = body.shifts ?? [];
  const pieces = body.pieces ?? [];
  if (!Array.isArray(shifts) || !Array.isArray(pieces)) throw new AttendanceError('shifts and pieces must be lists');
  const none = { shifts: [], pieces: [], hours: null, day_units: null };

  if (kind === 'HOURLY' || DAY_KINDS.includes(kind)) {
    if (shifts.length || pieces.length) {
      throw new AttendanceError(
        kind === 'HOURLY' ? 'This employee is paid by the hour: record hours worked' : 'Record a full or half day for this employee'
      );
    }
    if (kind === 'HOURLY') {
      const hours = Number(body.hours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_HOURS || Math.round(hours * 4) !== hours * 4) {
        throw new AttendanceError(`Hours must be more than 0 and at most ${MAX_HOURS}, in quarter hours (e.g. 7.5)`);
      }
      return { ...none, hours };
    }
    const day = body.day_units === undefined || body.day_units === null ? 1 : Number(body.day_units);
    if (!DAY_UNITS.includes(day)) throw new AttendanceError('Pick a full day or a half day');
    return { ...none, day_units: day };
  }

  if (kind === 'SHIFT_RATE') {
    if (pieces.length) throw new AttendanceError('This employee is paid by shift: record shifts, not pieces');
    if (!shifts.length) throw new AttendanceError('Add at least one shift');
    if (shifts.length > MAX_SHIFTS) throw new AttendanceError(`At most ${MAX_SHIFTS} shifts can be recorded for one day`);
    return {
      shifts: shifts.map((s, i) => {
        const units = Number(typeof s === 'object' && s !== null ? s.units : s);
        if (!SHIFT_UNITS.includes(units)) throw new AttendanceError(`Shift ${i + 1} must be from 1/4 to 3 shifts, in quarters`);
        return { id: prefixedId('ATSH'), shift_no: i + 1, units };
      }),
      pieces: [],
      hours: null,
      day_units: null,
    };
  }

  // PIECE_RATE
  if (shifts.length) throw new AttendanceError('This employee is paid by piece: record work types and quantities, not shifts');
  if (!pieces.length) throw new AttendanceError('Add at least one work type with its quantity');
  const ids = pieces.map((p) => String(p?.work_type_id ?? ''));
  if (new Set(ids).size !== ids.length) throw new AttendanceError('A work type is listed twice. Add its quantities together');
  const types = await prisma.work_types.findMany({ where: { company_id, id: { in: ids } } });
  const byId = new Map(types.map((t) => [t.id, t]));
  const kept = new Map(previous.map((p) => [p.work_type_id, p]));
  return {
    ...none,
    pieces: pieces.map((p, i) => {
      const type = byId.get(ids[i]);
      const before = kept.get(ids[i]);
      if (!type && !before) throw new AttendanceError(`Line ${i + 1}: pick a work type from the Work Type master`);
      if (type && type.status !== 'ACTIVE' && !before) throw new AttendanceError(`Work type "${type.name}" is inactive`);
      const quantity = Number(p.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
        throw new AttendanceError(`Line ${i + 1}: quantity must be a whole number from 1 to ${MAX_QUANTITY}`);
      }
      const rate = before ? Number(before.rate) : Number(type.rate);
      return { id: prefixedId('ATPC'), work_type_id: ids[i], quantity, rate, amount: round2(quantity * rate) };
    }),
  };
}

async function findEmployee(employee_id, company_id) {
  const id = Number(employee_id);
  if (!Number.isInteger(id) || id <= 0) throw new AttendanceError('Pick an employee');
  const employee = await prisma.employees.findFirst({ where: { id, company_id } });
  if (!employee) throw new AttendanceError('Employee not found', 404);
  return employee;
}

async function getOne(id, company_id) {
  const r = await prisma.attendance.findFirst({ where: { id, company_id }, include: INCLUDE });
  return r ? shape(r) : null;
}

async function create(company_id, recorded_by, body) {
  const tz = await companyTz(company_id);
  const employee = await findEmployee(body.employee_id, company_id);
  if (employee.status !== 'Active') throw new AttendanceError(`${fullName(employee)} is ${employee.status ?? 'not active'}`);
  if (!employee.salary_type) {
    throw new AttendanceError(`Set ${fullName(employee)}'s salary type in Employees before recording attendance`);
  }

  const today = dateIn(tz);
  const day = body.work_date ?? today;
  const work_date = parseDay(day);
  if (!work_date) throw new AttendanceError('work_date must be a date as YYYY-MM-DD');
  if (day > today) throw new AttendanceError(`Attendance can't be recorded for a future date (today is ${today})`);

  const clash = await prisma.attendance.findFirst({ where: { employee_id: employee.id, work_date }, select: { id: true } });
  if (clash) {
    throw new AttendanceError(`Attendance for ${fullName(employee)} on ${day} is already recorded. Edit that entry instead`, 409);
  }

  const { shifts, pieces, hours, day_units } = await entries(company_id, employee.salary_type, body);
  try {
    const created = await prisma.attendance.create({
      data: {
        id: prefixedId('ATTN'),
        company_id,
        employee_id: employee.id,
        work_date,
        timezone: tz,
        kind: employee.salary_type,
        hours,
        day_units,
        notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
        recorded_by,
        shifts: { create: shifts },
        pieces: { create: pieces },
      },
    });
    return getOne(created.id, company_id);
  } catch (err) {
    // Saved by someone else at the same moment: the unique index caught it.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AttendanceError(`Attendance for ${fullName(employee)} on ${day} is already recorded`, 409);
    }
    throw err;
  }
}

// Replaces the day's shifts, pieces, hours or day (and notes). Employee and
// date stay.
async function update(id, company_id, recorded_by, body) {
  const current = await prisma.attendance.findFirst({ where: { id, company_id }, include: { pieces: true } });
  if (!current) throw new AttendanceError('Attendance not found', 404);
  const { shifts, pieces, hours, day_units } = await entries(company_id, current.kind, body, current.pieces);
  await prisma.$transaction([
    prisma.attendance_shifts.deleteMany({ where: { attendance_id: id } }),
    prisma.attendance_pieces.deleteMany({ where: { attendance_id: id } }),
    prisma.attendance.update({
      where: { id },
      data: {
        ...(body.notes !== undefined
          ? { notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null }
          : {}),
        hours,
        day_units,
        recorded_by,
        updated_at: new Date(),
        shifts: { create: shifts },
        pieces: { create: pieces },
      },
    }),
  ]);
  return getOne(id, company_id);
}

async function remove(id, company_id) {
  const { count } = await prisma.attendance.deleteMany({ where: { id, company_id } });
  if (!count) throw new AttendanceError('Attendance not found', 404);
}

// ?date= one day (default: today in the company's zone), or ?from=&to=;
// ?employee_id=, ?kind= (a salary type), ?search= (name or code).
async function list(company_id, q = {}) {
  const tz = await companyTz(company_id);
  const today = dateIn(tz);
  const one = q.from || q.to ? null : parseDay(q.date ?? today);
  const from = q.from ? parseDay(q.from) : null;
  const to = q.to ? parseDay(q.to) : null;
  if ((q.date && !one) || (q.from && !from) || (q.to && !to)) throw new AttendanceError('Dates must be YYYY-MM-DD');
  if (from && to && from > to) throw new AttendanceError('from must be on or before to');

  const search = String(q.search ?? '').trim();
  const where = {
    company_id,
    ...(one ? { work_date: one } : { work_date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }),
    ...(q.employee_id ? { employee_id: Number(q.employee_id) || -1 } : {}),
    ...(q.kind ? { kind: String(q.kind).toUpperCase() } : {}),
    ...(search
      ? {
          employees: {
            OR: [
              { first_name: { contains: search, mode: 'insensitive' } },
              { last_name: { contains: search, mode: 'insensitive' } },
              { employee_code: { contains: search, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
  };
  const rows = await prisma.attendance.findMany({
    where,
    include: INCLUDE,
    orderBy: [{ work_date: 'desc' }, { recorded_at: 'desc' }],
    take: 1000,
  });
  return { items: rows.map(shape), meta: { timezone: tz, today } };
}

module.exports = { AttendanceError, SHIFT_UNITS, MAX_SHIFTS, MAX_HOURS, companyTz, list, getOne, create, update, remove };
