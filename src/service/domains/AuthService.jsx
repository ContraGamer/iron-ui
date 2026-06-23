import { APIs } from '../../const/APIs.jsx';
import HttpService from '../HttpService.jsx';

/**
 * Hook de servicio para todos los endpoints de autenticación y recuperación de cuenta.
 * Encapsula las llamadas HTTP al backend de IronKey sin lógica de cifrado.
 * El cifrado es responsabilidad exclusiva del cliente (ver `src/crypto/kdf.js`).
 */
const AuthService = () => {
  const { getApi, postApi, deleteApi } = HttpService();

  /** Obtiene los parámetros KDF del usuario (salt, iterations, memory, parallelism). Endpoint público. */
  const getKdfParams = (email) =>
    getApi(APIs.AUTH.KDF_PARAMS, { email });

  /**
   * Registra un nuevo usuario. El payload debe incluir el hash de la master password
   * y la vault key ya cifrada en cliente — el servidor nunca ve la contraseña real.
   * @param {{ email, masterPasswordHash, kdfSalt, kdfType, kdfIterations, kdfMemory, kdfParallelism, protectedSymmetricKey, protectedSymmetricKeyIv }} payload
   */
  const register = (payload) =>
    postApi(APIs.AUTH.REGISTER, payload);

  /**
   * Inicia sesión. Incluye `totpCode` en el payload si el usuario tiene 2FA activo.
   * @param {{ email, masterPasswordHash, totpCode?: string }} payload
   * @returns {Promise<{ accessToken, refreshToken, protectedSymmetricKey, protectedSymmetricKeyIv }>}
   */
  const login = (payload) =>
    postApi(APIs.AUTH.LOGIN, payload);

  /** Cierra la sesión actual en el servidor y revoca el refresh token. */
  const logout = () =>
    postApi(APIs.AUTH.LOGOUT);

  /** Renueva el access token usando el refresh token. Usado internamente por HttpService. */
  const refresh = (refreshToken) =>
    postApi(APIs.AUTH.REFRESH, { refreshToken });

  /** Devuelve todas las sesiones activas del usuario. */
  const getSessions = () =>
    getApi(APIs.AUTH.SESSIONS);

  /** Revoca una sesión activa por su ID. */
  const deleteSession = (id) =>
    deleteApi(APIs.AUTH.SESSION_DELETE(id));

  /** Inicia el setup de 2FA. Devuelve `{ secret, qrCodeUri, qrCodeImage }`. */
  const setupTotp = () =>
    postApi(APIs.AUTH.TOTP_SETUP);

  /** Verifica y activa el 2FA con el código TOTP del usuario. */
  const verifyTotp = (payload) =>
    postApi(APIs.AUTH.TOTP_VERIFY, payload);

  /** Desactiva el 2FA. No requiere confirmación adicional. */
  const deleteTotp = () =>
    deleteApi(APIs.AUTH.TOTP_DELETE);

  // ─── Recovery ──────────────────────────────────────────────────────────────

  /**
   * Obtiene los datos necesarios para iniciar el flujo de recuperación de cuenta.
   * Endpoint público — no requiere autenticación.
   * @param {string} email
   * @returns {Promise<{ recoveryProtectedKey, recoveryProtectedKeyIv, kdfSalt, kdfIterations, kdfMemory, kdfParallelism }>}
   */
  const getRecoveryData = (email) =>
    getApi(APIs.AUTH.RECOVERY_DATA, { email });

  /**
   * Configura el código de recuperación. Requiere 2FA activo y la vault key ya cifrada con el recovery code.
   * El servidor almacena SHA-256(recoveryCode) — nunca el código en claro.
   * @param {{ totpCode, recoveryCode, recoveryProtectedKey, recoveryProtectedKeyIv }} payload
   */
  const setupRecovery = (payload) =>
    postApi(APIs.AUTH.RECOVERY_SETUP, payload);

  /**
   * Desactiva la recuperación de cuenta. Requiere TOTP para confirmar.
   * Los datos del recovery quedan en DB pero el hash se borra.
   * @param {{ totpCode: string }} payload
   */
  const deleteRecovery = (payload) =>
    deleteApi(APIs.AUTH.RECOVERY_DELETE, payload);

  /**
   * Recupera la cuenta con el recovery code y establece una nueva master password.
   * El servidor verifica SHA-256(recoveryCode), actualiza el hash de contraseña y la vault key cifrada,
   * y revoca todas las sesiones activas. Devuelve tokens para iniciar sesión.
   * @param {{ email, recoveryCode, newMasterPasswordHash, newProtectedSymmetricKey, newProtectedSymmetricKeyIv }} payload
   * @returns {Promise<{ accessToken, refreshToken, protectedSymmetricKey, protectedSymmetricKeyIv }>}
   */
  const recoverAccount = (payload) =>
    postApi(APIs.AUTH.RECOVERY_RECOVER, payload);

  return {
    getKdfParams,
    register,
    login,
    logout,
    refresh,
    getSessions,
    deleteSession,
    setupTotp,
    verifyTotp,
    deleteTotp,
    getRecoveryData,
    setupRecovery,
    deleteRecovery,
    recoverAccount,
  };
};

export default AuthService;
