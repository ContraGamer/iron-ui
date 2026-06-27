// Almacén de tokens a nivel de módulo para que HttpService pueda leerlos
// sin necesitar hooks de React. AuthProvider mantiene este store sincronizado.
const REFRESH_KEY = btoa('ironkey-refresh');
const EMAIL_KEY   = btoa('ironkey-email');

let _accessToken = null;
let _onTokenUpdated = null;

export const tokenStore = {
  getAccess: () => _accessToken,

  setAccess: (token) => { _accessToken = token; },

  getRefresh: () => {
    const encoded = localStorage.getItem(REFRESH_KEY);
    if (!encoded) return null;
    try { return atob(encoded); } catch { return null; }
  },

  setRefresh: (token) => {
    if (token) localStorage.setItem(REFRESH_KEY, btoa(token));
    else localStorage.removeItem(REFRESH_KEY);
  },

  // Email guardado para mostrar en la pantalla de re-login al recargar la página.
  getEmail: () => {
    const encoded = localStorage.getItem(EMAIL_KEY);
    if (!encoded) return null;
    try { return atob(encoded); } catch { return null; }
  },

  setEmail: (email) => {
    if (email) localStorage.setItem(EMAIL_KEY, btoa(email));
    else localStorage.removeItem(EMAIL_KEY);
  },

  // AuthProvider registra este callback para mantener el estado React sincronizado
  onTokenUpdated: (cb) => { _onTokenUpdated = cb; },

  notifyTokenUpdate: (token) => {
    _accessToken = token;
    _onTokenUpdated?.(token);
  },

  clearAll: () => {
    _accessToken = null;
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EMAIL_KEY);
    _onTokenUpdated?.(null);
  },
};
