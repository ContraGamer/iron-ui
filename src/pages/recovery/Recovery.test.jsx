import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Recovery } from './Recovery.jsx';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../components/ThemeToggle/ThemeToggle.jsx', () => ({
  ThemeToggle: () => null,
}));

const mockGetRecoveryData = vi.fn();
const mockRecoverAccount  = vi.fn();
vi.mock('../../service/domains/AuthService.jsx', () => ({
  default: () => ({
    getRecoveryData: mockGetRecoveryData,
    recoverAccount:  mockRecoverAccount,
  }),
}));

const mockDeriveRecoveryKey  = vi.fn();
const mockUnprotectVaultKey  = vi.fn();
const mockDeriveMasterKey    = vi.fn();
const mockProtectVaultKey    = vi.fn();

vi.mock('../../crypto/kdf.js', () => ({
  deriveRecoveryKey:  (...args) => mockDeriveRecoveryKey(...args),
  unprotectVaultKey:  (...args) => mockUnprotectVaultKey(...args),
  deriveMasterKey:    (...args) => mockDeriveMasterKey(...args),
  protectVaultKey:    (...args) => mockProtectVaultKey(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderRecovery = () =>
  render(
    <MemoryRouter>
      <Recovery />
    </MemoryRouter>,
  );

const MOCK_RECOVERY_DATA = {
  recoveryProtectedKey:   'base64ciphertext',
  recoveryProtectedKeyIv: 'base64iv',
  kdfSalt:                'base64salt',
  kdfIterations:          3,
  kdfMemory:              65536,
  kdfParallelism:         4,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Render ───────────────────────────────────────────────────────────────────

describe('initial render', () => {
  it('shows the email and recovery code fields', () => {
    renderRecovery();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/código de recuperación/i)).toBeInTheDocument();
  });

  it('shows the "Verificar código" submit button', () => {
    renderRecovery();
    expect(screen.getByRole('button', { name: /verificar código/i })).toBeInTheDocument();
  });

  it('has a link back to login', () => {
    renderRecovery();
    expect(screen.getByRole('link', { name: /volver al login/i })).toBeInTheDocument();
  });

  it('disables the submit button when fields are empty', () => {
    renderRecovery();
    expect(screen.getByRole('button', { name: /verificar código/i })).toBeDisabled();
  });
});

// ─── Form submission ──────────────────────────────────────────────────────────

describe('form step → newPassword step', () => {
  it('shows loading state while verifying code', async () => {
    // Never resolve so we can catch the loading state
    mockGetRecoveryData.mockReturnValue(new Promise(() => {}));

    renderRecovery();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/código de recuperación/i), { target: { value: 'ABCDABCDABCDABCDABCDABCDABCDABCD' } });
    fireEvent.click(screen.getByRole('button', { name: /verificar código/i }));

    expect(await screen.findByText(/verificando código/i)).toBeInTheDocument();
  });

  it('moves to newPassword step on successful code verification', async () => {
    const mockVaultKey = { type: 'secret', algorithm: { name: 'AES-GCM' } };
    mockGetRecoveryData.mockResolvedValue(MOCK_RECOVERY_DATA);
    mockDeriveRecoveryKey.mockResolvedValue('mockRecoveryKey');
    mockUnprotectVaultKey.mockResolvedValue(mockVaultKey);

    renderRecovery();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/código de recuperación/i), { target: { value: 'ABCDABCDABCDABCDABCDABCDABCDABCD' } });
    fireEvent.click(screen.getByRole('button', { name: /verificar código/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /nueva contraseña/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /actualizar contraseña/i })).toBeInTheDocument();
  });

  it('strips dashes from the recovery code before calling deriveRecoveryKey', async () => {
    const mockVaultKey = { type: 'secret' };
    mockGetRecoveryData.mockResolvedValue(MOCK_RECOVERY_DATA);
    mockDeriveRecoveryKey.mockResolvedValue('mockRecoveryKey');
    mockUnprotectVaultKey.mockResolvedValue(mockVaultKey);

    renderRecovery();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/código de recuperación/i), {
      target: { value: 'ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verificar código/i }));

    await waitFor(() => expect(mockDeriveRecoveryKey).toHaveBeenCalled());
    expect(mockDeriveRecoveryKey).toHaveBeenCalledWith(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
      expect.any(String),
      expect.any(Object),
    );
  });

  it('shows an error when recovery data fetch fails', async () => {
    mockGetRecoveryData.mockRejectedValue(new Error('Not found'));

    renderRecovery();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/código de recuperación/i), { target: { value: 'BADCODE' } });
    fireEvent.click(screen.getByRole('button', { name: /verificar código/i }));

    await waitFor(() =>
      expect(screen.getByText(/código de recuperación incorrecto/i)).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument(); // back to form
  });
});

// ─── New password step ────────────────────────────────────────────────────────

