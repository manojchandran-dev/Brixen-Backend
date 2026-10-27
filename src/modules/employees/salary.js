// How an employee is paid. Every type but PIECE_RATE has an amount of its
// own (`salary`); what attendance records follows the type:
//   SHIFT_RATE: amount per shift; attendance records shifts.
//   PIECE_RATE: each work type's rate x pieces; attendance records pieces.
//   HOURLY:     amount per hour; attendance records hours.
//   WEEKLY:     amount per week (6 working days); attendance records a full
//               or half day.
//   MONTHLY:    amount per month (its working days); attendance records a
//               full or half day.
// salary_period mirrors the type (PER_SHIFT, PER_PIECE, HOURLY...) for older
// screens that read it.

const SALARY_TYPES = ['SHIFT_RATE', 'PIECE_RATE', 'HOURLY', 'WEEKLY', 'MONTHLY'];
const PERIOD_OF = {
  SHIFT_RATE: 'PER_SHIFT',
  PIECE_RATE: 'PER_PIECE',
  HOURLY: 'HOURLY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
};
const LABEL = { SHIFT_RATE: 'Shift', PIECE_RATE: 'Piece Rate', HOURLY: 'Hourly', WEEKLY: 'Weekly', MONTHLY: 'Monthly' };

const norm = (v) => String(v).trim().toUpperCase().replace(/[\s-]+/g, '_');

// An older app's Shift Rate + period, as one of the types above.
function fromLegacy(type, period) {
  if (type === 'SHIFT_RATE' && ['HOURLY', 'WEEKLY', 'MONTHLY'].includes(period)) return period;
  return type;
}

// The employee's salary fields after a change: [current] (the saved row, or
// {} on create) merged with [changes]. Returns { data, errors }: the columns
// to save, or why the combination is invalid.
function resolveSalary(current, changes) {
  const errors = [];
  const touched = ['salary_type', 'salary_period', 'salary'].some((f) => changes[f] !== undefined);
  if (!touched) return { data: {}, errors };

  let type = changes.salary_type !== undefined ? changes.salary_type : current.salary_type;
  const rawAmount = changes.salary !== undefined ? changes.salary : current.salary;

  if (type !== null && type !== undefined && type !== '') {
    type = norm(type);
    const period = changes.salary_period ? norm(changes.salary_period) : null;
    type = fromLegacy(type, period);
    if (!SALARY_TYPES.includes(type)) errors.push(`salary_type must be one of: ${SALARY_TYPES.join(', ')}`);
  } else {
    type = null;
  }
  if (errors.length) return { data: {}, errors };

  if (!type) {
    // An employee from before salary types, saved without one: the amount
    // alone is kept as it always was.
    const legacy = rawAmount === null || rawAmount === undefined || rawAmount === '' ? null : Number(rawAmount);
    if (legacy !== null && (Number.isNaN(legacy) || legacy < 0)) errors.push('salary must be a non-negative number');
    return { data: changes.salary !== undefined ? { salary: legacy } : {}, errors };
  }

  if (type === 'PIECE_RATE') {
    return { data: { salary_type: type, salary_period: PERIOD_OF[type], salary: null }, errors };
  }

  const amount = rawAmount === null || rawAmount === undefined || rawAmount === '' ? NaN : Number(rawAmount);
  if (Number.isNaN(amount) || amount <= 0) {
    errors.push(`Enter the ${LABEL[type].toLowerCase()} salary amount (more than 0)`);
  } else if (amount > 9999999999) {
    errors.push('salary is too large');
  }
  return { data: { salary_type: type, salary_period: PERIOD_OF[type], salary: amount }, errors };
}

module.exports = { SALARY_TYPES, PERIOD_OF, LABEL, resolveSalary };
