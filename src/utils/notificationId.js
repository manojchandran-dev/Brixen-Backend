function generateNotificationId() {
  let digits = '';
  for (let i = 0; i < 11; i += 1) {
    digits += Math.floor(Math.random() * 10);
  }
  return `NOTIF${digits}`;
}

module.exports = { generateNotificationId };
