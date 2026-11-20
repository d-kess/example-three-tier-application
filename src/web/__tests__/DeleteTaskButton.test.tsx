import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DeleteTaskButton } from '../app/components/DeleteTaskButton';
import { deleteTask } from '../app/actions';

jest.mock('../app/actions', () => ({ deleteTask: jest.fn() }));

const deleteMock = deleteTask as jest.Mock;

beforeEach(() => deleteMock.mockReset());

describe('DeleteTaskButton', () => {
  it('renders a Delete button and calls deleteTask with the task id', async () => {
    deleteMock.mockResolvedValue({ ok: true });
    render(<DeleteTaskButton id={3} title="Buy milk" />);
    fireEvent.click(screen.getByRole('button', { name: /delete task: buy milk/i }));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(3));
  });

  it('shows the error through ErrorMessage on failure (e.g. 404)', async () => {
    deleteMock.mockResolvedValue({ ok: false, error: 'Task not found' });
    render(<DeleteTaskButton id={3} title="Buy milk" />);
    fireEvent.click(screen.getByRole('button', { name: /delete task/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Task not found');
  });

  it('shows unreachable-server error', async () => {
    deleteMock.mockResolvedValue({ ok: false, error: 'Could not reach the server' });
    render(<DeleteTaskButton id={3} title="Buy milk" />);
    fireEvent.click(screen.getByRole('button', { name: /delete task/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
  });
});
