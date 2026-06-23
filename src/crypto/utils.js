/** Genera un IV aleatorio de 12 bytes para AES-256-GCM. Nunca reutilizar el mismo IV con la misma key. */
export const generateIV = () => crypto.getRandomValues(new Uint8Array(12));

/**
 * Genera un salt aleatorio y lo devuelve codificado en Base64.
 * @param {number} [bytes=32] - Longitud del salt en bytes.
 * @returns {string} Salt en Base64.
 */
export const generateSalt = (bytes = 32) =>
  toBase64(crypto.getRandomValues(new Uint8Array(bytes)));

/**
 * Convierte un Uint8Array a un string Base64.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));

/**
 * Convierte un string Base64 a un Uint8Array.
 * @param {string} b64
 * @returns {Uint8Array}
 */
export const fromBase64 = (b64) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/**
 * Codifica un string UTF-8 a Uint8Array.
 * @param {string} str
 * @returns {Uint8Array}
 */
export const encode = (str) => new TextEncoder().encode(str);

/**
 * Decodifica un Uint8Array a string UTF-8.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export const decode = (bytes) => new TextDecoder().decode(bytes);
