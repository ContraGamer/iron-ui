import { argon2id } from 'hash-wasm';
import { fromBase64, toBase64 } from './utils.js';
import { encryptVaultItem, decryptVaultItem } from './vault.js';

// Parámetros Argon2id — deben coincidir con los del backend
const ARGON2_PARAMS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536, // 64 MB
  hashLength: 64,    // 64 bytes: primeros 32 → enc key, últimos 32 → auth hash
  outputType: 'binary',
};

// Deriva la master key a partir de la contraseña maestra y el KDF salt.
// Retorna:
//   encryptionKey — CryptoKey (AES-256-GCM) para cifrar/descifrar el vault key
//   masterPasswordHash — base64 que se envía al backend para verificar login
export const deriveMasterKey = async (masterPassword, kdfSaltBase64) => {
  const salt = fromBase64(kdfSaltBase64);

  const output = await argon2id({
    password: masterPassword,
    salt,
    ...ARGON2_PARAMS,
  });

  const encKeyBytes  = output.slice(0, 32);  // → AES-256 key
  const hashInput    = output.slice(32, 64); // → base del hash de autenticación

  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    encKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );

  const hashBuffer = await crypto.subtle.digest('SHA-256', hashInput);
  const masterPasswordHash = toBase64(new Uint8Array(hashBuffer));

  return { encryptionKey, masterPasswordHash };
};

// Genera una vault key aleatoria (AES-256-GCM). Se usa en el registro.
export const generateVaultKey = async () =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

// Cifra la vault key con la master encryption key para guardarla en el servidor.
export const protectVaultKey = async (vaultKey, masterEncryptionKey) => {
  const raw = await crypto.subtle.exportKey('raw', vaultKey);
  return encryptVaultItem(masterEncryptionKey, { k: toBase64(new Uint8Array(raw)) });
};

// Descifra el protected_symmetric_key recibido del servidor y devuelve la vault key.
export const unprotectVaultKey = async (protectedSymmetricKey, masterEncryptionKey) => {
  const data = await decryptVaultItem(masterEncryptionKey, protectedSymmetricKey);
  return crypto.subtle.importKey(
    'raw',
    fromBase64(data.k),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
};
