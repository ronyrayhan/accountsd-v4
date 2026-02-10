import axios from 'axios';

// Helper to get the backend base URL (for file viewing)
const getBackendBaseURL = () => {
    return import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
};

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL });

// Helper to securely fetch and view a file
export const viewFile = async (filename) => {
    try {
        const response = await api.get(`/files/${filename}`, {
            responseType: 'blob'
        });
        const contentType = response.headers['content-type'];
        const url = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));
        window.open(url, '_blank');
        // Clean up the URL object after some time to free memory
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Could not view file:', err);
        alert('Access denied or file not found.');
    }
};

// Legacy helper (deprecated due to security)
export const getUploadUrl = (filename) => {
    return '#'; // No longer direct link
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

export { getBackendBaseURL };
export default api;
