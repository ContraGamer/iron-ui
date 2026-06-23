import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock HttpService before importing AuthService
const mockGetApi    = vi.fn();
const mockPostApi   = vi.fn();
const mockDeleteApi = vi.fn();

vi.mock('../HttpService.jsx', () => ({
  default: () => ({
    getApi:    mockGetApi,
    postApi:   mockPostApi,
    deleteApi: mockDeleteApi,
  }),
}));

import AuthService from './AuthService.jsx';

const renderService = () => renderHook(() => AuthService()).result.current;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Auth endpoints ───────────────────────────────────────────────────────────

describe('getKdfParams', () => {
  it('calls GET /auth/kdf-params with email as query param', () => {
    const svc = renderService();
    svc.getKdfParams('user@test.com');
    expect(mockGetApi).toHaveBeenCalledWith(
      'api/v1/auth/kdf-params',
      { email: 'user@test.com' },
    );
  });
});

describe('register', () => {
  it('calls POST /auth/register with the provided payload', () => {
    const svc     = renderService();
    const payload = { email: 'a@b.com', masterPasswordHash: 'hash', kdfSalt: 'salt' };
    svc.register(payload);
    expect(mockPostApi).toHaveBeenCalledWith('api/v1/auth/register', payload);
  });
});

describe('login', () => {
  it('calls POST /auth/login with the provided payload', () => {
    const svc     = renderService();
    const payload = { email: 'a@b.com', masterPasswordHash: 'hash' };
    svc.login(payload);
    expect(mockPostApi).toHaveBeenCalledWith('api/v1/auth/login', payload);
  });

  it('includes totpCode in payload when provided', () => {
    const svc     = renderService();
    const payload = { email: 'a@b.com', masterPasswordHash: 'hash', totpCode: '123456' };
    svc.login(payload);
    expect(mockPostApi).toHaveBeenCalledWith('api/v1/auth/login', payload);
  });
});

describe('logout', () => {
  it('calls POST /auth/logout with no body', () => {
    const svc = renderService();
    svc.logout();
    expect(mockPostApi).toHaveBeenCalledWith('api/v1/auth/logout');
  });
});

// ─── Session endpoints ────────────────────────────────────────────────────────

describe('getSessions', () => {
  it('calls GET /auth/sessions', () => {
    const svc = renderService();
    svc.getSessions();
    expect(mockGetApi).toHaveBeenCalledWith('api/v1/auth/sessions');
  });
});

describe('deleteSession', () => {
  it('calls DELETE /auth/sessions/{id} with the given id', () => {
    const svc = renderService();
    svc.deleteSession('session-123');
    expect(mockDeleteApi).toHaveBeenCalledWith('api/v1/auth/sessions/session-123');
  });
});

// ─── 2FA endpoints ───────────────────────────────────────────────────────────

describe('setupTotp', () => {
  it('calls POST /auth/2fa/setup with no body', () => {
    const svc = renderService();
    svc.setupTotp();
    expect(mockPostApi).toHaveBeenCalledWith('api/v1/auth/2fa/setup');
  });
});

describe('verifyTotp', () => {
  it('calls POST /auth/2fa/verify with totpCode payload', () => {
    const svc = renderService();
    svc.verifyTotp({ totpCode: '123456' });
    expect(mockPostApi).toHaveBeenCalledWith('api/v1/auth/2fa/verify', { totpCode: '123456' });
  });
});

describe('deleteTotp', () => {
  it('calls DELETE /auth/2fa', () => {
    const svc = renderService();
    svc.deleteTotp();
    expect(mockDeleteApi).toHaveBeenCalledWith('api/v1/auth/2fa');
  });
});

// ─── Recovery endpoints ───────────────────────────────────────────────────────

describe('getRecoveryData', () => {
  it('calls GET /auth/recovery/data with email as query param', () => {
    const svc = renderService();
    svc.getRecoveryData('user@test.com');
    expect(mockGetApi).toHaveBeenCalledWith(
      'api/v1/auth/recovery/data',
      { email: 'user@test.com' },
    );
  });
});

describe('setupRecovery', () => {
  it('calls POST /auth/recovery/setup with the full payload', () => {
    const svc     = renderService();
    const payload = {
      totpCode:               '123456',
      recoveryCode:           'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
      recoveryProtectedKey:   'base64ciphertext',
      recoveryProtectedKeyIv: 'base64iv',
    };
    svc.setupRecovery(payload);
    expect(mockPostApi).toHaveBeenCalledWith('api/v1/auth/recovery/setup', payload);
  });
});

describe('deleteRecovery', () => {
  it('calls DELETE /auth/recovery with a totpCode in the body', () => {
    const svc = renderService();
    svc.deleteRecovery({ totpCode: '654321' });
    expect(mockDeleteApi).toHaveBeenCalledWith(
      'api/v1/auth/recovery',
      { totpCode: '654321' },
    );
  });
});

describe('recoverAccount', () => {
  it('calls POST /auth/recovery/recover with the full recovery payload', () => {
    const svc     = renderService();
    const payload = {
      email:                      'user@test.com',
      recoveryCode:               'RAWCODE32CHARS',
      newMasterPasswordHash:      'newhash',
      newProtectedSymmetricKey:   'newciphertext',
      newProtectedSymmetricKeyIv: 'newiv',
    };
    svc.recoverAccount(payload);
    expect(mockPostApi).toHaveBeenCalledWith('api/v1/auth/recovery/recover', payload);
  });
});
