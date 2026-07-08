import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireAuth from '@/components/RequireAuth';
import RequireRole from '@/components/RequireRole';

const mockUseAuth = vi.fn();

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderWithAuthGuard(initialPath = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/auth" element={<div>Auth Page</div>} />
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>Protected Content</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('shows a loading state while auth is resolving', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, isEmailVerified: false });
    const { container } = renderWithAuthGuard();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('redirects unauthenticated users to /auth', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, isEmailVerified: false });
    renderWithAuthGuard();
    expect(screen.getByText('Auth Page')).toBeInTheDocument();
  });

  it('blocks access with a verification screen for unverified users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'a@b.com', email_confirmed_at: null },
      loading: false,
      isEmailVerified: false,
      resendVerification: vi.fn(),
      signOut: vi.fn(),
    });
    renderWithAuthGuard();
    expect(screen.getByRole('heading', { name: /verify your email/i })).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders protected content for a verified, signed-in user', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'a@b.com', email_confirmed_at: '2026-01-01' },
      loading: false,
      isEmailVerified: true,
    });
    renderWithAuthGuard();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});

describe('RequireRole', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  function renderWithRoleGuard(allow: Array<'patient' | 'clinician' | 'admin'>) {
    return render(
      <MemoryRouter initialEntries={['/clinician']}>
        <Routes>
          <Route path="/" element={<div>Dashboard</div>} />
          <Route
            path="/clinician"
            element={
              <RequireRole allow={allow}>
                <div>Clinician Content</div>
              </RequireRole>
            }
          />
        </Routes>
      </MemoryRouter>
    );
  }

  it('shows a loading state while roles are resolving', () => {
    mockUseAuth.mockReturnValue({ rolesLoading: true, hasRole: () => false });
    const { container } = renderWithRoleGuard(['clinician', 'admin']);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders a 403 for a wrong-role user instead of redirecting', () => {
    mockUseAuth.mockReturnValue({ rolesLoading: false, hasRole: (r: string) => r === 'patient' });
    renderWithRoleGuard(['clinician', 'admin']);
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(screen.queryByText('Clinician Content')).not.toBeInTheDocument();
  });

  it('grants access when the user has an allowed role', () => {
    mockUseAuth.mockReturnValue({ rolesLoading: false, hasRole: (r: string) => r === 'clinician' });
    renderWithRoleGuard(['clinician', 'admin']);
    expect(screen.getByText('Clinician Content')).toBeInTheDocument();
  });

  it('grants access to an admin even when only clinician is explicitly checked first', () => {
    mockUseAuth.mockReturnValue({ rolesLoading: false, hasRole: (r: string) => r === 'admin' });
    renderWithRoleGuard(['clinician', 'admin']);
    expect(screen.getByText('Clinician Content')).toBeInTheDocument();
  });
});
