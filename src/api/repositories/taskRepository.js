// Data access layer: the only place that knows about SQL and the tasks table.
const db = require('../db');

/** Return all tasks, oldest first. */
async function findAll() {
  const { rows } = await db.query('SELECT * FROM tasks ORDER BY created_at ASC');
  return rows;
}

/** Return the task with the given id, or null if it does not exist. */
async function findById(id) {
  const { rows } = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
  return rows[0] || null;
}

/** Insert a task and return the created row. */
async function create(title) {
  const { rows } = await db.query(
    'INSERT INTO tasks (title) VALUES ($1) RETURNING *',
    [title]
  );
  return rows[0];
}

/** Set title and completed on a task. Returns the updated row, or null if it does not exist. */
async function update(id, { title, completed }) {
  const { rows } = await db.query(
    'UPDATE tasks SET completed = $1, title = $2 WHERE id = $3 RETURNING *',
    [completed, title, id]
  );
  return rows[0] || null;
}

/** Delete a task. Returns true if a row was deleted, false if it did not exist. */
async function remove(id) {
  const { rowCount } = await db.query('DELETE FROM tasks WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { findAll, findById, create, update, remove };
