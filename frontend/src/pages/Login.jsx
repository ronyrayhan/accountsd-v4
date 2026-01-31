import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { user, login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) navigate('/');
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/login', { username, password });
            await login(res.data.access_token, username);
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed');
        }
    };

    return (
        <div className="d-flex align-items-center justify-content-center vh-100" style={{ background: 'var(--bg-main)' }}>
            <div className="card login-card p-5 border-0" style={{ width: '450px' }}>
                <div className="text-center mb-5">
                    <div className="stats-icon-box mx-auto mb-3" style={{ width: '64px', height: '64px', borderRadius: '15px' }}>
                        <i className="fa-solid fa-rocket fs-2"></i>
                    </div>
                    <h2 className="fw-bold text-bright mb-1">AccountsD</h2>
                    <p className="text-muted small fw-medium">Sign in to your financial gateway</p>
                </div>

                {error && <div className="alert alert-danger bg-danger-light border-0 text-danger p-3 small text-center mb-4 rounded-3">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="form-label text-muted small fw-bold text-uppercase ls-1">Username / Admin ID</label>
                        <input
                            type="text"
                            className="form-control"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            placeholder="e.g. admin"
                            autoComplete="username"
                        />
                    </div>
                    <div className="mb-5">
                        <label className="form-label text-muted small fw-bold text-uppercase ls-1">Secret Key</label>
                        <input
                            type="password"
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            autoComplete="current-password"
                        />
                    </div>
                    <button type="submit" className="btn btn-primary w-100 py-3 mb-3">
                        Secure Authentication
                    </button>
                    <div className="text-center">
                        <span className="text-muted small">Systems Operational <i className="fa-solid fa-circle text-success ms-1" style={{ fontSize: '0.5rem' }}></i></span>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
