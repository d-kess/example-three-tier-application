const express = require('express');
const registerRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json());
registerRoutes(app);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
