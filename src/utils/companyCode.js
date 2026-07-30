function generateCompanyCode() {
  let digits = '';
  for (let i = 0; i < 12; i += 1) {
    digits += Math.floor(Math.random() * 10);
  }
  return `BRIXEN${digits}`;
}

module.exports = { generateCompanyCode };
