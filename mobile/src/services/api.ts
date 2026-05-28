import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/theme';
import { useSyncDiagnosticsStore } from '../store/syncDiagnosticsStore';

const resolveBaseUrl = (url: string) => {
  if (!url) return '';
  // Ensure the Axios calls target the /api subpath since Express routes are mounted under '/api'
  return url.endsWith('/api') ? url : `${url.replace(/\/$/, '')}/api`;
};

const api: AxiosInstance = axios.create({
  baseURL: resolveBaseUrl(API_BASE_URL),
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

let cachedAccessToken: string | null = null;

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

// ==========================================
// CIRCUIT BREAKER IMPLEMENTATION
// ==========================================
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private failureThreshold = 5;
  private cooldownPeriod = 10000; // 10s cooldown
  private nextAttemptTime = 0;

  public shouldAllowRequest(): boolean {
    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now > this.nextAttemptTime) {
        this.state = 'HALF_OPEN';
        console.log('[CircuitBreaker] Entering HALF-OPEN state, probing connection.');
        return true;
      }
      return false;
    }
    return true;
  }

  public recordSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  public recordFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.cooldownPeriod;
      console.warn(`[CircuitBreaker] Opened. Requests blocked for 10s.`);
    }
  }
}

const circuitBreaker = new CircuitBreaker();

// ==========================================
// REQUEST DEDUPLICATOR
// ==========================================
const inFlightRequests = new Map<string, Promise<any>>();

const getRequestKey = (config: any): string => {
  const method = config.method || 'get';
  const url = config.url || '';
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${method}:${url}:${params}`;
};

// ==========================================
// TOKEN REFRESH DEDUPLICATOR & QUEUE
// ==========================================
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (!circuitBreaker.shouldAllowRequest()) {
    return Promise.reject(new axios.AxiosError(
      'Backend service temporarily unavailable (Circuit Breaker Active)',
      'ECIRCUITBREAKER',
      config
    ));
  }

  // Inject startTime for diagnostics
  (config as any).metadata = { startTime: Date.now() };
  
  // Track burst requests
  useSyncDiagnosticsStore.getState().incrementRequestBurst();

  let token = cachedAccessToken;
  if (!token) {
    token = await SecureStore.getItemAsync('access_token');
    cachedAccessToken = token;
  }

  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto refresh on 401 & track circuit failures
api.interceptors.response.use(
  (response) => {
    circuitBreaker.recordSuccess();

    // Log request latency
    const metadata = (response.config as any).metadata;
    if (metadata?.startTime) {
      const duration = Date.now() - metadata.startTime;
      useSyncDiagnosticsStore.getState().recordApiResponseTime(duration);
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // Log error request latency
    const metadata = (originalRequest as any)?.metadata;
    if (metadata?.startTime) {
      const duration = Date.now() - metadata.startTime;
      useSyncDiagnosticsStore.getState().recordApiResponseTime(duration);
    }

    // Track circuit breaker states
    const isNetworkError = !error.response;
    const isServerError = status >= 500;
    if (isNetworkError || isServerError) {
      circuitBreaker.recordFailure();
    } else if (status < 500 && status !== 401) {
      circuitBreaker.recordSuccess();
    }

    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise(async (resolve, reject) => {
        try {
          const refreshToken = await SecureStore.getItemAsync('refresh_token');
          if (!refreshToken) {
            isRefreshing = false;
            reject(error);
            return;
          }

          const res = await axios.post(`${resolveBaseUrl(API_BASE_URL)}/v1/auth/refresh`, { refresh_token: refreshToken });
          const { access_token, refresh_token: newRefresh } = res.data.data.tokens;
          
          await SecureStore.setItemAsync('access_token', access_token);
          await SecureStore.setItemAsync('refresh_token', newRefresh);
          cachedAccessToken = access_token;
          
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          processQueue(null, access_token);
          resolve(api(originalRequest));
        } catch (err: any) {
          processQueue(err, null);
          const isNetworkError = !err.response;
          const isServerError = err.response?.status >= 500;
          if (!isNetworkError && !isServerError) {
            await SecureStore.deleteItemAsync('access_token');
            await SecureStore.deleteItemAsync('refresh_token');
            await SecureStore.deleteItemAsync('user_profile');
          }
          reject(err);
        } finally {
          isRefreshing = false;
        }
      });
    }
    return Promise.reject(error);
  }
);

// Transparently deduplicate GET requests on mobile
const originalGet = api.get;
api.get = function<T = any, R = any, D = any>(url: string, config?: any): Promise<R> {
  const requestKey = getRequestKey({ method: 'get', url, ...config });
  if (inFlightRequests.has(requestKey)) {
    return inFlightRequests.get(requestKey)! as any;
  }
  const promise = originalGet.call(api, url, config)
    .then((res) => {
      inFlightRequests.delete(requestKey);
      return res;
    })
    .catch((err) => {
      inFlightRequests.delete(requestKey);
      throw err;
    });
  inFlightRequests.set(requestKey, promise);
  return promise as any;
} as any;

export default api;

// Auth API
export const authAPI = {
  login: (data: { email_address: string; password: string }) => api.post('/v1/auth/login', data),
  register: (data: any) => api.post('/v1/auth/register', data),
  getProfile: () => api.get('/v1/auth/me'),
  logout: (refresh_token?: string) => api.post('/v1/auth/logout', { refresh_token }),
};

// Books API
export const booksAPI = {
  list: (params?: any) => api.get('/v1/books', { params }),
  get: (id: number) => api.get(`/v1/books/${id}`),
  create: (data: any) => api.post('/v1/books', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: number, data: any) => api.put(`/v1/books/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: number) => api.delete(`/v1/books/${id}`),
};

