import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteAccount from '@/components/DeleteAccount';

const mockInvoke = vi.fn();
const mockSignOut = vi.fn();
const mockToast = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('DeleteAccount', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockSignOut.mockReset();
    mockToast.mockReset();
  });

  it('keeps the confirm button disabled until the exact phrase is typed', async () => {
    const user = userEvent.setup();
    render(<DeleteAccount />);

    await user.click(screen.getByRole('button', { name: /delete my account and all data/i }));
    const confirmButton = screen.getByRole('button', { name: /permanently delete/i });
    expect(confirmButton).toBeDisabled();

    const input = screen.getByPlaceholderText('DELETE MY ACCOUNT');
    await user.type(input, 'delete my account'); // wrong case
    expect(confirmButton).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'DELETE MY ACCOUNT');
    expect(confirmButton).not.toBeDisabled();
  });

  it('invokes the delete-account function and signs out on success', async () => {
    mockInvoke.mockResolvedValue({ data: { deleted: true }, error: null });
    const user = userEvent.setup();
    render(<DeleteAccount />);

    await user.click(screen.getByRole('button', { name: /delete my account and all data/i }));
    await user.type(screen.getByPlaceholderText('DELETE MY ACCOUNT'), 'DELETE MY ACCOUNT');
    fireEvent.click(screen.getByRole('button', { name: /permanently delete/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('delete-account', { body: { confirm: 'DELETE MY ACCOUNT' } });
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it('shows an error toast and does not sign out if deletion fails', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Server error' } });
    const user = userEvent.setup();
    render(<DeleteAccount />);

    await user.click(screen.getByRole('button', { name: /delete my account and all data/i }));
    await user.type(screen.getByPlaceholderText('DELETE MY ACCOUNT'), 'DELETE MY ACCOUNT');
    fireEvent.click(screen.getByRole('button', { name: /permanently delete/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not delete account' }));
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
