import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const api = axios.create({
    baseURL,
    withCredentials: true // Enable sending cookies (like refreshToken and _csrf) globally
});

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

let accessToken = null;
let cachedCsrfToken = null; // In-memory CSRF cache for extra reliability

/**
 * Update the in-memory access token.
 * This is called by AuthContext after login/refresh.
 */
export const setAccessToken = (token) => {
    accessToken = token;
};

/**
 * Request Interceptor:
 * 1. Automatically adds the in-memory JWT token to every API request.
 * 2. Fetches and attaches CSRF token if missing (for state-changing requests).
 */
api.interceptors.request.use(async (config) => {
    // Attach JWT if we have it in memory
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // CSRF Protection: Attach the token from cookie to the header
    // for state-changing methods.
    if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase())) {
        let csrfToken = cachedCsrfToken;

        // If not in cache, try reading from document.cookie
        if (!csrfToken) {
            csrfToken = document.cookie
                .split('; ')
                .find(row => row.startsWith('_csrf='))
                ?.split('=')[1];
        }

        // If still missing, fetch it from the API
        if (!csrfToken) {
            try {
                // Use the base axios to avoid recursion in the interceptor
                const res = await axios.get(`${baseURL}/csrf-token`, { withCredentials: true });
                csrfToken = res.data.csrfToken;
                cachedCsrfToken = csrfToken; // Cache it
            } catch (err) {
                console.error('Failed to pre-fetch CSRF token', err);
            }
        }

        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
        }
    }

    return config;
});

/**
 * Response Interceptor:
 * Watches for 401 (Unauthorized) errors globally.
 * If a token is invalid or expired, it tries to refresh.
 */
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If 401 and we haven't tried refreshing yet
        // and it's NOT the refresh-token request itself failing
        if (error.response && error.response.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/refresh-token')) {
            originalRequest._retry = true;
            try {
                // Call refresh endpoint (it uses the HTTP-only cookie behind the scenes)
                const res = await axios.post(`${baseURL}/refresh-token`, {}, { withCredentials: true });
                const newToken = res.data.access_token;

                setAccessToken(newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;

                // Retry the original request with the new instance (authenticated)
                return api(originalRequest);
            } catch (err) {
                // Refresh failed, clear user and redirect
                setAccessToken(null);
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