// Borrowings API
export const borrowingsAPI = {
  list: (params?: any) => api.get('/v1/borrowings', { params }),
  create: (data: { book_qr_id: number }) => api.post('/v1/borrowings', data),
  extend: (id: number) => api.patch(`/v1/borrowings/${id}/extend`),
  approve: (id: number) => api.patch(`/v1/borrowings/${id}/approve`),
  return: (id: number) => api.patch(`/v1/borrowings/${id}/return`),
  quickBorrow: (data: { student_id: number; qr_payload: string }) => api.post('/v1/borrowings/quick-borrow', data),
  quickReturn: (data: { qr_payload: string }) => api.post('/v1/borrowings/quick-return', data),
  searchStudent: (q: string) => api.get('/v1/borrowings/search-student', { params: { q } }),
};

// QR API
export const qrAPI = {
  list: (params?: any) => api.get('/v1/qr', { params }),
  get: (id: number) => api.get(`/v1/qr/${id}`),
  generate: (data: { book_id: number; quantity: number; custom_serial?: string }) =>
    api.post('/v1/qr/generate', data),
  scan: (data: { qr_payload: string; scan_type?: string; latitude?: number; longitude?: number }) =>
    api.post('/v1/qr/scan', data),
  download: (id: number) => api.get(`/v1/qr/${id}/download`),
  scanLogs: (params?: any) => api.get('/v1/qr/scan-logs', { params }),
  updateStatus: (id: number, status: string) => api.patch(`/v1/qr/${id}/status`, { qr_status: status }),
  delete: (id: number) => api.delete(`/v1/qr/${id}`),
};

// Notifications API
export const notificationsAPI = {
  list: (params?: any) => api.get('/v1/notifications', { params }),
  markRead: (id: number) => api.patch(`/v1/notifications/${id}/read`),
  markAllRead: () => api.patch('/v1/notifications/read-all'),
};

// Dashboard API
export const dashboardAPI = {
  superAdmin: () => api.get('/v1/dashboard/super-admin'),
  regencyAdmin: () => api.get('/v1/dashboard/regency-admin'),
  districtAdmin: () => api.get('/v1/dashboard/district-admin'),
  schoolAdmin: () => api.get('/v1/dashboard/school-admin'),
};


// Chat API
export const chatAPI = {
  listConversations: () => api.get('/v1/chat/conversations'),
  getMessages: (conversationId: number, params?: any) =>
    api.get(`/v1/chat/conversations/${conversationId}/messages`, { params }),
  sendMessage: (conversationId: number, message_text: string) =>
    api.post(`/v1/chat/conversations/${conversationId}/messages`, { message_text }),
  startConversation: (recipient_id: number) =>
    api.post('/v1/chat/conversations', { recipient_id }),
  markRead: (conversationId: number) =>
    api.patch(`/v1/chat/conversations/${conversationId}/read`),
  getRecipients: () => api.get('/v1/chat/recipients'),
};

