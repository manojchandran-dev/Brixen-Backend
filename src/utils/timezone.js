// A company's working day, in its own time zone (companies.timezone).

const DEFAULT_TZ = 'Asia/Kolkata';

function isValidTz(tz) {
  if (typeof tz !== 'string' || !tz.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// "2026-10-27": the calendar date at [instant] in [tz].
function dateIn(tz, instant = new Date()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

// "27 Oct 2026, 9:05 am": [instant] as a clock in [tz] shows it.
function localTime(tz, instant) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
}

// A YYYY-MM-DD string that is a real date, as a UTC midnight Date (how
// Prisma reads and writes DATE columns); null otherwise.
function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

module.exports = { DEFAULT_TZ, isValidTz, dateIn, localTime, parseDay };
