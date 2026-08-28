function generateModuleId() {
  let digits = '';
  for (let i = 0; i < 13; i += 1) {
    digits += Math.floor(Math.random() * 10);
  }
  return `MOD${digits}`;
}

module.exports = { generateModuleId };
