import { argon2id } from 'hash-wasm';
import { fromBase64, toBase64, encode, generateIV } from './utils.js';

/**
 * Parámetros Argon2id por defecto. Deben coincidir con los del backend.
 * En login, el servidor devuelve los params reales via GET /auth/kdf-params.
 * @type {{ kdfIterations: number, kdfMemory: number, kdfParallelism: number }}
 */
const KDF_DEFAULTS = {
  kdfIterations:   3,
  kdfMemory:       65536,  // 64 MB
  kdfParallelism:  4,
};

/**
 * Deriva la master key del usuario a partir de su contraseña maestra.
 *
 * Usa Argon2id con 64 bytes de salida:
 *   - Primeros 32 bytes → masterKey (usada para el hash de autenticación)
 *   - Últimos 32 bytes  → stretchedKey → encryptionKey (AES-256-GCM, descifra la vaultKey)
 *
 * El masterPasswordHash = SHA-256(masterKey || utf8(password)) se envía al servidor para auth.
 * La masterKey y la encryptionKey NUNCA salen del cliente.
 *
 * @param {string} masterPassword - Contraseña maestra del usuario.
 * @param {string} kdfSaltBase64  - KDF salt en Base64 (devuelto por GET /auth/kdf-params).
 * @param {object} [kdfParams]    - Parámetros Argon2id del servidor.
 * @returns {Promise<{ encryptionKey: CryptoKey, masterPasswordHash: string }>}
 */
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

/** Genera una vault key AES-256-GCM aleatoria. Se usa en el registro; nunca sale del cliente. */
export const generateVaultKey = async () =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

/**
 * Cifra la vault key con la encryption key derivada de la contraseña maestra.
 * Devuelve los campos separados que espera el DTO del backend.
 *
 * @param {CryptoKey} vaultKey      - Vault key a proteger.
 * @param {CryptoKey} encryptionKey - Clave de cifrado derivada de la master password.
 * @returns {Promise<{ protectedSymmetricKey: string, protectedSymmetricKeyIv: string }>}
 */
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

/**
 * Descifra el protectedSymmetricKey recibido del servidor y devuelve la vault key lista para usar.
 * Lanza si la clave de descifrado es incorrecta (autenticación AES-GCM falla).
 *
 * @param {string}    protectedSymmetricKey   - Vault key cifrada, en Base64.
 * @param {string}    protectedSymmetricKeyIv - IV usado al cifrar, en Base64.
 * @param {CryptoKey} encryptionKey           - Clave derivada de la master password.
 * @returns {Promise<CryptoKey>} Vault key lista para cifrar/descifrar items.
 */
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
    true,   // extractable: la vault key debe poder re-exportarse en el flujo de recovery
    ['encrypt', 'decrypt'],
  );
};

// ─── Recovery ────────────────────────────────────────────────────────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Genera un recovery code aleatorio de 32 caracteres en alfabeto base32.
 * El código raw (sin guiones) es el que se envía al servidor y se usa en `deriveRecoveryKey`.
 * @returns {string} 32 caracteres, solo [A-Z2-7].
 */
export const generateRecoveryCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => BASE32_ALPHABET[b % 32]).join('');
};

/**
 * Formatea un recovery code crudo en grupos de 4 separados por guiones para facilitar la lectura.
 * Ejemplo: 'ABCDEFGH' → 'ABCD-EFGH'.
 * @param {string} code - Recovery code sin guiones.
 * @returns {string}
 */
export const formatRecoveryCode = (code) =>
  code.match(/.{1,4}/g)?.join('-') ?? code;

/**
 * Deriva una CryptoKey AES-256-GCM a partir del recovery code del usuario.
 * Usa los mismos parámetros KDF que la master key, con el recovery code como contraseña.
 * Se usa para cifrar la vault key en el setup y descifrarla en el recover.
 *
 * IMPORTANTE: el recovery code nunca debe guardarse en localStorage ni en estado persistente.
 *
 * @param {string} recoveryCode    - Recovery code raw (sin guiones).
 * @param {string} kdfSaltBase64   - KDF salt del usuario en Base64 (mismo que el de la master key).
 * @param {object} [kdfParams]     - Parámetros Argon2id del servidor.
 * @returns {Promise<CryptoKey>}
 */
export const deriveRecoveryKey = async (recoveryCode, kdfSaltBase64, kdfParams = {}) => {
  const { kdfIterations, kdfMemory, kdfParallelism } = { ...KDF_DEFAULTS, ...kdfParams };
  const salt = fromBase64(kdfSaltBase64);

  const output = await argon2id({
    password:    recoveryCode,
    salt,
    parallelism: kdfParallelism,
    iterations:  kdfIterations,
    memorySize:  kdfMemory,
    hashLength:  32,
    outputType:  'binary',
  });

  return crypto.subtle.importKey('raw', output, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
};
