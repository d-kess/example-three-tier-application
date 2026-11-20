'use client';

import { useId, useState, useTransition } from 'react';
import { deleteTask, toggleTask, updateTask, type ActionResult, type Task } from '../actions';
import { ErrorMessage } from './ErrorMessage';

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1';
const textButton = `rounded-md px-2 py-1 text-sm transition-colors ${focusRing} disabled:opacity-50`;

export function TaskItem({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [completed, setCompleted] = useState(task.completed);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const errorId = useId();

  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onOk?.();
      else setError(result.fieldErrors?.title ?? result.error ?? 'Something went wrong');
    });
  }

  function startEditing() {
    setTitle(task.title);
    setCompleted(task.completed);
    setError(null);
    setEditing(true);
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateTask(task.id, title, completed), () => setEditing(false));
          }}
          className="flex flex-wrap items-center gap-3"
        >
          <input
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            aria-label="Task title"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`min-w-0 flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-50 ${focusRing}`}
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
            <input
              name="completed"
              type="checkbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
              className="h-4 w-4"
            />
            Completed
          </label>
          <div className="flex gap-1">
            <button
              type="submit"
              disabled={pending}
              className={`${textButton} bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200`}
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className={`${textButton} text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            >
              Cancel
            </button>
          </div>
          <div className="basis-full">
            <ErrorMessage id={errorId} message={error} />
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => toggleTask(task.id, !task.completed))}
          className={`h-5 w-5 rounded border-2 flex-shrink-0 transition-colors ${focusRing} ${
            task.completed
              ? 'bg-zinc-900 dark:bg-zinc-50 border-zinc-900 dark:border-zinc-50'
              : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-500'
          }`}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {task.completed && (
            <svg viewBox="0 0 12 12" className="text-white dark:text-zinc-900 w-full h-full p-0.5">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <span
          className={`flex-1 min-w-0 break-words text-sm ${
            task.completed ? 'line-through text-zinc-500' : 'text-zinc-800 dark:text-zinc-100'
          }`}
        >
          {task.title}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={startEditing}
            aria-label={`Edit task: ${task.title}`}
            className={`${textButton} text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700`}
          >
            Edit
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteTask(task.id))}
            aria-label={`Delete task: ${task.title}`}
            className={`${textButton} text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-zinc-700`}
          >
            Delete
          </button>
        </div>
      </div>
      <ErrorMessage id={errorId} message={error} />
    </li>
  );
}
