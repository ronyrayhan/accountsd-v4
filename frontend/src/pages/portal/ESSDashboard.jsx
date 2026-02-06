import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import OnboardingStepper from './OnboardingStepper';

const ESSDashboard = () => {
    const { user, logout } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [punching, setPunching] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    const fetchDashboard = async () => {
        try {
            let dashData = {};
            let onboardingStatus = 'Pending';
            let leaveBalances = [];

            try {
                const [dashRes, onboardRes, leaveRes] = await Promise.all([
                    api.get('/portal/dashboard'),
                    api.get('/portal/onboarding/status'),
                    api.get('/portal/balances')
                ]);
                dashData = dashRes.data;
                onboardingStatus = onboardRes.data.status;
                leaveBalances = leaveRes.data;
            } catch (err) {
                console.warn('Dashboard data fetch partially failed:', err);
            }

            setData({ ...dashData, onboarding_status: onboardingStatus, leaveBalances });
        } catch (err) {
            console.error('Fatal error in fetchDashboard:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handlePunch = async () => {
        setPunching(true);
        try {
            await api.post('/portal/punch');
            await fetchDashboard();
        } catch (err) {
            alert(err.response?.data?.message || 'Punch action failed');
        } finally {
            setPunching(false);
        }
    };

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>;

    // Redirection to onboarding if not completed
    if (data?.onboarding_status !== 'Completed') {
        return (
            <Layout title="Welcome & Onboarding">
                <div className="container py-4">
                    <div className="row justify-content-center">
                        <div className="col-lg-8">
                            <OnboardingStepper onComplete={fetchDashboard} />
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    const isCheckedIn = data?.today?.is_checked_in;
    const todaySummary = data?.today?.summary;
    const punches = data?.today?.punches || [];

    const formatDuration = (hours) => {
        const h = Math.floor(hours);
        const m = Math.floor((hours % 1) * 60);
        return `${h}h ${m}m`;
    };

    return (
        <Layout title="Employee Dashboard">
            <div className="row g-4">
                {/* Greeting & Quick Stats */}
                <div className="col-12">
                    <div className="card border-0 shadow-sm rounded-4 bg-primary text-white overflow-hidden p-4">
                        <div className="position-relative z-1 d-flex justify-content-between align-items-center">
                            <div>
                                <h2 className="fw-bold mb-1">Hello, {user?.username}!</h2>
                                <p className="opacity-75 mb-0">{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                            <Link to="/my-profile" className="btn btn-light rounded-pill px-4 fw-bold shadow-sm">
                                <i className="fa-solid fa-user-circle me-2"></i> My Profile
                            </Link>
                        </div>
                        <div className="position-absolute bottom-0 end-0 opacity-10 mb-n4 me-n4">
                            <i className="fa-solid fa-cloud-sun" style={{ fontSize: '150px' }}></i>
                        </div>
                    </div>
                </div>

                {/* Punch In/Out Card */}
                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                        <div className="card-body p-4 text-center d-flex flex-column justify-content-center">
                            <div className="mb-4">
                                <div className="display-4 fw-bold font-monospace">
                                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                </div>
                                <div className={`badge rounded-pill px-3 py-2 mt-2 ${isCheckedIn ? 'bg-success' : 'bg-secondary'}`}>
                                    {isCheckedIn ? 'Currently Clocked In' : 'Currently Clocked Out'}
                                </div>
                            </div>

                            <button
                                className={`btn btn-lg w-100 py-3 rounded-4 fw-bold shadow-sm mb-3 ${isCheckedIn ? 'btn-danger' : 'btn-success'}`}
                                onClick={handlePunch}
                                disabled={punching}
                            >
                                {punching ? (
                                    <span className="spinner-border spinner-border-sm"></span>
                                ) : (
                                    <>
                                        <i className={`fa-solid ${isCheckedIn ? 'fa-sign-out' : 'fa-sign-in'} me-2`}></i>
                                        {isCheckedIn ? 'Clock Out' : 'Clock In'}
                                    </>
                                )}
                            </button>

                            <div className="row g-2 x-small">
                                <div className="col-6">
                                    <div className="p-2 border rounded-3 bg-light">
                                        <div className="text-muted">First Punch</div>
                                        <div className="fw-bold text-dark">{punches[0] ? new Date(punches[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="p-2 border rounded-3 bg-light">
                                        <div className="text-muted">Recent Punch</div>
                                        <div className="fw-bold text-dark">{punches.length > 1 ? new Date(punches[punches.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Leave & Attendance Stats */}
                <div className="col-lg-8">
                    <div className="row g-4 h-100">
                        <div className="col-md-6">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-4">
                                <div className="d-flex align-items-center mb-3">
                                    <div className="stats-icon-box bg-info-subtle text-info me-3">
                                        <i className="fa-solid fa-user-clock fs-4"></i>
                                    </div>
                                    <h5 className="fw-bold mb-0">Attendance Status</h5>
                                </div>
                                <div className="display-5 fw-bold mb-1">
                                    {(() => {
                                        let hours = todaySummary?.total_hours || 0;
                                        if (isCheckedIn && punches.length > 0) {
                                            const lastPunch = new Date(punches[punches.length - 1].timestamp);
                                            const diffMs = currentTime - lastPunch;
                                            const diffHrs = diffMs / (1000 * 60 * 60);
                                            hours += diffHrs;
                                        }
                                        return hours.toFixed(2);
                                    })()}
                                    <span className="fs-6 text-muted ms-2">Hrs Today</span>
                                </div>
                                <div className="progress rounded-pill mb-2" style={{ height: '8px' }}>
                                    <div
                                        className="progress-bar bg-info"
                                        style={{ width: `${Math.min(((todaySummary?.total_hours || 0) + (isCheckedIn ? (currentTime - new Date(punches[punches.length - 1]?.timestamp || currentTime)) / 3600000 : 0)) / 8 * 100, 100)}%` }}
                                    ></div>
                                </div>
                                <p className="small text-muted mb-0">Daily target: 8 hours {isCheckedIn && <span className="ms-2 badge bg-success-subtle text-success border border-success-subtle px-2 py-0 x-small animate-pulse"><i className="fa-solid fa-circle small me-1"></i> Live</span>}</p>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-4">
                                <div className="d-flex align-items-center mb-3">
                                    <div className="stats-icon-box bg-warning-subtle text-warning me-3">
                                        <i className="fa-solid fa-umbrella-beach fs-4"></i>
                                    </div>
                                    <h5 className="fw-bold mb-0">Leave Balance</h5>
                                </div>
                                <div className="display-5 fw-bold mb-1">
                                    {data?.leaveBalances?.reduce((acc, curr) => acc + curr.available, 0) || 0}
                                    <span className="fs-6 text-muted ms-2">Days Avail.</span>
                                </div>
                                <div className="d-flex gap-2 mt-2">
                                    {data?.leaveBalances?.slice(0, 3).map((b, i) => (
                                        <span key={i} className="badge bg-light text-dark border x-small">
                                            {b.leave_type.code}: {b.available}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Punch Logs */}
                <div className="col-12">
                    <div className="card border-0 shadow-sm rounded-4">
                        <div className="card-header bg-white border-0 p-4">
                            <h6 className="fw-bold mb-0">Recent Activity Logs</h6>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th className="px-4">Date</th>
                                            <th>Punch Type</th>
                                            <th>Timestamp</th>
                                            <th>Location</th>
                                            <th className="text-end px-4">Device</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {punches.length > 0 ? punches.map((p, idx) => (
                                            <tr key={idx}>
                                                <td className="px-4 fw-bold">{new Date(p.timestamp).toLocaleDateString()}</td>
                                                <td>
                                                    <span className={`badge rounded-pill ${p.punch_type === 'IN' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
                                                        {p.punch_type}
                                                    </span>
                                                </td>
                                                <td>{new Date(p.timestamp).toLocaleTimeString()}</td>
                                                <td>{p.location || 'Web Portal'}</td>
                                                <td className="text-end px-4 text-muted small">{p.device_id}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="5" className="text-center py-5 text-muted">No activity recorded for today.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default ESSDashboard;
