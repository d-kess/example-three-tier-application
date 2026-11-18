// Business logic layer. Knows nothing about HTTP; talks to the repository.
const taskRepository = require('../repositories/taskRepository');
const { NotFoundError } = require('../errors');

async function listTasks() {
  return taskRepository.findAll();
}

async function createTask({ title }) {
  return taskRepository.create(title);
}

/**
 * Partially update a task (PATCH semantics).
 * - `completed` set: sets the completed status explicitly
 * - `title` set: renames the task
 * - neither set: toggles the completed status
 */
async function patchTask(id, { completed, title } = {}) {
  const current = await taskRepository.findById(id);
  if (!current) throw new NotFoundError();

  let newCompleted = current.completed;
  if (completed !== undefined) {
    newCompleted = completed;
  } else if (title === undefined) {
    newCompleted = !current.completed;
  }
  const newTitle = title !== undefined ? title : current.title;

  const updated = await taskRepository.update(id, {
    title: newTitle,
    completed: newCompleted,
  });
  if (!updated) throw new NotFoundError();
  return updated;
}

/** Fully replace a task's title and completed status (PUT semantics). */
async function replaceTask(id, { title, completed }) {
  const updated = await taskRepository.update(id, { title, completed });
  if (!updated) throw new NotFoundError();
  return updated;
}

async function deleteTask(id) {
  const deleted = await taskRepository.remove(id);
  if (!deleted) throw new NotFoundError();
}

module.exports = { listTasks, createTask, patchTask, replaceTask, deleteTask };
