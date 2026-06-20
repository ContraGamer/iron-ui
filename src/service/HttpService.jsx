import { APIs } from '../const/APIs.jsx';
import { tokenStore } from './tokenStore.js';

const DEFAULT_BASE_URL = 'http://localhost:8080/';

const resolveBaseUrl = () => import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL;

const joinUrl = (base, endpoint) =>
  `${base.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;

const buildQueryString = (query) => {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, v);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  const text = await response.text();
  return text || null;
};

const createHeaders = (token, customHeaders = {}) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...customHeaders,
});

// Bandera para evitar múltiples refreshes simultáneos
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  refreshQueue = [];
};

const doRefresh = async () => {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error('No refresh token disponible');

  const response = await fetch(joinUrl(resolveBaseUrl(), APIs.AUTH.REFRESH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    tokenStore.clearAll();
    throw new Error('Sesión expirada');
  }

  const data = await response.json();
  tokenStore.notifyTokenUpdate(data.accessToken);
  if (data.refreshToken) tokenStore.setRefresh(data.refreshToken);
  return data.accessToken;
};

const request = async (method, endpoint, options = {}, retry = true) => {
  const { body, query, headers } = options;
  const token = tokenStore.getAccess();
  const url = `${joinUrl(resolveBaseUrl(), endpoint)}${buildQueryString(query)}`;

  const config = {
    method,
    headers: createHeaders(token, headers),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const response = await fetch(url, config);

  // Auto-refresh en 401
  if (response.status === 401 && retry) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((newToken) => {
        config.headers = createHeaders(newToken, headers);
        return fetch(url, config).then(async (r) => {
          const payload = await parseResponse(r);
          if (!r.ok) throw payload || { message: 'Error', code: -1 };
          return payload;
        });
      });
    }

    isRefreshing = true;
    try {
      const newToken = await doRefresh();
      processQueue(null, newToken);
      config.headers = createHeaders(newToken, headers);
      const retryResponse = await fetch(url, config);
      const payload = await parseResponse(retryResponse);
      if (!retryResponse.ok) throw payload || { message: 'Error', code: -1 };
      return payload;
    } catch (err) {
      processQueue(err, null);
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  const payload = await parseResponse(response);
  if (!response.ok) throw payload || { message: 'Error genérico', code: -1 };
  return payload;
};

const HttpService = () => {
  const getApi    = (endpoint, query, headers) => request('GET', endpoint, { query, headers });
  const postApi   = (endpoint, body, query, headers) => request('POST', endpoint, { body, query, headers });
  const putApi    = (endpoint, body, query, headers) => request('PUT', endpoint, { body, query, headers });
  const deleteApi = (endpoint, query, headers) => request('DELETE', endpoint, { query, headers });

  return { getApi, postApi, putApi, deleteApi };
};

export default HttpService;
