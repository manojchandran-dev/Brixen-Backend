// Date range + chart bars for the superadmin report tabs. All dates here are
// local calendar days ('YYYY-MM-DD') in the caller's time zone; SQL turns
// stored UTC timestamps into the same local days (see localDate in service).

const DAY_MS = 24 * 60 * 60 * 1000;
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RANGES = ['week', 'month', 'custom', 'all'];
const DEFAULT_TZ = 'Asia/Kolkata';
const MAX_MONTH_BARS = 24;

class RangeError400 extends Error {}

const utc = (day) => new Date(`${day}T00:00:00Z`);
const iso = (date) => date.toISOString().slice(0, 10);
const addDays = (day, n) => iso(new Date(utc(day).getTime() + n * DAY_MS));
const daysBetween = (from, to) => Math.round((utc(to) - utc(from)) / DAY_MS); // to - from
const minDay = (a, b) => (a < b ? a : b);
const dm = (day) => `${utc(day).getUTCDate()}/${utc(day).getUTCMonth() + 1}`;

function todayIn(tz) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function isValidDay(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(utc(s)) === s;
}

function isValidTz(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// { range, tz, today, start, end } -- start/end inclusive local days;
// start is null for range=all (no lower limit).
function parseRange(query) {
  const range = query.range ?? 'month';
  if (!RANGES.includes(range)) throw new RangeError400(`range must be one of: ${RANGES.join(', ')}`);
  const tz = query.tz || DEFAULT_TZ;
  if (!isValidTz(tz)) throw new RangeError400('tz must be an IANA time zone, e.g. Asia/Kolkata');
  const today = todayIn(tz);

  if (range === 'week') return { range, tz, today, start: addDays(today, -6), end: today };
  if (range === 'month') return { range, tz, today, start: addDays(today, -29), end: today };
  if (range === 'all') return { range, tz, today, start: null, end: today };

  const { from, to } = query;
  if (!isValidDay(from) || !isValidDay(to)) throw new RangeError400('from and to are required as YYYY-MM-DD when range=custom');
  if (from > to) throw new RangeError400('from must be on or before to');
  return { range, tz, today, start: from, end: to };
}

// Calendar-month bars from the month of `first` to the month of `last`,
// each clipped to [first, last].
function monthBars(first, last) {
  const bars = [];
  let y = utc(first).getUTCFullYear();
  let m = utc(first).getUTCMonth();
  for (;;) {
    const monthStart = iso(new Date(Date.UTC(y, m, 1)));
    if (monthStart > last) break;
    const monthEnd = iso(new Date(Date.UTC(y, m + 1, 0)));
    bars.push({ label: MONTHS[m], start: monthStart < first ? first : monthStart, end: minDay(monthEnd, last) });
    m += 1;
    if (m === 12) { m = 0; y += 1; }
  }
  return bars;
}

// Chart bars, oldest first, each { label, start, end } (inclusive local days).
// `firstRecordDay` is only used for range=all.
function buildBars(r, firstRecordDay) {
  const { range, today } = r;

  if (range === 'week') {
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i - 6);
      return { label: DOW[utc(day).getUTCDay()], start: day, end: day };
    });
  }
  if (range === 'month') {
    // 5 weeks of 7 days, the last ending today.
    return Array.from({ length: 5 }, (_, i) => {
      const start = addDays(today, -34 + i * 7);
      return { label: dm(start), start, end: addDays(start, 6) };
    });
  }
  if (range === 'all') {
    const bars = monthBars(firstRecordDay ?? today, today);
    return bars.slice(-MAX_MONTH_BARS);
  }

  // custom
  const days = daysBetween(r.start, r.end) + 1;
  if (days <= 14) {
    return Array.from({ length: days }, (_, i) => {
      const day = addDays(r.start, i);
      return { label: days <= 8 ? DOW[utc(day).getUTCDay()] : String(utc(day).getUTCDate()), start: day, end: day };
    });
  }
  if (days <= 120) {
    const bars = [];
    for (let start = r.start; start <= r.end; start = addDays(start, 7)) {
      bars.push({ label: dm(start), start, end: minDay(addDays(start, 6), r.end) });
    }
    return bars;
  }
  return monthBars(r.start, r.end);
}

// Sums per-day counts ({ 'YYYY-MM-DD': n }) into the bars.
function fillBars(bars, perDay) {
  return bars.map((b) => {
    let count = 0;
    for (let day = b.start; day <= b.end; day = addDays(day, 1)) count += perDay.get(day) ?? 0;
    return { ...b, count };
  });
}

module.exports = { RangeError400, parseRange, buildBars, fillBars };
