import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const PortalDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [punching, setPunching] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activeTab, setActiveTab] = useState('home');
    const [historyFilter, setHistoryFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM or YYYY-MM-DD
    const [historyFilterMode, setHistoryFilterMode] = useState('month'); // 'month' or 'date'
    const [expandedGroups, setExpandedGroups] = useState([]);
    const navigate = useNavigate();
    const employee = JSON.parse(localStorage.getItem('portalEmployee') || '{}');

    const fetchDashboard = async () => {
        try {
            const token = localStorage.getItem('portalToken');
            const res = await axios.get('http://localhost:5000/api/portal/dashboard', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(res.data);
        } catch (err) {
            if (err.response?.status === 401) handleLogout();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem('portalToken')) {
            navigate('/portal/login');
        } else {
            fetchDashboard();
        }

        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handlePunch = async () => {
        setPunching(true);
        try {
            const token = localStorage.getItem('portalToken');
            await axios.post('http://localhost:5000/api/portal/punch', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchDashboard();
        } catch (err) {
            alert(err.response?.data?.message || 'Action failed');
        } finally {
            setPunching(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('portalToken');
        localStorage.removeItem('portalEmployee');
        navigate('/portal/login');
    };

    if (loading) return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: '#000000' }}>
            <div className="spinner-border text-primary"></div>
        </div>
    );

    const isCheckedIn = data?.today?.is_checked_in;
    const todaySummary = data?.today?.summary;
    const todaySegments = todaySummary?.segments || [];
    const history = data?.history || [];

    const formatDuration = (totalHours) => {
        const h = Math.floor(totalHours);
        const m = Math.floor((totalHours % 1) * 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    const getTotalDayHours = () => {
        let hours = parseFloat(todaySummary?.total_hours || 0);
        if (isCheckedIn && todaySegments.length > 0) {
            const lastSegment = todaySegments[todaySegments.length - 1];
            if (!lastSegment.punch_out) {
                const duration = (currentTime - new Date(lastSegment.punch_in)) / (1000 * 60 * 60);
                hours += duration;
            }
        }
        return formatDuration(hours);
    };

    const getCurrentSessionHours = () => {
        if (!isCheckedIn || todaySegments.length === 0) return "0:00";
        const lastSegment = todaySegments[todaySegments.length - 1];
        if (lastSegment.punch_out) return "0:00";
        const duration = (currentTime - new Date(lastSegment.punch_in)) / (1000 * 60 * 60);
        return formatDuration(duration);
    };

    const combinedActivity = [
        ...todaySegments.map(s => ({
            date: todaySummary.date,
            punch_in: s.punch_in,
            punch_out: s.punch_out,
            duration: s.duration ? s.duration.toFixed(2) : '--',
            isToday: true,
            status: s.punch_out ? 'Full' : 'Ongoing'
        })).reverse(),
        ...history.map(h => ({
            date: h.date,
            punch_in: h.punch_in,
            punch_out: h.punch_out,
            duration: h.total_hours,
            isToday: false,
            status: h.status
        }))
    ];

    const getGroupedHistory = () => {
        const filtered = combinedActivity.filter(h => {
            const date = new Date(h.date);
            // Use local time for correct day filtering
            const year = date.getFullYear();
            const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
            const dayStr = date.getDate().toString().padStart(2, '0');

            const month = `${year}-${monthStr}`;
            const day = `${year}-${monthStr}-${dayStr}`;

            return historyFilterMode === 'month' ? month === historyFilter : day === historyFilter;
        });

        const groups = {};
        filtered.forEach(item => {
            const dateKey = new Date(item.date).toDateString();
            if (!groups[dateKey]) {
                groups[dateKey] = {
                    totalHours: 0,
                    firstPunch: null,
                    lastPunch: null,
                    punchCount: 0,
                    items: []
                };
            }

            const punchIn = new Date(item.punch_in);
            const punchOut = item.punch_out ? new Date(item.punch_out) : null;

            // Track first and last of the day
            if (!groups[dateKey].firstPunch || punchIn < groups[dateKey].firstPunch) groups[dateKey].firstPunch = punchIn;
            if (punchOut && (!groups[dateKey].lastPunch || punchOut > groups[dateKey].lastPunch)) groups[dateKey].lastPunch = punchOut;
            if (!punchOut && (!groups[dateKey].lastPunch || currentTime > groups[dateKey].lastPunch)) groups[dateKey].lastPunch = currentTime;

            groups[dateKey].totalHours += parseFloat(item.duration) || 0;
            groups[dateKey].punchCount += item.punch_out ? 2 : 1;
            groups[dateKey].items.push(item);
        });

        // Format for display
        const result = {};
        Object.keys(groups).forEach(key => {
            const g = groups[key];
            result[key] = {
                ...g,
                totalHoursStr: formatDuration(g.totalHours),
                fromTime: g.firstPunch ? g.firstPunch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--',
                toTime: g.lastPunch ? g.lastPunch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Present',
            };
        });
        return result;
    };

    const toggleGroup = (date) => {
        setExpandedGroups(prev =>
            prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
        );
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour >= 5 && hour < 12) return 'Morning';
        if (hour >= 12 && hour < 18) return 'Afternoon';
        return 'Evening';
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

                .header { padding: 1.5rem 0; margin-bottom: 0.5rem; }
                .greeting { font-size: 1rem; color: var(--text-muted); margin-bottom: 0.25rem; }
                .user-name {
                    font-size: 1.75rem;
                    font-weight: 700;
                    margin-bottom: 1.5rem;
                    background: linear-gradient(135deg, var(--text) 0%, var(--text-muted) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .datetime-card {
                    background: var(--card-bg);
                    border-radius: 20px;
                    padding: 1.25rem;
                    border: 1px solid var(--border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    backdrop-filter: blur(10px);
                    position: relative;
                    overflow: hidden;
                }

                .datetime-card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: var(--gradient-1); opacity: 0.5;
                }

                .datetime-content { position: relative; z-index: 1; }
                .date-display { font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.25rem; font-weight: 500; }
                .time-display {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 2rem;
                    font-weight: 600;
                    color: var(--text);
                    letter-spacing: -0.02em;
                }

                .datetime-icon {
                    position: relative;
                    z-index: 1;
                    width: 48px; height: 48px;
                    background: var(--primary);
                    border-radius: 14px;
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 8px 24px rgba(13, 110, 253, 0.4);
                }

                @keyframes ripple {
                    0% { box-shadow: 0 0 0 0 var(--primary-glow), 0 0 0 0.5rem var(--primary-glow); }
                    100% { box-shadow: 0 0 0 0.5rem var(--primary-glow), 0 0 0 1rem transparent; }
                }
                .datetime-icon.pulse { animation: ripple 2s ease-out infinite; }

                .checkin-card {
                    background: var(--card-bg);
                    border-radius: 24px;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                    border: 1px solid var(--border);
                    position: relative;
                    overflow: hidden;
                    margin-top: 1.5rem;
                }

                .checkin-card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: var(--gradient-1);
                }

                .checkin-content { position: relative; z-index: 1; }
                .status-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                .status-badge {
                    display: inline-flex; align-items: center; gap: 0.5rem;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 0.5rem 1rem; border-radius: 100px;
                    border: 1px solid var(--border); font-size: 0.875rem; font-weight: 500;
                }
                .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); transition: all 0.3s; }
                .status-badge.active .status-dot { background: var(--success); box-shadow: 0 0 12px var(--success); animation: statusPulse 2s ease-in-out infinite; }
                @keyframes statusPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.95); } }

                .times-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
                .time-box { background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); border-radius: 16px; padding: 1rem; }
                .time-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; font-weight: 600; }
                .time-value { font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 600; color: var(--text); }

                .check-button {
                    width: 100%; height: 60px;
                    background: var(--primary); color: white; border: none; border-radius: 16px;
                    font-size: 1.1rem; font-weight: 600; cursor: pointer;
                    box-shadow: 0 8px 24px rgba(13, 110, 253, 0.4);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    display: flex; align-items: center; justify-content: center;
                }
                .check-button:active { transform: scale(0.98); }
                .check-button.checked-out { background: var(--warning); box-shadow: 0 8px 24px rgba(255, 159, 67, 0.4); }

                .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
                .stat-card {
                    background: var(--card-bg); border: 1px solid var(--border); border-radius: 20px;
                    padding: 1.25rem; position: relative; overflow: hidden;
                }
                .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--primary); }
                .stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; font-weight: 600; }
                .stat-value { font-family: 'JetBrains Mono', monospace; font-size: 1.75rem; font-weight: 700; color: var(--text); margin-bottom: 0.25rem; }
                .stat-subtitle { font-size: 0.75rem; color: var(--text-muted); }

                .history-section {
                    background: var(--card-bg); border: 1px solid var(--border); border-radius: 24px;
                    padding: 1.5rem; position: relative; overflow: hidden;
                }
                .history-section::before {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                    background: var(--gradient-1);
                }
                .history-content { position: relative; z-index: 1; }
                .history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
                .history-title { font-size: 1.25rem; font-weight: 700; }
                .history-badge { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); padding: 0.375rem 0.75rem; border-radius: 100px; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
                .history-list { display: flex; flex-direction: column; gap: 0.75rem; }
                
                .history-item {
                    background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); border-radius: 16px;
                    padding: 1rem; display: flex; justify-content: space-between; align-items: center;
                }
                .history-date { font-size: 0.875rem; font-weight: 600; margin-bottom: 0.25rem; }
                .history-times { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--text-muted); }
                .history-duration { font-family: 'JetBrains Mono', monospace; font-size: 1.25rem; font-weight: 700; color: var(--primary); text-align: right; }
                .history-status { font-size: 0.625rem; color: var(--text-muted); text-align: right; margin-top: 0.25rem; }

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

                /* Profile specific */
                .profile-header { text-align: center; padding: 2rem 0; }
                .profile-avatar {
                    width: 100px; height: 100px; background: var(--primary);
                    border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    font-size: 2rem; font-weight: 800; margin: 0 auto 1.5rem;
                    box-shadow: 0 0 30px var(--primary-glow);
                }
                .setting-item {
                    display: flex; align-items: center; gap: 1rem; padding: 1.25rem;
                    border-bottom: 1px solid var(--border); cursor: pointer;
                }
                .setting-icon { 
                    width: 40px; height: 40px; background: rgba(255,255,255,0.05);
                    border-radius: 12px; display: flex; align-items: center; justify-content: center;
                    color: var(--text-muted);
                }
                .logout-btn {
                    margin-top: 2rem; padding: 1.25rem; background: rgba(255,66,66,0.1);
                    border: 1px solid rgba(255,66,66,0.2); color: #FF4242;
                    border-radius: 16px; width: 100%; font-weight: 700;
                    display: flex; align-items: center; justify-content: center; gap: 0.75rem;
                }
                @keyframes pulse-dot {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 0.5; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .pulse-dot-live {
                    animation: pulse-dot 2s infinite;
                }
                .filter-select {
                    background: var(--card-bg);
                    color: white;
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 8px 16px;
                    font-family: 'Outfit', sans-serif;
                    font-size: 0.9rem;
                    outline: none;
                }
                .date-group-header {
                    font-size: 0.75rem;
                    color: var(--primary);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    font-weight: 700;
                    margin: 1.5rem 0 0.75rem 0.5rem;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .date-group-header::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: linear-gradient(90deg, var(--border), transparent);
                }
                .summary-card {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 1.25rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .summary-card:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: var(--primary);
                }
                .summary-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 10px;
                    margin-top: 10px;
                }
                .summary-stat {
                    display: flex;
                    flex-direction: column;
                }
                .summary-label {
                    font-size: 0.65rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    margin-bottom: 2px;
                }
                .summary-value {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text);
                }
                .mode-toggle {
                    display: flex;
                    background: rgba(255,255,255,0.05);
                    border-radius: 10px;
                    padding: 4px;
                    margin-bottom: 15px;
                }
                .mode-btn {
                    flex: 1;
                    border: none;
                    background: transparent;
                    color: var(--text-muted);
                    font-size: 0.75rem;
                    font-weight: 600;
                    padding: 6px;
                    border-radius: 8px;
                    transition: all 0.3s;
                }
                .mode-btn.active {
                    background: var(--primary);
                    color: white;
                }
                `}
            </style>

            <div className="app-container">
                {activeTab === 'home' && (
                    <>
                        <div className="header">
                            <div className="greeting">Good {getGreeting()}</div>
                            <div className="user-name">Welcome Back</div>

                            <div className="datetime-card">
                                <div className="datetime-content">
                                    <div className="date-display">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                    <div className="time-display">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                                    <div className="mt-2 d-flex flex-column gap-1" style={{ transition: 'all 0.3s ease' }}>
                                        {isCheckedIn ? (
                                            <>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="pulse-dot-live" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }}></div>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: '600', letterSpacing: '0.5px' }}>SESSION: {getCurrentSessionHours()}</span>
                                                </div>
                                                <div className="d-flex align-items-center gap-2" style={{ paddingLeft: '16px' }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Today: {getTotalDayHours()}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1px' }}>Off the clock</span>
                                        )}
                                    </div>
                                </div>
                                <div className="datetime-icon pulse">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="checkin-card">
                            <div className="checkin-content">
                                <div className="status-row">
                                    <div className={`status-badge ${isCheckedIn ? 'active' : ''}`}>
                                        <span className="status-dot"></span>
                                        <span>{isCheckedIn ? 'Checked In' : 'Not Checked In'}</span>
                                    </div>
                                </div>

                                <div className="times-grid">
                                    <div className="time-box">
                                        <div className="time-label">Check In</div>
                                        <div className="time-value">
                                            {todaySegments.length > 0 ? new Date(todaySegments[todaySegments.length - 1].punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                                        </div>
                                    </div>
                                    <div className="time-box">
                                        <div className="time-label">Check Out</div>
                                        <div className="time-value">
                                            {todaySegments.length > 0 && todaySegments[todaySegments.length - 1].punch_out
                                                ? new Date(todaySegments[todaySegments.length - 1].punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                                                : '--:--'}
                                        </div>
                                    </div>
                                </div>

                                <button className={`check-button ${isCheckedIn ? 'checked-out' : ''}`} onClick={handlePunch} disabled={punching}>
                                    {punching ? <span className="spinner-border spinner-border-sm"></span> : <span>{isCheckedIn ? 'Check Out Now' : 'Check In Now'}</span>}
                                </button>
                            </div>
                        </div>

                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-label">Today's Hours</div>
                                <div className="stat-value">{getTotalDayHours()}</div>
                                <div className="stat-subtitle">Time tracked</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Target Hours</div>
                                <div className="stat-value">8:00</div>
                                <div className="stat-subtitle">Standard day</div>
                            </div>
                        </div>

                        <div className="history-section">
                            <div className="history-content">
                                <div className="history-header">
                                    <div className="history-title">Recent Activity</div>
                                    <div className="history-badge" onClick={() => setActiveTab('history')} style={{ cursor: 'pointer' }}>View All</div>
                                </div>

                                <div className="history-list">
                                    {combinedActivity.length > 0 ? combinedActivity.slice(0, 6).map((h, idx) => (
                                        <div key={idx} className="history-item" style={{ animation: 'fade-enter 0.3s ease forwards', animationDelay: `${idx * 50}ms` }}>
                                            <div className="history-info">
                                                <div className="history-date">
                                                    {h.isToday ? 'Today' : new Date(h.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </div>
                                                <div className="history-times">
                                                    {new Date(h.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} → {h.punch_out ? new Date(h.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Ongoing'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="history-duration">{h.duration}</div>
                                                <div className="history-status" style={{ color: h.status === 'Late' ? 'var(--warning)' : 'var(--text-muted)' }}>{h.status || 'Present'}</div>
                                            </div>
                                        </div>
                                    )) : <div className="text-center py-4 text-muted small">No activity yet</div>}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'history' && (
                    <div style={{ animation: 'slideUp 0.6s ease' }}>
                        <div className="header mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h2 className="fw-bold m-0">History</h2>
                                <input
                                    type={historyFilterMode === 'month' ? 'month' : 'date'}
                                    className="filter-select"
                                    value={historyFilter}
                                    onChange={(e) => setHistoryFilter(e.target.value)}
                                />
                            </div>
                            <div className="mode-toggle">
                                <button className={`mode-btn ${historyFilterMode === 'month' ? 'active' : ''}`} onClick={() => { setHistoryFilterMode('month'); setHistoryFilter(new Date().toISOString().slice(0, 7)); }}>MONTHLY</button>
                                <button className={`mode-btn ${historyFilterMode === 'date' ? 'active' : ''}`} onClick={() => { setHistoryFilterMode('date'); setHistoryFilter(new Date().toISOString().slice(0, 10)); }}>DAILY</button>
                            </div>
                        </div>

                        <div className="history-section mb-5">
                            <div className="history-content">
                                {Object.keys(getGroupedHistory()).length > 0 ? Object.entries(getGroupedHistory()).map(([date, data]) => (
                                    <div key={date} className="mb-3">
                                        <div className="summary-card" onClick={() => toggleGroup(date)}>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div className="fw-bold" style={{ color: 'var(--primary)' }}>{date}</div>
                                                <i className={`fa-solid fa-chevron-${expandedGroups.includes(date) ? 'up' : 'down'} text-muted small`}></i>
                                            </div>
                                            <div className="summary-grid">
                                                <div className="summary-stat">
                                                    <span className="summary-label">Worked</span>
                                                    <span className="summary-value">{data.totalHoursStr}</span>
                                                </div>
                                                <div className="summary-stat">
                                                    <span className="summary-label">Range</span>
                                                    <span className="summary-value" style={{ fontSize: '0.85rem' }}>{data.fromTime} - {data.toTime}</span>
                                                </div>
                                                <div className="summary-stat">
                                                    <span className="summary-label">Punches</span>
                                                    <span className="summary-value">{data.punchCount}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {expandedGroups.includes(date) && (
                                            <div className="history-list mt-2 ps-2" style={{ borderLeft: '2px solid var(--primary-light)', paddingLeft: '1rem', animation: 'fadeIn 0.3s ease' }}>
                                                {data.items.map((h, idx) => (
                                                    <div key={idx} className="history-item mb-2" style={{ background: 'rgba(255,255,255,0.01)', borderStyle: 'dashed' }}>
                                                        <div className="history-info">
                                                            <div className="history-date">Session {data.items.length - idx}</div>
                                                            <div className="history-times">
                                                                {new Date(h.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} → {h.punch_out ? new Date(h.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Present'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="history-duration">{h.duration}</div>
                                                            <div className="history-status" style={{ color: h.status === 'Late' ? 'var(--warning)' : 'var(--text-muted)' }}>{h.status || 'Success'}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )) : <div className="text-center py-5 text-muted">No records found for this {historyFilterMode}</div>}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'profile' && (
                    <div style={{ animation: 'slideUp 0.6s ease' }}>
                        <div className="profile-header">
                            <div className="profile-avatar">
                                {employee.name?.split(' ').map(n => n[0]).join('') || 'JD'}
                            </div>
                            <h2 className="fw-bold mb-1">{employee.name || 'User Name'}</h2>
                            <p className="text-muted small mb-0">{employee.email || 'employee@company.com'}</p>
                        </div>

                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-label">Days Present</div>
                                <div className="stat-value" style={{ fontSize: '1.5rem' }}>18</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Hours Worked</div>
                                <div className="stat-value" style={{ fontSize: '1.5rem' }}>144</div>
                            </div>
                        </div>

                        <div className="history-section mb-4">
                            <div className="history-content">
                                <div className="setting-item">
                                    <div className="setting-icon"><i className="fa-solid fa-user"></i></div>
                                    <div className="flex-grow-1">
                                        <div className="fw-600">Edit Profile</div>
                                        <div className="extra-small text-muted">Update your info</div>
                                    </div>
                                    <i className="fa-solid fa-chevron-right text-muted small"></i>
                                </div>
                                <div className="setting-item">
                                    <div className="setting-icon"><i className="fa-solid fa-lock"></i></div>
                                    <div className="flex-grow-1">
                                        <div className="fw-600">Change Password</div>
                                        <div className="extra-small text-muted">Secure your account</div>
                                    </div>
                                    <i className="fa-solid fa-chevron-right text-muted small"></i>
                                </div>
                                <div className="setting-item">
                                    <div className="setting-icon"><i className="fa-solid fa-bell"></i></div>
                                    <div className="flex-grow-1">
                                        <div className="fw-600">Notifications</div>
                                        <div className="extra-small text-muted">Manage alerts</div>
                                    </div>
                                    <i className="fa-solid fa-chevron-right text-muted small"></i>
                                </div>
                                <button className="logout-btn" onClick={handleLogout}>
                                    <i className="fa-solid fa-sign-out"></i>
                                    Logout Account
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bottom-nav">
                    <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                            <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                        <span className="nav-label">Home</span>
                    </button>
                    <button className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                        <span className="nav-label">History</span>
                    </button>
                    <button className="nav-item" onClick={() => navigate('/portal/leaves')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span className="nav-label">Leave</span>
                    </button>
                    <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <span className="nav-label">Profile</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PortalDashboard;
