function generateTempPassword() {
  let digits = '';
  for (let i = 0; i < 10; i += 1) {
    digits += Math.floor(Math.random() * 10);
  }
  return digits;
}

module.exports = { generateTempPassword };
