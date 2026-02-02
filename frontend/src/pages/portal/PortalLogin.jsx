import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const PortalLogin = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await axios.post('http://localhost:5000/api/portal/login', {
                username,
                password
            });

            localStorage.setItem('portalToken', res.data.access_token);
            localStorage.setItem('portalEmployee', JSON.stringify(res.data.employee));

            navigate('/portal/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: '#050A18', fontFamily: '"Outfit", sans-serif' }}>
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
                
                .glass-card {
                    background: rgba(26, 34, 53, 0.6);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 32px;
                    width: 90%;
                    max-width: 420px;
                }

                .neo-input {
                    background: rgba(255, 255, 255, 0.03) !important;
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    color: white !important;
                    border-radius: 18px !important;
                    padding: 16px 20px !important;
                    font-size: 15px !important;
                }

                .neo-input:focus {
                    border-color: #1877F2 !important;
                    box-shadow: 0 0 0 4px rgba(24, 119, 242, 0.1) !important;
                }

                .neo-btn {
                    background: #1877F2;
                    border: none;
                    border-radius: 18px;
                    padding: 16px;
                    font-weight: 700;
                    color: white;
                    box-shadow: 0 8px 24px rgba(24, 119, 242, 0.3);
                    transition: all 0.3s ease;
                    margin-top: 10px;
                }

                .neo-btn:active {
                    transform: scale(0.96);
                }

                .brand-logo {
                    width: 60px;
                    height: 60px;
                    background: #1877F2;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                    box-shadow: 0 8px 16px rgba(24, 119, 242, 0.4);
                }
                `}
            </style>

            <div className="glass-card p-5 text-white shadow-2xl">
                <div className="text-center mb-5">
                    <div className="brand-logo">
                        <i className="fa-solid fa-bolt-lightning fs-2"></i>
                    </div>
                    <h2 className="fw-bold mb-2">Employee Portal</h2>
                    <p className="text-muted small">Enter your credentials to access your dashboard</p>
                </div>

                {error && (
                    <div className="alert border-0 bg-danger bg-opacity-10 text-danger small rounded-4 p-3 mb-4 d-flex align-items-center">
                        <i className="fa-solid fa-circle-exclamation me-2"></i>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div className="mb-4">
                        <label className="text-muted small fw-bold mb-2 d-block text-uppercase" style={{ letterSpacing: '1px' }}>Username</label>
                        <input
                            type="text"
                            className="form-control neo-input"
                            placeholder="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="mb-5">
                        <label className="text-muted small fw-bold mb-2 d-block text-uppercase" style={{ letterSpacing: '1px' }}>Password</label>
                        <input
                            type="password"
                            className="form-control neo-input"
                            placeholder="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="neo-btn w-100 fs-6"
                    >
                        {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : 'Sign In Now'}
                    </button>
                </form>

                <div className="mt-5 text-center">
                    <p className="text-muted small">Not your account? <span className="text-primary cursor-pointer">Switch User</span></p>
                </div>
            </div>
        </div>
    );
};

export default PortalLogin;
