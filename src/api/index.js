const app = require('./app');

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

module.exports = app;
