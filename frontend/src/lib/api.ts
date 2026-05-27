import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

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

// Request interceptor — attach access token & check circuit breaker
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (!circuitBreaker.shouldAllowRequest()) {
      return Promise.reject(new axios.AxiosError(
        'Backend service temporarily unavailable (Circuit Breaker Active)',
        'ECIRCUITBREAKER',
        config
      ));
    }

    const token = Cookies.get('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 with token refresh & track circuit failures
api.interceptors.response.use(
  (response: AxiosResponse) => {
    circuitBreaker.recordSuccess();
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

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

      return new Promise((resolve, reject) => {
        const refreshToken = Cookies.get('refresh_token');
        if (!refreshToken) {
          isRefreshing = false;
          reject(error);
          return;
        }

        axios.post(`${API_BASE_URL}/v1/auth/refresh`, {
          refresh_token: refreshToken,
        })
          .then((res) => {
            const { access_token, refresh_token: newRefresh } = res.data.data.tokens;

            Cookies.set('access_token', access_token, { sameSite: 'strict', expires: 365, path: '/' });
            Cookies.set('refresh_token', newRefresh, { sameSite: 'strict', expires: 365, path: '/' });

            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            processQueue(null, access_token);
            resolve(api(originalRequest));
          })
          .catch((err) => {
            processQueue(err, null);
            Cookies.remove('access_token', { path: '/' });
            Cookies.remove('refresh_token', { path: '/' });
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            reject(err);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    return Promise.reject(error);
  }
);

// Transparently deduplicate GET requests
const originalGet = api.get;
api.get = function<T = any, R = AxiosResponse<T>, D = any>(this: any, url: string, config?: any): Promise<R> {
  const requestKey = getRequestKey({ method: 'get', url, ...config });
  if (inFlightRequests.has(requestKey)) {
    return inFlightRequests.get(requestKey)!;
  }
  const promise = originalGet.call(this, url, config)
    .then((res) => {
      inFlightRequests.delete(requestKey);
      return res;
    })
    .catch((err) => {
      inFlightRequests.delete(requestKey);
      throw err;
    }) as Promise<R>;
  inFlightRequests.set(requestKey, promise);
  return promise;
} as any;

export default api;

// Auth API
export const authAPI = {
  login: (data: { email_address: string; password: string }) =>
    api.post('/v1/auth/login', data),
  register: (data: any) => api.post('/v1/auth/register', data),
  refresh: (refresh_token: string) =>
    api.post('/v1/auth/refresh', { refresh_token }),
  logout: (refresh_token?: string) =>
    api.post('/v1/auth/logout', { refresh_token }),
  forgotPassword: (email_address: string) =>
    api.post('/v1/auth/forgot-password', { email_address }),
  resetPassword: (token: string, new_password: string) =>
    api.post('/v1/auth/reset-password', { token, new_password }),
  getProfile: () => api.get('/v1/auth/me'),
};

// Books API
export const booksAPI = {
  list: (params?: any) => api.get('/v1/books', { params }),
  get: (id: number) => api.get(`/v1/books/${id}`),
  create: (data: FormData) =>
    api.post('/v1/books', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: number, data: FormData) =>
    api.put(`/v1/books/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: number) => api.delete(`/v1/books/${id}`),
};

// Borrowings API
export const borrowingsAPI = {
  list: (params?: any) => api.get('/v1/borrowings', { params }),
  get: (id: number) => api.get(`/v1/borrowings/${id}`),
  create: (data: { book_qr_id: number }) => api.post('/v1/borrowings', data),
  approve: (id: number) => api.patch(`/v1/borrowings/${id}/approve`),
  return: (id: number) => api.patch(`/v1/borrowings/${id}/return`),
  extend: (id: number) => api.patch(`/v1/borrowings/${id}/extend`),
  quickBorrow: (data: { student_id: number; qr_payload: string }) => api.post('/v1/borrowings/quick-borrow', data),
  quickReturn: (data: { qr_payload: string }) => api.post('/v1/borrowings/quick-return', data),
  searchStudent: (q: string) => api.get('/v1/borrowings/search-student', { params: { q } }),
  delete: (id: number) => api.delete(`/v1/borrowings/${id}`),
  bulkDelete: (ids: number[]) => api.delete('/v1/borrowings', { data: { borrowing_ids: ids } }),
};

// Users API
export const usersAPI = {
  list: (params?: any) => api.get('/v1/users', { params }),
  get: (id: number) => api.get(`/v1/users/${id}`),
  create: (data: FormData) =>
    api.post('/v1/users', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: number, data: FormData) =>
    api.put(`/v1/users/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: number) => api.delete(`/v1/users/${id}`),
  importTemplate: (format?: string) => api.get('/v1/users/import-template', { params: format ? { format } : undefined, responseType: 'blob' }),
  import: (formData: FormData) => api.post('/v1/users/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateProfile: (data: FormData) =>
    api.put('/v1/users/profile', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.put('/v1/users/change-password', data),
};

// Dashboard API
export const dashboardAPI = {
  superAdmin: () => api.get('/v1/dashboard/super-admin'),
  regencyAdmin: () => api.get('/v1/dashboard/regency-admin'),
  districtAdmin: () => api.get('/v1/dashboard/district-admin'),
  schoolAdmin: () => api.get('/v1/dashboard/school-admin'),
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
  delete: (id: number) => api.delete(`/v1/notifications/${id}`),
};

// Regions API
export const regionsAPI = {
  listRegencies: () => api.get('/v1/regions/regencies'),
  getRegency: (id: number) => api.get(`/v1/regions/regencies/${id}`),
  createRegency: (data: any) => api.post('/v1/regions/regencies', data),
  updateRegency: (id: number, data: any) => api.put(`/v1/regions/regencies/${id}`, data),
  deleteRegency: (id: number) => api.delete(`/v1/regions/regencies/${id}`),
  listDistricts: (params?: any) => api.get('/v1/regions/districts', { params }),
  getDistrict: (id: number) => api.get(`/v1/regions/districts/${id}`),
  createDistrict: (data: any) => api.post('/v1/regions/districts', data),
  updateDistrict: (id: number, data: any) => api.put(`/v1/regions/districts/${id}`, data),
  deleteDistrict: (id: number) => api.delete(`/v1/regions/districts/${id}`),
  listSchools: (params?: any) => api.get('/v1/regions/schools', { params }),
  getSchool: (id: number) => api.get(`/v1/regions/schools/${id}`),
  createSchool: (data: any) => api.post('/v1/regions/schools', data),
  updateSchool: (id: number, data: any) => api.put(`/v1/regions/schools/${id}`, data),
  deleteSchool: (id: number) => api.delete(`/v1/regions/schools/${id}`),
};

// Categories API
export const categoriesAPI = {
  list: () => api.get('/v1/categories'),
  create: (data: { category_name: string }) => api.post('/v1/categories', data),
  update: (id: number, data: { category_name: string }) => api.put(`/v1/categories/${id}`, data),
  delete: (id: number) => api.delete(`/v1/categories/${id}`),
};

// Settings API
export const settingsAPI = {
  get: (schoolId?: number) => api.get(`/v1/settings/${schoolId || ''}`),
  update: (data: any, schoolId?: number) => api.put(`/v1/settings/${schoolId || ''}`, data),
  cleanup: () => api.post('/v1/settings/cleanup'),
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

// Helper to resolve media URLs dynamically based on API URL
export const getMediaUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};