describe('newPassword step', () => {
  const setupNewPasswordStep = async () => {
    mockGetRecoveryData.mockResolvedValue(MOCK_RECOVERY_DATA);
    mockDeriveRecoveryKey.mockResolvedValue('mockRecoveryKey');
    mockUnprotectVaultKey.mockResolvedValue({ type: 'secret' });

    renderRecovery();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/código de recuperación/i), { target: { value: 'VALIDCODE12345678901234567890AB' } });
    fireEvent.click(screen.getByRole('button', { name: /verificar código/i }));

    await waitFor(() => screen.getByRole('button', { name: /actualizar contraseña/i }));
  };

  it('shows an error if passwords do not match', async () => {
    await setupNewPasswordStep();

    const newPass     = screen.getByPlaceholderText(/mínimo/i);
    const confirmPass = screen.getByPlaceholderText(/repite/i);
    fireEvent.change(newPass,     { target: { value: 'password123' } });
    fireEvent.change(confirmPass, { target: { value: 'different456' } });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    expect(screen.getByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
  });

  it('shows an error if new password is shorter than 12 characters', async () => {
    await setupNewPasswordStep();

    const newPass     = screen.getByPlaceholderText(/mínimo/i);
    const confirmPass = screen.getByPlaceholderText(/repite/i);
    fireEvent.change(newPass,     { target: { value: 'abc' } });
    fireEvent.change(confirmPass, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    expect(screen.getByText(/al menos 12 caracteres/i)).toBeInTheDocument();
  });

  it('shows done step after successful password update', async () => {
    await setupNewPasswordStep();

    mockDeriveMasterKey.mockResolvedValue({ encryptionKey: 'encKey', masterPasswordHash: 'hash' });
    mockProtectVaultKey.mockResolvedValue({ protectedSymmetricKey: 'psk', protectedSymmetricKeyIv: 'iv' });
    mockRecoverAccount.mockResolvedValue({});

    const newPass     = screen.getByPlaceholderText(/mínimo/i);
    const confirmPass = screen.getByPlaceholderText(/repite/i);
    fireEvent.change(newPass,     { target: { value: 'newSecurePass123' } });
    fireEvent.change(confirmPass, { target: { value: 'newSecurePass123' } });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    await waitFor(() =>
      expect(screen.getByText(/contraseña actualizada/i)).toBeInTheDocument(),
    );
  });

  it('calls recoverAccount with the correct payload', async () => {
    await setupNewPasswordStep();

    mockDeriveMasterKey.mockResolvedValue({ encryptionKey: 'encKey', masterPasswordHash: 'newhash' });
    mockProtectVaultKey.mockResolvedValue({ protectedSymmetricKey: 'newpsk', protectedSymmetricKeyIv: 'newiv' });
    mockRecoverAccount.mockResolvedValue({});

    const newPass     = screen.getByPlaceholderText(/mínimo/i);
    const confirmPass = screen.getByPlaceholderText(/repite/i);
    fireEvent.change(newPass,     { target: { value: 'newSecurePass123' } });
    fireEvent.change(confirmPass, { target: { value: 'newSecurePass123' } });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    await waitFor(() => expect(mockRecoverAccount).toHaveBeenCalled());
    expect(mockRecoverAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        email:                      'user@test.com',
        newMasterPasswordHash:      'newhash',
        newProtectedSymmetricKey:   'newpsk',
        newProtectedSymmetricKeyIv: 'newiv',
      }),
    );
  });
});

// ─── Done step ────────────────────────────────────────────────────────────────

describe('done step', () => {
  it('navigates to login when "Ir al login" is clicked', async () => {
    mockGetRecoveryData.mockResolvedValue(MOCK_RECOVERY_DATA);
    mockDeriveRecoveryKey.mockResolvedValue('key');
    mockUnprotectVaultKey.mockResolvedValue({ type: 'secret' });
    mockDeriveMasterKey.mockResolvedValue({ encryptionKey: 'enc', masterPasswordHash: 'h' });
    mockProtectVaultKey.mockResolvedValue({ protectedSymmetricKey: 'p', protectedSymmetricKeyIv: 'i' });
    mockRecoverAccount.mockResolvedValue({});

    renderRecovery();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/código de recuperación/i), { target: { value: 'VALIDCODE12345678901234567890AB' } });
    fireEvent.click(screen.getByRole('button', { name: /verificar código/i }));

    await waitFor(() => screen.getByRole('button', { name: /actualizar contraseña/i }));

    const newPass     = screen.getByPlaceholderText(/mínimo/i);
    const confirmPass = screen.getByPlaceholderText(/repite/i);
    fireEvent.change(newPass,     { target: { value: 'finalPassword1' } });
    fireEvent.change(confirmPass, { target: { value: 'finalPassword1' } });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    await waitFor(() => screen.getByRole('button', { name: /ir al login/i }));
    fireEvent.click(screen.getByRole('button', { name: /ir al login/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
