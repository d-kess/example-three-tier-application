'use client';

import { useState, useTransition } from 'react';
import { deleteTask } from '../actions';
import { ErrorMessage } from './ErrorMessage';

export function DeleteTaskButton({ id, title }: { id: number; title: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteTask(id);
      if (!result.ok) setError(result.error ?? 'Could not delete the task');
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label={`Delete task: ${title}`}
        className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        Delete
      </button>
      {error && (
        <div className="basis-full">
          <ErrorMessage message={error} />
        </div>
      )}
    </>
  );
}
