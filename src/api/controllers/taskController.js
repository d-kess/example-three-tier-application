// HTTP layer: reads validated input from req.validated, calls the service,
// and writes the response. Errors bubble up to the error-handling middleware
// (Express 5 forwards rejected promises from async handlers automatically).
const taskService = require('../services/taskService');

async function list(_req, res) {
  res.json(await taskService.listTasks());
}

async function create(req, res) {
  const task = await taskService.createTask(req.validated.body);
  res.status(201).json(task);
}

async function patch(req, res) {
  const { params, body } = req.validated;
  res.json(await taskService.patchTask(params.id, body));
}

async function replace(req, res) {
  const { params, body } = req.validated;
  res.json(await taskService.replaceTask(params.id, body));
}

async function remove(req, res) {
  await taskService.deleteTask(req.validated.params.id);
  res.status(204).end();
}

module.exports = { list, create, patch, replace, remove };
