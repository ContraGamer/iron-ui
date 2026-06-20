// Genera un IV aleatorio de 12 bytes para AES-256-GCM
export const generateIV = () => crypto.getRandomValues(new Uint8Array(12));

// Genera un salt aleatorio y lo devuelve en Base64
export const generateSalt = (bytes = 32) =>
  toBase64(crypto.getRandomValues(new Uint8Array(bytes)));

// Uint8Array → Base64 string
export const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));

// Base64 string → Uint8Array
export const fromBase64 = (b64) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

// string → Uint8Array (UTF-8)
export const encode = (str) => new TextEncoder().encode(str);

// Uint8Array → string (UTF-8)
export const decode = (bytes) => new TextDecoder().decode(bytes);
