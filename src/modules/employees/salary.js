// How an employee is paid -- an amount (`salary`) per shift, piece, hour,
// week or month -- and what attendance records for them:
//   SHIFT_RATE: amount per shift; attendance records shifts.
//   PIECE_RATE: amount per piece or per dozen (salary_period PER_PIECE /
//               PER_DOZEN), paid on the sales of the products they make
//               (see product_makers); attendance marks them present/absent.
//   HOURLY:     amount per hour; attendance records hours.
//   WEEKLY:     amount per week (6 working days); attendance records a full
//               or half day.
//   MONTHLY:    amount per month (its working days); attendance records a
//               full or half day.
// salary_period mirrors the type (PER_SHIFT, HOURLY...), and for piece rate
// says per piece or per dozen.

const SALARY_TYPES = ['SHIFT_RATE', 'PIECE_RATE', 'HOURLY', 'WEEKLY', 'MONTHLY'];
const PERIOD_OF = {
  SHIFT_RATE: 'PER_SHIFT',
  PIECE_RATE: 'PER_PIECE',
  HOURLY: 'HOURLY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
};
const LABEL = { SHIFT_RATE: 'Shift', PIECE_RATE: 'Piece Rate', HOURLY: 'Hourly', WEEKLY: 'Weekly', MONTHLY: 'Monthly' };
const PIECE_PERIODS = ['PER_PIECE', 'PER_DOZEN'];

// A piece-rate employee's rate for one piece: per dozen / 12.
const perPiece = (salary, period) => (salary === null || salary === undefined ? 0 : Number(salary) / (period === 'PER_DOZEN' ? 12 : 1));

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

  let period = PERIOD_OF[type];
  if (type === 'PIECE_RATE') {
    const asked = changes.salary_period ?? current.salary_period;
    period = asked && PIECE_PERIODS.includes(norm(asked)) ? norm(asked) : 'PER_PIECE';
  }

  const amount = rawAmount === null || rawAmount === undefined || rawAmount === '' ? NaN : Number(rawAmount);
  if (Number.isNaN(amount) || amount <= 0) {
    errors.push(
      type === 'PIECE_RATE'
        ? 'Enter the piece rate (more than 0), per piece or per dozen'
        : `Enter the ${LABEL[type].toLowerCase()} salary amount (more than 0)`
    );
  } else if (amount > 9999999999) {
    errors.push('salary is too large');
  }
  return { data: { salary_type: type, salary_period: period, salary: amount }, errors };
}

module.exports = { SALARY_TYPES, PERIOD_OF, PIECE_PERIODS, LABEL, perPiece, resolveSalary };
