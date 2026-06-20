import { generateIV, toBase64, fromBase64, encode, decode } from './utils.js';

// Cifra un objeto JSON con AES-256-GCM.
// Retorna un string "base64iv:base64ciphertext" para guardar como blob en el servidor.
export const encryptVaultItem = async (cryptoKey, dataObject) => {
  const iv = generateIV();
  const plaintext = encode(JSON.stringify(dataObject));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    plaintext,
  );

  return `${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
};

// Descifra un blob "base64iv:base64ciphertext" y retorna el objeto original.
export const decryptVaultItem = async (cryptoKey, encryptedBlob) => {
  const [ivB64, ciphertextB64] = encryptedBlob.split(':');
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(ciphertextB64);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext,
  );

  return JSON.parse(decode(plaintext));
};
