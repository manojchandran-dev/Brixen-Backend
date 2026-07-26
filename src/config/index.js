require('dotenv').config();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const DATABASE_URL = process.env.DATABASE_URL || '';
const NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = {
  PORT,
  DATABASE_URL,
  NODE_ENV,
};
