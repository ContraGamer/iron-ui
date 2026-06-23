import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64, generateSalt } from './utils.js';

// Mock hash-wasm: argon2id is slow (runs Argon2id in WebAssembly).
// Tests verify the logic around the KDF, not the KDF algorithm itself.
vi.mock('hash-wasm', () => ({
  argon2id: vi.fn(),
}));

import { argon2id } from 'hash-wasm';
import {
  deriveMasterKey,
  generateVaultKey,
  protectVaultKey,
  unprotectVaultKey,
  generateRecoveryCode,
  formatRecoveryCode,
  deriveRecoveryKey,
} from './kdf.js';

// Fixed 64-byte output used for master key tests (deterministic)
const MOCK_MASTER_OUTPUT = new Uint8Array(64).fill(0xab);
// Fixed 32-byte output used for recovery key tests
const MOCK_RECOVERY_OUTPUT = new Uint8Array(32).fill(0xcd);

const MOCK_KDF_PARAMS = {
  kdfIterations:  3,
  kdfMemory:      65536,
  kdfParallelism: 4,
};

const MOCK_KDF_SALT = generateSalt(32); // random base64 salt

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── deriveMasterKey ──────────────────────────────────────────────────────────

describe('deriveMasterKey', () => {
  beforeEach(() => {
    argon2id.mockResolvedValue(MOCK_MASTER_OUTPUT);
  });

  it('calls argon2id with 64-byte hashLength and correct params', async () => {
    await deriveMasterKey('password', MOCK_KDF_SALT, MOCK_KDF_PARAMS);

    expect(argon2id).toHaveBeenCalledWith(
      expect.objectContaining({
        password:    'password',
        hashLength:  64,
        parallelism: MOCK_KDF_PARAMS.kdfParallelism,
        iterations:  MOCK_KDF_PARAMS.kdfIterations,
        memorySize:  MOCK_KDF_PARAMS.kdfMemory,
        outputType:  'binary',
      }),
    );
  });

  it('returns a CryptoKey as encryptionKey', async () => {
    const { encryptionKey } = await deriveMasterKey('password', MOCK_KDF_SALT, MOCK_KDF_PARAMS);
    expect(encryptionKey).toBeInstanceOf(CryptoKey);
    expect(encryptionKey.algorithm.name).toBe('AES-GCM');
  });

  it('returns a base64 string as masterPasswordHash', async () => {
    const { masterPasswordHash } = await deriveMasterKey('password', MOCK_KDF_SALT, MOCK_KDF_PARAMS);
    expect(typeof masterPasswordHash).toBe('string');
    // base64 of 32-byte SHA-256 → always 44 chars (with padding)
    expect(masterPasswordHash).toHaveLength(44);
  });

  it('produces a deterministic masterPasswordHash for the same inputs', async () => {
    const r1 = await deriveMasterKey('myPassword', MOCK_KDF_SALT, MOCK_KDF_PARAMS);
    const r2 = await deriveMasterKey('myPassword', MOCK_KDF_SALT, MOCK_KDF_PARAMS);
    expect(r1.masterPasswordHash).toBe(r2.masterPasswordHash);
  });

  it('produces a different masterPasswordHash for different passwords', async () => {
    const r1 = await deriveMasterKey('password1', MOCK_KDF_SALT, MOCK_KDF_PARAMS);
    // Make argon2id return different bytes for the second call to simulate different input
    argon2id.mockResolvedValueOnce(new Uint8Array(64).fill(0x11));
    const r2 = await deriveMasterKey('password2', MOCK_KDF_SALT, MOCK_KDF_PARAMS);
    expect(r1.masterPasswordHash).not.toBe(r2.masterPasswordHash);
  });

  it('uses KDF_DEFAULTS when no params are passed', async () => {
    await deriveMasterKey('password', MOCK_KDF_SALT);
    expect(argon2id).toHaveBeenCalledWith(
      expect.objectContaining({ iterations: 3, memorySize: 65536, parallelism: 4 }),
    );
  });
});

// ─── generateVaultKey ─────────────────────────────────────────────────────────

describe('generateVaultKey', () => {
  it('returns a CryptoKey for AES-GCM', async () => {
    const key = await generateVaultKey();
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.algorithm.name).toBe('AES-GCM');
    expect(key.algorithm.length).toBe(256);
  });

  it('generates unique keys on each call', async () => {
    const k1 = await generateVaultKey();
    const k2 = await generateVaultKey();
    const raw1 = await crypto.subtle.exportKey('raw', k1);
    const raw2 = await crypto.subtle.exportKey('raw', k2);
    expect(toBase64(new Uint8Array(raw1))).not.toBe(toBase64(new Uint8Array(raw2)));
  });
});

// ─── protectVaultKey / unprotectVaultKey ─────────────────────────────────────

