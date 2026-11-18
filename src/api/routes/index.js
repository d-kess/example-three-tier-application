const healthRoutes = require('./healthRoutes');
const taskRoutes = require('./taskRoutes');

/** Mount all routers on the given Express app. */
function registerRoutes(app) {
  app.use('/health', healthRoutes);
  app.use('/tasks', taskRoutes);
}

module.exports = registerRoutes;
