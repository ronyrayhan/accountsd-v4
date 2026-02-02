import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const PortalLeave = () => {
    const [balances, setBalances] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [form, setForm] = useState({
        leave_type_id: '',
        start_date: '',
        end_date: '',
        total_days: 1,
        reason: ''
    });
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('leave'); // Used for nav

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('portalToken');
            const headers = { Authorization: `Bearer ${token}` };

            const [balRes, historyRes, typesRes] = await Promise.all([
                axios.get('http://localhost:5000/api/portal/balances', { headers }),
                axios.get('http://localhost:5000/api/portal/leaves', { headers }),
                axios.get('http://localhost:5000/api/portal/leave-types', { headers })
            ]);

            setBalances(balRes.data);
            setLeaves(historyRes.data);
            setLeaveTypes(typesRes.data);
        } catch (err) {
            if (err.response?.status === 401) navigate('/portal/login');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (form.start_date && form.end_date) {
            const start = new Date(form.start_date);
            const end = new Date(form.end_date);

            if (end >= start) {
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                setForm(prev => ({ ...prev, total_days: diffDays }));
            } else {
                setForm(prev => ({ ...prev, total_days: 0 }));
            }
        }
    }, [form.start_date, form.end_date]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const selectedBal = balances.find(b => b.leave_type._id === form.leave_type_id);
        if (selectedBal && form.total_days > selectedBal.available) {
            alert(`Insufficient balance. You only have ${selectedBal.available} days left.`);
            return;
        }

        setSubmitting(true);
        try {
            const token = localStorage.getItem('portalToken');
            const formData = new FormData();
            Object.keys(form).forEach(key => formData.append(key, form[key]));
            selectedFiles.forEach(file => formData.append('attachments', file));

            await axios.post('http://localhost:5000/api/portal/apply', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setShowModal(false);
            setForm({ leave_type_id: '', start_date: '', end_date: '', total_days: 1, reason: '' });
            setSelectedFiles([]);
            fetchData();
            alert('Leave application submitted successfully');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to apply');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: '#000000' }}>
            <div className="spinner-border text-primary"></div>
        </div>
    );

    const getLeaveIcon = (code) => {
        if (code?.includes('SL')) return 'fa-briefcase-medical'; // Sick Leave
        if (code?.includes('AL')) return 'fa-umbrella-beach'; // Annual Leave
        return 'fa-clock';
    };

    const getLeaveColor = (code) => {
        if (code?.includes('SL')) return 'var(--warning)';
        if (code?.includes('AL')) return 'var(--success)';
        return 'var(--primary)';
    };

    return (
        <div className="app-wrapper">
            <style>
                {`
                :root {
                    --primary: rgba(13, 110, 253, 1);
                    --primary-light: rgba(13, 110, 253, 0.1);
                    --primary-glow: rgba(13, 110, 253, 0.3);
                    --success: #00D9A3;
                    --warning: #FF9F43;
                    --danger: #FF4242;
                    --dark: #0F1419;
                    --bg: #000000;
                    --card-bg: #1A1D24;
                    --border: rgba(255, 255, 255, 0.08);
                    --text: #FFFFFF;
                    --text-muted: #8B92A7;
                    --gradient-1: linear-gradient(135deg, rgba(13, 110, 253, 0.2) 0%, rgba(13, 110, 253, 0) 100%);
                }

                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

                .app-wrapper {
                    background: var(--bg);
                    color: var(--text);
                    font-family: 'Outfit', sans-serif;
                    min-height: 100vh;
                    position: relative;
                    padding-bottom: 90px;
                    overflow-x: hidden;
                }

                .app-wrapper::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 400px;
                    background: radial-gradient(circle at 50% 0%, var(--primary-glow), transparent 70%);
                    pointer-events: none;
                    z-index: 0;
                }

                .app-container {
                    position: relative;
                    z-index: 1;
                    max-width: 480px;
                    margin: 0 auto;
                    padding: 1rem;
                    animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .header { padding: 1.5rem 0; margin-bottom: 1.5rem; }
                .page-title {
                    font-size: 1.75rem;
                    font-weight: 700;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(135deg, var(--text) 0%, var(--text-muted) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .page-subtitle { color: var(--text-muted); font-size: 0.875rem; }

                .balance-scroller {
                    display: flex;
                    gap: 1rem;
                    overflow-x: auto;
                    padding-bottom: 1rem;
                    margin-bottom: 2rem;
                    scroll-behavior: smooth;
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .balance-scroller::-webkit-scrollbar { display: none; }

                .balance-card {
                    min-width: 160px;
                    background: var(--card-bg);
                    border: 1px solid var(--border);
                    border-radius: 20px;
                    padding: 1.25rem;
                    position: relative;
                    overflow: hidden;
                }
                
                .balance-icon {
                    width: 40px; height: 40px;
                    border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    margin-bottom: 1rem;
                    font-size: 1.25rem;
                    background: rgba(255,255,255,0.05);
                }

                .balance-info .label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 0.25rem; }
                .balance-info .value { font-family: 'JetBrains Mono', monospace; font-size: 1.75rem; font-weight: 700; color: var(--text); }
                .balance-info .unit { font-size: 0.75rem; color: var(--text-muted); font-weight: 500; font-family: 'Outfit', sans-serif; margin-left: 4px; }

                .action-btn {
                    width: 100%;
                    background: var(--primary);
                    color: white;
                    border: none;
                    padding: 1rem;
                    border-radius: 16px;
                    font-weight: 600;
                    font-size: 1rem;
                    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
                    margin-bottom: 2rem;
                    box-shadow: 0 8px 24px rgba(13, 110, 253, 0.4);
                    transition: transform 0.2s;
                }
                .action-btn:active { transform: scale(0.98); }

                .history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
                .history-title { font-size: 1.25rem; font-weight: 700; }
                .history-badge { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); padding: 0.375rem 0.75rem; border-radius: 100px; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }

                .leave-item {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 1rem;
                    margin-bottom: 0.75rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .leave-main { flex: 1; }
                .leave-type { font-weight: 600; font-size: 0.9rem; margin-bottom: 4px; }
                .leave-dates { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; }
                .leave-reason { font-size: 0.75rem; color: var(--text-muted); font-style: italic; }
                
                .leave-status {
                    text-align: right;
                    display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
                }
                .status-pill {
                    padding: 4px 10px; border-radius: 100px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
                }
                .status-days { font-family: 'JetBrains Mono', monospace; font-size: 1rem; font-weight: 700; }

                .bottom-nav {
                    position: fixed; bottom: 0; left: 0; right: 0;
                    background: var(--card-bg); border-top: 1px solid var(--border);
                    padding: 0.75rem 1rem; display: flex; justify-content: space-around;
                    align-items: center; z-index: 100; backdrop-filter: blur(20px);
                    max-width: 480px; margin: 0 auto;
                    padding-bottom: env(safe-area-inset-bottom);
                }
                .nav-item {
                    display: flex; flex-direction: column; align-items: center;
                    gap: 0.25rem; padding: 0.5rem 1rem; color: var(--text-muted);
                    text-decoration: none; transition: all 0.3s ease; border-radius: 12px; cursor: pointer;
                    background: transparent; border: none;
                }
                .nav-item.active { color: var(--primary); background: rgba(13, 110, 253, 0.1); }
                .nav-label { font-size: 0.6875rem; font-weight: 600; }

                /* Modal Styles */
                .custom-modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
                    z-index: 1000; display: flex; align-items: flex-end;
                }
                .custom-modal {
                    background: #1A1D24;
                    width: 100%;
                    max-width: 480px;
                    margin: 0 auto;
                    border-radius: 24px 24px 0 0;
                    border-top: 1px solid var(--border);
                    padding: 1.5rem;
                    animation: slideUpModal 0.3s ease-out;
                }
                @keyframes slideUpModal {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .form-group { margin-bottom: 1rem; }
                .form-label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem; display: block; }
                .form-input {
                    width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border);
                    padding: 0.875rem; border-radius: 12px; color: white; font-family: 'Outfit', sans-serif;
                }
                .form-input:focus { outline: none; border-color: var(--primary); }
                select.form-input { appearance: none; }
                `}
            </style>

            <div className="app-container">
                <div className="header">
                    <div className="page-title">Leaves 🌴</div>
                    <div className="page-subtitle">Manage your time off</div>
                </div>

                <div className="balance-scroller">
                    {balances.map((bal, idx) => (
                        <div key={idx} className="balance-card">
                            <div className="balance-icon" style={{ color: getLeaveColor(bal.leave_type.code) }}>
                                <i className={`fa-solid ${getLeaveIcon(bal.leave_type.code)}`}></i>
                            </div>
                            <div className="balance-info">
                                <div className="label">{bal.leave_type.name}</div>
                                <div>
                                    <span className="value">{bal.available}</span>
                                    <span className="unit">days</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <button className="action-btn" onClick={() => setShowModal(true)}>
                    <i className="fa-solid fa-plus"></i> New Request
                </button>

                <div className="history-header">
                    <div className="history-title">Recent History</div>
                    <div className="history-badge">{leaves.length} Requests</div>
                </div>

                <div className="leave-list pb-5">
                    {leaves.length > 0 ? leaves.map((leave, idx) => (
                        <div key={idx} className="leave-item" style={{ animation: 'slideUp 0.4s ease forwards', animationDelay: `${idx * 50}ms` }}>
                            <div className="leave-main">
                                <div className="leave-type">{leave.leave_type?.name}</div>
                                <div className="leave-dates">
                                    {new Date(leave.start_date).toLocaleDateString([], { month: 'short', day: 'numeric' })} → {new Date(leave.end_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </div>
                                {leave.reason && <div className="leave-reason">"{leave.reason}"</div>}
                            </div>
                            <div className="leave-status">
                                <span className="status-days" style={{ color: getLeaveColor(leave.leave_type?.code) }}>{leave.total_days} Days</span>
                                <div className="status-pill" style={{
                                    background: leave.status === 'Approved' ? 'rgba(0, 217, 163, 0.1)' : leave.status === 'Rejected' ? 'rgba(255, 66, 66, 0.1)' : 'rgba(255, 159, 67, 0.1)',
                                    color: leave.status === 'Approved' ? 'var(--success)' : leave.status === 'Rejected' ? 'var(--danger)' : 'var(--warning)'
                                }}>
                                    {leave.status}
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-5 text-muted">
                            <i className="fa-solid fa-wind fs-1 mb-3 opacity-25"></i>
                            <p className="small">No leave history found</p>
                        </div>
                    )}
                </div>

                {/* Bottom Nav */}
                <div className="bottom-nav">
                    <button className="nav-item" onClick={() => navigate('/portal/dashboard')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                            <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                        <span className="nav-label">Home</span>
                    </button>
                    <button className="nav-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                        <span className="nav-label">History</span>
                    </button>
                    <button className={`nav-item ${activeTab === 'leave' ? 'active' : ''}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span className="nav-label">Leave</span>
                    </button>
                    <button className="nav-item" onClick={() => navigate('/portal/dashboard')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <span className="nav-label">Profile</span>
                    </button>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="custom-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="custom-modal" onClick={e => e.stopPropagation()}>
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h3 className="fw-bold m-0 text-white">New Request</h3>
                            <button className="btn btn-sm btn-dark rounded-circle" onClick={() => setShowModal(false)}><i className="fa-solid fa-times"></i></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Leave Type</label>
                                <select className="form-input" required value={form.leave_type_id} onChange={e => setForm({ ...form, leave_type_id: e.target.value })}>
                                    <option value="" style={{ color: 'black' }}>Select Type...</option>
                                    {leaveTypes.map(t => <option key={t._id} value={t._id} style={{ color: 'black' }}>{t.name}</option>)}
                                </select>
                            </div>
                            <div className="row g-2">
                                <div className="col-6 form-group">
                                    <label className="form-label">Start Date</label>
                                    <input type="date" className="form-input" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                                </div>
                                <div className="col-6 form-group">
                                    <label className="form-label">End Date</label>
                                    <input type="date" className="form-input" required value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Reason</label>
                                <textarea className="form-input" rows="3" required value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Why do you need leave?"></textarea>
                            </div>

                            <button type="submit" disabled={submitting} className="action-btn mt-3 mb-0">
                                {submitting ? <span className="spinner-border spinner-border-sm"></span> : 'Submit Request'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortalLeave;
