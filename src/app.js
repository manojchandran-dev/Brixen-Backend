const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

// eslint-disable-next-line no-extend-native
BigInt.prototype.toJSON = function toJSON() {
  return this.toString();
};

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);
app.use(errorHandler);

module.exports = app;
