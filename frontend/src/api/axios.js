import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL });

// Helper to get image/doc full path from relative filename
export const getUploadUrl = (filename) => {
    const root = baseURL.endsWith('/api') ? baseURL.replace('/api', '') : baseURL;
    return `${root}/uploads/${filename}`;
};

/**
 * Request Interceptor:
 * Automatically adds the JWT token from localStorage to every API request.
 * This avoids needing to manually add headers in every component.
 */
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/**
 * Response Interceptor:
 * Watches for 401 (Unauthorized) errors globally.
 * If a token is invalid or expired, it clears storage and redirects to login.
 */
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('access_token');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
