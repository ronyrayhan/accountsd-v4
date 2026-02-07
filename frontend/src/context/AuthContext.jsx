import React, { createContext, useState, useEffect, useContext } from 'react';
import api, { setAccessToken } from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = async () => {
        try {
            // First attempt to get an access token via refresh token cookie
            // This happens silently via the axios interceptor if we get a 401,
            // but we can also trigger it manually on mount.
            const refreshRes = await api.post('/refresh-token');
            const token = refreshRes.data.access_token;
            setAccessToken(token);
            setToken(token);

            const res = await api.get('/auth/me');
            console.log('AuthContext: User data fetched', {
                username: res.data.username,
                role: res.data.role,
                navigationGroups: res.data.navigation?.length,
                modules: res.data.modules
            });
            setUser(res.data);
            return res.data;
        } catch (err) {
            console.error('AuthContext: Failed to fetch user or refresh token', err);
            setAccessToken(null);
            setUser(null);
            return null;
        }
    };

    useEffect(() => {
        const initAuth = async () => {
            // Try to restore session on load
            await fetchUser();
            setLoading(false);
        };
        initAuth();
    }, []);

    const login = async (token, username) => {
        setAccessToken(token);
        localStorage.setItem('username', username);
        try {
            const res = await api.get('/auth/me');
            setToken(token);
            setUser(res.data);
            return res.data;
        } catch (err) {
            setAccessToken(null);
            setUser(null);
            throw err;
        }
    };

    const logout = () => {
        setAccessToken(null);
        setToken(null);
        localStorage.removeItem('username');
        setUser(null);
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, setUser, token, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
