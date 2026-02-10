// Utility to get the backend base URL from environment variable
// This replaces hardcoded localhost:5000 URLs throughout the application

export const getBackendURL = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    // Remove '/api' suffix to get base URL
    return apiUrl.replace('/api', '');
};

// Helper to construct file URLs
export const getFileURL = (filePath) => {
    if (!filePath) return '';
    return `${getBackendURL()}/${filePath}`;
};