describe('protectVaultKey / unprotectVaultKey', () => {
  it('encrypts and decrypts the vault key to the original bytes', async () => {
    const vaultKey      = await generateVaultKey();
    const encryptionKey = await generateVaultKey(); // any AES-GCM key works as encryption key

    const { protectedSymmetricKey, protectedSymmetricKeyIv } = await protectVaultKey(vaultKey, encryptionKey);

    expect(typeof protectedSymmetricKey).toBe('string');
    expect(typeof protectedSymmetricKeyIv).toBe('string');

    const recovered = await unprotectVaultKey(protectedSymmetricKey, protectedSymmetricKeyIv, encryptionKey);
    expect(recovered).toBeInstanceOf(CryptoKey);

    // Verify the recovered key encrypts/decrypts the same data as the original
    const plaintext   = new TextEncoder().encode('test data');
    const iv          = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, plaintext);
    const decrypted   = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, recovered, ciphertext);
    expect(new TextDecoder().decode(decrypted)).toBe('test data');
  });

  it('generates a different IV on each call to protectVaultKey', async () => {
    const vaultKey      = await generateVaultKey();
    const encryptionKey = await generateVaultKey();

    const r1 = await protectVaultKey(vaultKey, encryptionKey);
    const r2 = await protectVaultKey(vaultKey, encryptionKey);

    expect(r1.protectedSymmetricKeyIv).not.toBe(r2.protectedSymmetricKeyIv);
  });

  it('throws when decrypting with the wrong key', async () => {
    const vaultKey      = await generateVaultKey();
    const encryptionKey = await generateVaultKey();
    const wrongKey      = await generateVaultKey();

    const { protectedSymmetricKey, protectedSymmetricKeyIv } = await protectVaultKey(vaultKey, encryptionKey);

    await expect(
      unprotectVaultKey(protectedSymmetricKey, protectedSymmetricKeyIv, wrongKey),
    ).rejects.toThrow();
  });
});

// ─── generateRecoveryCode ─────────────────────────────────────────────────────

describe('generateRecoveryCode', () => {
  const BASE32 = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.split(''));

  it('returns a string of exactly 32 characters', () => {
    expect(generateRecoveryCode()).toHaveLength(32);
  });

  it('only contains valid base32 characters', () => {
    const code = generateRecoveryCode();
    expect(code.split('').every((c) => BASE32.has(c))).toBe(true);
  });

  it('generates unique codes on each call', () => {
    expect(generateRecoveryCode()).not.toBe(generateRecoveryCode());
  });
});

// ─── formatRecoveryCode ──────────────────────────────────────────────────────

describe('formatRecoveryCode', () => {
  it('inserts dashes every 4 characters', () => {
    const formatted = formatRecoveryCode('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');
    expect(formatted).toBe('ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567');
  });

  it('returns the original value when length is not a multiple of 4', () => {
    const code = 'ABCDE';
    const formatted = formatRecoveryCode(code);
    expect(formatted).toBe('ABCD-E');
  });
});

// ─── deriveRecoveryKey ────────────────────────────────────────────────────────

describe('deriveRecoveryKey', () => {
  beforeEach(() => {
    argon2id.mockResolvedValue(MOCK_RECOVERY_OUTPUT);
  });

  it('calls argon2id with 32-byte hashLength', async () => {
    await deriveRecoveryKey('MYRECOVERYCODE', MOCK_KDF_SALT, MOCK_KDF_PARAMS);

    expect(argon2id).toHaveBeenCalledWith(
      expect.objectContaining({
        password:   'MYRECOVERYCODE',
        hashLength: 32,
        outputType: 'binary',
      }),
    );
  });

  it('returns a CryptoKey for AES-GCM', async () => {
    const key = await deriveRecoveryKey('MYCODE', MOCK_KDF_SALT, MOCK_KDF_PARAMS);
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('produces a CryptoKey that can encrypt/decrypt vault data', async () => {
    const recoveryKey = await deriveRecoveryKey('MYCODE', MOCK_KDF_SALT, MOCK_KDF_PARAMS);
    const plaintext   = new TextEncoder().encode('vault item data');
    const iv          = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, recoveryKey, plaintext);
    const decrypted  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, recoveryKey, ciphertext);

    expect(new TextDecoder().decode(decrypted)).toBe('vault item data');
  });
});

// ─── Full recovery round-trip ─────────────────────────────────────────────────

describe('Recovery round-trip (setup → recover)', () => {
  it('recovers the vault key using the recovery code and re-protects it with a new master key', async () => {
    // Setup phase
    argon2id.mockResolvedValueOnce(MOCK_RECOVERY_OUTPUT); // deriveRecoveryKey call
    const recoveryKey = await deriveRecoveryKey('TESTRECOVERYCODE', MOCK_KDF_SALT, MOCK_KDF_PARAMS);

    const vaultKey = await generateVaultKey();
    const { protectedSymmetricKey: recoveryProtectedKey, protectedSymmetricKeyIv: recoveryProtectedKeyIv } =
      await protectVaultKey(vaultKey, recoveryKey);

    // Recovery phase: derive recovery key again (same code → same output)
    argon2id.mockResolvedValueOnce(MOCK_RECOVERY_OUTPUT);
    const recoveredRecoveryKey = await deriveRecoveryKey('TESTRECOVERYCODE', MOCK_KDF_SALT, MOCK_KDF_PARAMS);
    const recoveredVaultKey = await unprotectVaultKey(recoveryProtectedKey, recoveryProtectedKeyIv, recoveredRecoveryKey);

    // Re-protect with new master key
    argon2id.mockResolvedValueOnce(MOCK_MASTER_OUTPUT); // deriveMasterKey call
    const { encryptionKey: newEncKey } = await deriveMasterKey('newPassword', MOCK_KDF_SALT, MOCK_KDF_PARAMS);
    const { protectedSymmetricKey: newPSK, protectedSymmetricKeyIv: newPSKIv } =
      await protectVaultKey(recoveredVaultKey, newEncKey);

    // Verify new PSK decrypts to same vault key
    const finalVaultKey = await unprotectVaultKey(newPSK, newPSKIv, newEncKey);

    const testData   = new TextEncoder().encode('my secret password');
    const iv         = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, testData);
    const decrypted  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, finalVaultKey, ciphertext);

    expect(new TextDecoder().decode(decrypted)).toBe('my secret password');
  });
});
