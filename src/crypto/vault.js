import { generateIV, toBase64, fromBase64, encode, decode } from './utils.js';

// Cifra un objeto JSON con AES-256-GCM.
// Retorna { encryptedData, iv } como campos separados para el DTO del backend.
export const encryptVaultItem = async (cryptoKey, dataObject) => {
  const iv = generateIV();
  const plaintext = encode(JSON.stringify(dataObject));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    plaintext,
  );

  return {
    encryptedData: toBase64(new Uint8Array(ciphertext)),
    iv:            toBase64(iv),
  };
};

// Descifra un ítem usando los campos separados que devuelve el backend.
export const decryptVaultItem = async (cryptoKey, encryptedData, iv) => {
  const ivBytes    = fromBase64(iv);
  const ciphertext = fromBase64(encryptedData);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    cryptoKey,
    ciphertext,
  );

  return JSON.parse(decode(plaintext));
};
