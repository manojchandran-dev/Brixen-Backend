const digits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

module.exports = {
  generateTicketId: () => `TCK${digits(13)}`,
  generateTicketMessageId: () => `TMSG${digits(12)}`,
};
