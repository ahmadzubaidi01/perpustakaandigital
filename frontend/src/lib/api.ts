import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach access token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = Cookies.get('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 with token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = Cookies.get('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const res = await axios.post(`${API_BASE_URL}/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: newRefresh } = res.data.data.tokens;

        Cookies.set('access_token', access_token, { sameSite: 'strict', expires: 365, path: '/' });
        Cookies.set('refresh_token', newRefresh, { sameSite: 'strict', expires: 365, path: '/' });

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch {
        Cookies.remove('access_token', { path: '/' });
        Cookies.remove('refresh_token', { path: '/' });
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

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
};

// Helper to resolve media URLs dynamically based on API URL
export const getMediaUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  // Return relative path so that Next.js rewrites/proxy handles it seamlessly
  return path.startsWith('/') ? path : `/${path}`;
};
