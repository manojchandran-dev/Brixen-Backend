const crypto = require('crypto');

// A temporary password from a cryptographic random source: [length]
// characters of upper and lower case letters and digits, leaving out the
// look-alikes (0/O, 1/l/I), with at least one of each kind.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ALL = UPPER + LOWER + DIGITS;

const pick = (set) => set[crypto.randomInt(set.length)];

function generateSecurePassword(length = 12) {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Shuffle so the guaranteed kinds aren't always first.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

module.exports = { generateSecurePassword };
