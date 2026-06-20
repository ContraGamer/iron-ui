import { APIs } from '../../const/APIs.jsx';
import HttpService from '../HttpService.jsx';

const AuthService = () => {
  const { getApi, postApi, deleteApi } = HttpService();

  const getKdfParams = (email) =>
    getApi(APIs.AUTH.KDF_PARAMS, { email });

  const register = (payload) =>
    postApi(APIs.AUTH.REGISTER, payload);

  const login = (payload) =>
    postApi(APIs.AUTH.LOGIN, payload);

  const logout = () =>
    postApi(APIs.AUTH.LOGOUT);

  const refresh = (refreshToken) =>
    postApi(APIs.AUTH.REFRESH, { refreshToken });

  const getSessions = () =>
    getApi(APIs.AUTH.SESSIONS);

  const deleteSession = (id) =>
    deleteApi(APIs.AUTH.SESSION_DELETE(id));

  const setupTotp = () =>
    postApi(APIs.AUTH.TOTP_SETUP);

  const verifyTotp = (payload) =>
    postApi(APIs.AUTH.TOTP_VERIFY, payload);

  const deleteTotp = () =>
    deleteApi(APIs.AUTH.TOTP_DELETE);

  const setupRecovery = () =>
    postApi(APIs.AUTH.RECOVERY_SETUP);

  const deleteRecovery = () =>
    deleteApi(APIs.AUTH.RECOVERY_DELETE);

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
    setupRecovery,
    deleteRecovery,
    recoverAccount,
  };
};

export default AuthService;
