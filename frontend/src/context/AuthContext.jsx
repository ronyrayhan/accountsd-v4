import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = async () => {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                const res = await api.get('/auth/me');
                setUser(res.data);
                return res.data;
            } catch (err) {
                localStorage.removeItem('access_token');
                setUser(null);
                return null;
            }
        }
        setLoading(false);
        return null;
    };

    useEffect(() => {
        const initAuth = async () => {
            await fetchUser();
            setLoading(false);
        };
        initAuth();
    }, []);

    const login = async (token, username) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('username', username);
        try {
            const res = await api.get('/auth/me');
            setUser(res.data);
            return res.data;
        } catch (err) {
            localStorage.removeItem('access_token');
            setUser(null);
            throw err;
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('username');
        setUser(null);
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
