// e.g. prefixedId('PUSH') -> "PUSH123456789012" (16 chars, like the other modules)
module.exports = (prefix) =>
  prefix + Array.from({ length: 16 - prefix.length }, () => Math.floor(Math.random() * 10)).join('');
