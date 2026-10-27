// How an employee is paid.
//   SHIFT_RATE: salary (the amount) per MONTHLY / WEEKLY / DAILY / HOURLY;
//               attendance records shifts.
//   PIECE_RATE: always PER_PIECE; pay is each work type's rate x pieces,
//               so there's no amount of its own. Attendance records pieces.

const SALARY_TYPES = ['SHIFT_RATE', 'PIECE_RATE'];
const SALARY_PERIODS = ['MONTHLY', 'WEEKLY', 'DAILY', 'HOURLY', 'PER_PIECE'];
const PERIODS_FOR = {
  SHIFT_RATE: ['MONTHLY', 'WEEKLY', 'DAILY', 'HOURLY'],
  PIECE_RATE: ['PER_PIECE'],
};

const norm = (v) => String(v).trim().toUpperCase().replace(/[\s-]+/g, '_');

// The employee's salary fields after a change: [current] (the saved row, or
// {} on create) merged with [changes]. Returns { data, errors }: the columns
// to save, or why the combination is invalid.
function resolveSalary(current, changes) {
  const errors = [];
  const touched = ['salary_type', 'salary_period', 'salary'].some((f) => changes[f] !== undefined);
  if (!touched) return { data: {}, errors };

  let type = changes.salary_type !== undefined ? changes.salary_type : current.salary_type;
  let period = changes.salary_period !== undefined ? changes.salary_period : current.salary_period;
  const rawAmount = changes.salary !== undefined ? changes.salary : current.salary;

  if (type !== null && type !== undefined && type !== '') {
    type = norm(type);
    if (!SALARY_TYPES.includes(type)) errors.push('salary_type must be SHIFT_RATE or PIECE_RATE');
  } else {
    type = null;
  }
  if (period !== null && period !== undefined && period !== '') {
    period = norm(period);
    if (!SALARY_PERIODS.includes(period)) errors.push(`salary_period must be one of: ${SALARY_PERIODS.join(', ')}`);
  } else {
    period = null;
  }
  if (errors.length) return { data: {}, errors };

  if (!type) {
    // An employee from before salary types, saved without one: the amount
    // alone is kept as it always was. A period needs a type to mean anything.
    if (period) errors.push('Pick a salary type: Shift Rate or Piece Rate');
    const legacy = rawAmount === null || rawAmount === undefined || rawAmount === '' ? null : Number(rawAmount);
    if (legacy !== null && (Number.isNaN(legacy) || legacy < 0)) errors.push('salary must be a non-negative number');
    return { data: changes.salary !== undefined ? { salary: legacy } : {}, errors };
  }

  if (type === 'PIECE_RATE') {
    // Changing to piece rate sets the only period it has.
    if (period && period !== 'PER_PIECE' && changes.salary_period !== undefined) {
      errors.push('Piece Rate is paid Per Piece (by each work type\'s rate)');
    }
    return { data: { salary_type: type, salary_period: 'PER_PIECE', salary: null }, errors };
  }

  // SHIFT_RATE
  if (!period || !PERIODS_FOR.SHIFT_RATE.includes(period)) {
    errors.push(
      period === 'PER_PIECE'
        ? 'Per Piece is only for Piece Rate. Pick Monthly, Weekly, Daily or Hourly'
        : 'Pick how the shift rate is paid: Monthly, Weekly, Daily or Hourly'
    );
  }
  const amount = rawAmount === null || rawAmount === undefined || rawAmount === '' ? NaN : Number(rawAmount);
  if (Number.isNaN(amount) || amount <= 0) {
    errors.push('Enter the salary amount (more than 0) for the shift rate');
  } else if (amount > 9999999999) {
    errors.push('salary is too large');
  }
  return { data: { salary_type: type, salary_period: period, salary: amount }, errors };
}

module.exports = { SALARY_TYPES, SALARY_PERIODS, PERIODS_FOR, resolveSalary };
