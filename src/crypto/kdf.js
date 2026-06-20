import { argon2id } from 'hash-wasm';
import { fromBase64, toBase64, encode, generateIV } from './utils.js';

// Parámetros Argon2id por defecto — deben coincidir con los del backend.
// En login se usan los que devuelve el servidor via GET /auth/kdf-params.
const KDF_DEFAULTS = {
  kdfIterations:   3,
  kdfMemory:       65536,  // 64 MB
  kdfParallelism:  4,
};

// Deriva la master key a partir de la contraseña maestra y el KDF salt.
// Acepta kdfParams opcionales (del servidor) para usar en login.
// Retorna:
//   encryptionKey       — CryptoKey (AES-256-GCM) derivada de stretchedKey
//   masterPasswordHash  — base64 SHA-256(masterKey || password) enviado al backend
export const deriveMasterKey = async (masterPassword, kdfSaltBase64, kdfParams = {}) => {
  const { kdfIterations, kdfMemory, kdfParallelism } = { ...KDF_DEFAULTS, ...kdfParams };
  const salt = fromBase64(kdfSaltBase64);

  const output = await argon2id({
    password:    masterPassword,
    salt,
    parallelism: kdfParallelism,
    iterations:  kdfIterations,
    memorySize:  kdfMemory,
    hashLength:  64,          // 64 bytes: primeros 32 → masterKey, últimos 32 → stretchedKey
    outputType:  'binary',
  });

  const masterKey    = output.slice(0, 32);
  const stretchedKey = output.slice(32, 64);

  // masterPasswordHash = SHA-256(masterKey || encode(masterPassword))
  const pwBytes   = encode(masterPassword);
  const hashInput = new Uint8Array(masterKey.length + pwBytes.length);
  hashInput.set(masterKey, 0);
  hashInput.set(pwBytes, masterKey.length);
  const hashBuffer       = await crypto.subtle.digest('SHA-256', hashInput);
  const masterPasswordHash = toBase64(new Uint8Array(hashBuffer));

  // encryptionKey se deriva de stretchedKey (no de masterKey)
  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    stretchedKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );

  return { encryptionKey, masterPasswordHash };
};

// Genera una vault key aleatoria (AES-256-GCM). Se usa en el registro.
export const generateVaultKey = async () =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

// Cifra la vault key con la encryption key y devuelve campos separados
// para el DTO del backend: { protectedSymmetricKey, protectedSymmetricKeyIv }
export const protectVaultKey = async (vaultKey, encryptionKey) => {
  const raw = await crypto.subtle.exportKey('raw', vaultKey);
  const iv  = generateIV();

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    raw,
  );

  return {
    protectedSymmetricKey:   toBase64(new Uint8Array(ciphertext)),
    protectedSymmetricKeyIv: toBase64(iv),
  };
};

// Descifra el protected_symmetric_key recibido del servidor (campos separados)
// y devuelve la vault key como CryptoKey lista para usar.
export const unprotectVaultKey = async (protectedSymmetricKey, protectedSymmetricKeyIv, encryptionKey) => {
  const iv         = fromBase64(protectedSymmetricKeyIv);
  const ciphertext = fromBase64(protectedSymmetricKey);

  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    ciphertext,
  );

  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
};
