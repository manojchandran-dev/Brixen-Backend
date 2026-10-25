function generatePurchaseCategoryId() {
  let digits = '';
  for (let i = 0; i < 11; i += 1) {
    digits += Math.floor(Math.random() * 10);
  }
  return `PUCAT${digits}`;
}

module.exports = { generatePurchaseCategoryId };
