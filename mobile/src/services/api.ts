import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/theme';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');
        const res = await axios.post(`${API_BASE_URL}/v1/auth/refresh`, { refresh_token: refreshToken });
        const { access_token, refresh_token: newRefresh } = res.data.data.tokens;
        await SecureStore.setItemAsync('access_token', access_token);
        await SecureStore.setItemAsync('refresh_token', newRefresh);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

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
};

// Borrowings API
export const borrowingsAPI = {
  list: (params?: any) => api.get('/v1/borrowings', { params }),
  create: (data: { book_qr_id: number }) => api.post('/v1/borrowings', data),
  extend: (id: number) => api.patch(`/v1/borrowings/${id}/extend`),
  quickBorrow: (data: { student_id: number; qr_payload: string }) => api.post('/v1/borrowings/quick-borrow', data),
  quickReturn: (data: { qr_payload: string }) => api.post('/v1/borrowings/quick-return', data),
  searchStudent: (q: string) => api.get('/v1/borrowings/search-student', { params: { q } }),
};

// QR API
export const qrAPI = {
  scan: (data: { qr_payload: string; scan_type?: string; latitude?: number; longitude?: number }) =>
    api.post('/v1/qr/scan', data),
};

// Notifications API
export const notificationsAPI = {
  list: (params?: any) => api.get('/v1/notifications', { params }),
  markRead: (id: number) => api.patch(`/v1/notifications/${id}/read`),
  markAllRead: () => api.patch('/v1/notifications/read-all'),
};

// Dashboard API
export const dashboardAPI = {
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
};

