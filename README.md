# IronKey UI

Frontend para [IronKey](https://testironkey.contragamer.com) — gestor de contraseñas self-hosted con cifrado zero-knowledge. Todo el cifrado ocurre en el cliente; el servidor nunca ve datos en texto plano.

## Stack

- **React 19** + Vite 8 — SPA con React Compiler habilitado
- **hash-wasm** — Argon2id en WebAssembly para derivación de claves (KDF)
- **Web Crypto API** — AES-256-GCM para cifrado de vault items y vault key
- **React Router 7** — rutas client-side con pantalla de unlock al recargar

## Arquitectura de cifrado (zero-knowledge)

```
master_password
      │
      ▼  Argon2id (params del servidor)  64 bytes
      ├── bytes[0..32]  → masterKey
      │       └─ SHA-256(masterKey ║ password) → masterPasswordHash  ──► servidor (auth)
      └── bytes[32..64] → stretchedKey
                └─ importKey → encryptionKey  (nunca sale del cliente)
                        └─ AES-256-GCM decrypt → vaultKey  (en memoria, se pierde al recargar)
                                └─ AES-256-GCM encrypt/decrypt vault items
```

- `masterPasswordHash` — lo único que llega al servidor para autenticación (el servidor aplica BCrypt encima)
- `encryptionKey` — deriva de la contraseña, nunca persiste ni se envía
- `vaultKey` — clave AES-256-GCM que cifra los items; se guarda en memoria (React state)
- Los vault items se almacenan en el servidor como blobs cifrados + IV separado

## Flujos principales

### Registro
1. Generar `kdfSalt` (32 bytes aleatorios) y `vaultKey` (AES-256-GCM aleatoria)
2. Derivar `encryptionKey` + `masterPasswordHash` con Argon2id
3. Cifrar `vaultKey` con `encryptionKey` → `protectedSymmetricKey` + IV
4. Enviar al servidor: `{ email, masterPasswordHash, kdfSalt, kdfParams, protectedSymmetricKey, protectedSymmetricKeyIv }`

### Login
1. `GET /auth/kdf-params?email=…` — obtener salt y params del servidor
2. Derivar `encryptionKey` + `masterPasswordHash` localmente
3. `POST /auth/login { email, masterPasswordHash, totpCode? }` → recibe `protectedSymmetricKey`
4. Descifrar la vault key con `encryptionKey` → `vaultKey` en memoria

### Vault item (crear/editar)
- El cliente cifra `{ name, url, username, password, notes }` con `vaultKey` (AES-256-GCM)
- Se envían dos campos separados al backend: `encryptedData` (ciphertext) e `iv` (nonce)
- El servidor almacena el blob sin descifrarlo

### Unlock (recarga de página)
- La `vaultKey` vive solo en memoria → se pierde al recargar
- Si hay `refreshToken` en `localStorage`, se muestra `/unlock` con el email pre-cargado
- El usuario re-ingresa su contraseña maestra para re-derivar la `vaultKey`

## Setup local

```bash
npm install
npm run dev        # http://localhost:5173
```

Variables de entorno (`.env.local`):
```
VITE_API_BASE_URL=http://localhost:8080/
```

## Tests

```bash
npm run test:run       # Vitest — 59 tests
npm run test:coverage  # Con cobertura
```

## Estructura

```
src/
├── crypto/
│   ├── kdf.js          # Argon2id, deriveMasterKey, protectVaultKey, recovery
│   ├── vault.js        # encryptVaultItem / decryptVaultItem (AES-256-GCM)
│   └── utils.js        # toBase64, fromBase64, generateIV, generateSalt
├── service/
│   ├── HttpService.jsx  # fetch + auto-refresh JWT en 401
│   ├── tokenStore.js    # accessToken en memoria, refreshToken en localStorage
│   └── domains/         # AuthService, VaultService, FolderService
├── context/
│   ├── AuthProvider.jsx     # accessToken + login/logout
│   └── VaultKeyProvider.jsx # vaultKey en memoria (nunca persiste)
└── pages/
    ├── login/    register/  unlock/  recovery/
    └── vault/    trash/     settings/
```

## Deploy

La imagen Docker se construye y publica automáticamente con Drone CI al hacer push a `main`:

```
registry.contragamer.com/ironkey-ui:latest
```

El stack completo (back + front + postgres + nginx) corre en `testironkey.contragamer.com` vía `docker compose`.

## Changelog

### fix: encryptedData e iv como campos separados (`8597b11`)
`encryptVaultItem` retornaba un string combinado `"base64(iv):base64(ciphertext)"` que el frontend enviaba como un único campo `encryptedData`. El backend (`CreateVaultItemRequest`) requiere `iv` como campo `@NotBlank` separado — todos los creates y updates fallaban con HTTP 400. La misma desincronización rompía el descifrado al leer items (el backend devuelve los campos separados en `VaultItemResponse`).

**Archivos afectados:** `src/crypto/vault.js`, `src/pages/vault/Vault.jsx`, `src/pages/trash/Trash.jsx`