// Inventory API
export const inventoryAPI = {
  runAudit: (school_id?: number) => api.post('/v1/inventory/audit', { school_id }),
  initializeStock: (school_id?: number) => api.post('/v1/inventory/initialize', { school_id }),
  getAnomalies: (params?: any) => api.get('/v1/inventory/anomalies', { params }),
  getQrTrace: (bookQrId: number) => api.get(`/v1/inventory/qr/${bookQrId}/trace`),
  markQrStatus: (bookQrId: number, qr_status: string, notes?: string) =>
    api.patch(`/v1/inventory/qr/${bookQrId}/status`, { qr_status, notes }),
  bulkUpdateStatus: (qr_ids: number[], qr_status: string, notes?: string) =>
    api.patch('/v1/inventory/qr/bulk-status', { qr_ids, qr_status, notes }),
  deleteAnomaly: (book_id: number) => api.delete(`/v1/inventory/anomalies/${book_id}`),
};

// Users API
export const usersAPI = {
  list: (params?: any) => api.get('/v1/users', { params }),
  get: (id: number) => api.get(`/v1/users/${id}`),
  create: (data: any) => api.post('/v1/users', data),
  update: (id: number, data: any) => api.put(`/v1/users/${id}`, data),
  delete: (id: number) => api.delete(`/v1/users/${id}`),
  updateProfile: (data: any) => api.put('/v1/users/profile', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  changePassword: (data: any) => api.put('/v1/users/change-password', data),
  import: (formData: FormData) => api.post('/v1/users/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// Regions & Schools API
export const regionsAPI = {
  listSchools: (params?: any) => api.get('/v1/regions/schools', { params }),
  getSchool: (id: number) => api.get(`/v1/regions/schools/${id}`),
  createSchool: (data: any) => api.post('/v1/regions/schools', data),
  updateSchool: (id: number, data: any) => api.put(`/v1/regions/schools/${id}`, data),
  deleteSchool: (id: number) => api.delete(`/v1/regions/schools/${id}`),

  listRegencies: (params?: any) => api.get('/v1/regions/regencies', { params }),
  createRegency: (data: any) => api.post('/v1/regions/regencies', data),
  updateRegency: (id: number, data: any) => api.put(`/v1/regions/regencies/${id}`, data),
  deleteRegency: (id: number) => api.delete(`/v1/regions/regencies/${id}`),

  listDistricts: (params?: any) => api.get('/v1/regions/districts', { params }),
  createDistrict: (data: any) => api.post('/v1/regions/districts', data),
  updateDistrict: (id: number, data: any) => api.put(`/v1/regions/districts/${id}`, data),
  deleteDistrict: (id: number) => api.delete(`/v1/regions/districts/${id}`),
};

// Categories API
export const categoriesAPI = {
  list: () => api.get('/v1/categories'),
  get: (id: number) => api.get(`/v1/categories/${id}`),
  create: (data: any) => api.post('/v1/categories', data),
  update: (id: number, data: any) => api.put(`/v1/categories/${id}`, data),
  delete: (id: number) => api.delete(`/v1/categories/${id}`),
};

// Reviews & Favorites API
export const reviewsAPI = {
  list: (params?: any) => api.get('/v1/reviews', { params }),
  create: (data: any) => api.post('/v1/reviews', data),
  update: (id: number, data: any) => api.put(`/v1/reviews/${id}`, data),
  delete: (id: number) => api.delete(`/v1/reviews/${id}`),

  listFavorites: () => api.get('/v1/reviews/favorites'),
  addFavorite: (data: any) => api.post('/v1/reviews/favorites', data),
  removeFavorite: (id: number) => api.delete(`/v1/reviews/favorites/${id}`),
};

// Library Settings API
export const settingsAPI = {
  get: (schoolId?: number) => api.get(schoolId ? `/v1/settings/${schoolId}` : '/v1/settings'),
  update: (data: any, schoolId?: number) => api.put(schoolId ? `/v1/settings/${schoolId}` : '/v1/settings', data),
  cleanup: () => api.post('/v1/settings/cleanup'),
};


