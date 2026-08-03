function generateExpenseCategoryId() {
  let digits = String(Math.floor(Math.random() * 9) + 1); // first digit 1-9, avoids a leading zero
  for (let i = 0; i < 15; i += 1) {
    digits += Math.floor(Math.random() * 10);
  }
  return BigInt(digits);
}

module.exports = { generateExpenseCategoryId };
