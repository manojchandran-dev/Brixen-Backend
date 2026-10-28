// What one employee earns for a payroll month, from their attendance:
//   SHIFT_RATE  shifts worked x the per-shift salary;
//   PIECE_RATE  each work type's pieces x its rate (as recorded that day);
//   HOURLY      hours worked x the hourly salary;
//   WEEKLY      days present x (weekly salary / 6 working days);
//   MONTHLY     days present x (monthly salary / the month's working days).
// A half day counts 0.5. Records of another kind (the employee's salary
// type changed mid-month) still count as days present, but add no shifts,
// hours or pieces.

const WEEK_WORKING_DAYS = 6;

const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => (v === null || v === undefined ? 0 : Number(v));

// "2026-10" -> { from: "2026-10-01", to: "2026-10-31", days: 31 }, or null.
function monthRange(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(days).padStart(2, '0')}`, days };
}

// "2026-10-26" (a Monday) -> { from: "2026-10-26", to: "2026-11-01" }, or
// null for anything else.
function weekRange(start) {
  if (typeof start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  const d = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== start || d.getUTCDay() !== 1) return null;
  const end = new Date(d.getTime() + 6 * 24 * 60 * 60 * 1000);
  return { from: start, to: end.toISOString().slice(0, 10) };
}

// A run's key as people say it: "October 2026", or the week
// "26 Oct – 1 Nov 2026".
function periodLabel(key) {
  const fmt = (iso, opts) => new Date(`${iso}T00:00:00Z`).toLocaleString('en-IN', { ...opts, timeZone: 'UTC' });
  const week = weekRange(key);
  if (week) {
    return `${fmt(week.from, { day: 'numeric', month: 'short' })} – ${fmt(week.to, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return monthRange(key) ? fmt(`${key}-01`, { month: 'long', year: 'numeric' }) : String(key);
}

// The month's days less its Sundays.
function workingDaysIn(month) {
  const r = monthRange(month);
  if (!r) return 0;
  const [y, m] = month.split('-').map(Number);
  let n = 0;
  for (let d = 1; d <= r.days; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0) n++;
  return n;
}

// [records]: attendance rows with shifts and pieces (pieces carrying
// work_types.name). Returns the payslip's figures.
function payFor({ salary_type: type, salary }, records, workingDays) {
  const rate = type === 'PIECE_RATE' || salary === null || salary === undefined ? null : Number(salary);
  const daysPresent = records.reduce((a, r) => a + (r.day_units === null || r.day_units === undefined ? 1 : num(r.day_units)), 0);
  let units = 0;
  let gross = 0;
  let breakdown = null;

  switch (type) {
    case 'SHIFT_RATE':
      units = records.reduce((a, r) => a + (r.shifts ?? []).reduce((b, s) => b + num(s.units), 0), 0);
      gross = units * (rate ?? 0);
      break;
    case 'PIECE_RATE': {
      // One line per work type and rate (a rate change mid-month = two lines).
      const lines = new Map();
      for (const r of records) {
        for (const p of r.pieces ?? []) {
          const key = `${p.work_type_id}@${num(p.rate)}`;
          const line = lines.get(key) ?? {
            work_type_id: p.work_type_id,
            name: p.work_types?.name ?? 'Work type',
            quantity: 0,
            rate: num(p.rate),
            amount: 0,
          };
          line.quantity += p.quantity;
          line.amount = round2(line.amount + num(p.amount));
          lines.set(key, line);
        }
      }
      breakdown = [...lines.values()];
      units = breakdown.reduce((a, l) => a + l.quantity, 0);
      gross = breakdown.reduce((a, l) => a + l.amount, 0);
      break;
    }
    case 'HOURLY':
      units = records.reduce((a, r) => a + num(r.hours), 0);
      gross = units * (rate ?? 0);
      break;
    case 'WEEKLY':
      units = daysPresent;
      gross = (units * (rate ?? 0)) / WEEK_WORKING_DAYS;
      break;
    case 'MONTHLY':
      units = daysPresent;
      gross = workingDays > 0 ? (units * (rate ?? 0)) / workingDays : 0;
      break;
    default:
      break;
  }
  return { rate, units: round2(units), days_present: round2(daysPresent), gross: round2(gross), breakdown };
}

module.exports = { WEEK_WORKING_DAYS, monthRange, weekRange, periodLabel, workingDaysIn, payFor, round2 };
