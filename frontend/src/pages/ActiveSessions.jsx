import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';

const ActiveSessions = () => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/sessions');
            setSessions(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const terminateSession = async (id) => {
        if (!window.confirm('Are you sure you want to force logout this session?')) return;
        try {
            await api.delete(`/admin/sessions/${id}`);
            fetchSessions();
        } catch (err) {
            alert('Failed to terminate session');
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    if (loading && sessions.length === 0) return (
        <Layout title="Active Sessions">
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status"></div>
            </div>
        </Layout>
    );

    return (
        <Layout title="Active Sessions">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h5 className="fw-bold m-0 text-dark">Live Connections</h5>
                    <p className="text-muted x-small mb-0">Monitor and manage currently logged-in users</p>
                </div>
                <button className="btn btn-primary btn-sm rounded-pill px-3 fw-bold shadow-sm" onClick={fetchSessions}>
                    <i className="fa-solid fa-rotate me-2"></i> Refresh
                </button>
            </div>

            <div className="card shadow-sm border-0 overflow-hidden rounded-4">
                <div className="table-responsive">
                    <table className="table table-hover align-middle m-0">
                        <thead className="bg-light">
                            <tr>
                                <th className="ps-4 border-0 py-3 x-small fw-bold text-uppercase ls-1 text-muted">User</th>
                                <th className="border-0 py-3 x-small fw-bold text-uppercase ls-1 text-muted">IP Address</th>
                                <th className="border-0 py-3 x-small fw-bold text-uppercase ls-1 text-muted">Device / Browser</th>
                                <th className="border-0 py-3 x-small fw-bold text-uppercase ls-1 text-muted">Login Time</th>
                                <th className="border-0 py-3 x-small fw-bold text-uppercase ls-1 text-muted">Last Activity</th>
                                <th className="pe-4 border-0 py-3 x-small fw-bold text-uppercase ls-1 text-muted text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map((session) => (
                                <tr key={session._id} className="border-bottom border-light">
                                    <td className="ps-4 py-3">
                                        <div className="d-flex align-items-center gap-2">
                                            <div className="avatar-circle small bg-primary text-white" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                                                {session.username?.[0]?.toUpperCase()}
                                            </div>
                                            <div className="text-dark fw-bold small">{session.username}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="badge bg-light text-dark border shadow-sm px-2 py-1 font-monospace" style={{ fontSize: '0.75rem' }}>
                                            {session.ip_address}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="text-muted small text-truncate" style={{ maxWidth: '250px', fontSize: '0.8rem' }} title={session.user_agent}>
                                            {session.user_agent}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="text-muted small fw-medium">{new Date(session.login_time).toLocaleString()}</div>
                                    </td>
                                    <td>
                                        <div className="text-success small fw-medium">{new Date(session.last_activity).toLocaleString()}</div>
                                    </td>
                                    <td className="pe-4 text-end">
                                        <button
                                            className="btn btn-outline-danger btn-sm border-0 rounded-pill px-3"
                                            onClick={() => terminateSession(session.id || session._id)}
                                            title="Force Logout"
                                        >
                                            <i className="fa-solid fa-power-off me-1"></i> Terminate
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {sessions.length === 0 && !loading && (
                <div className="text-center py-5 mt-4 card border-0 shadow-sm rounded-4">
                    <i className="fa-solid fa-network-wired fs-1 mb-3 text-muted opacity-25"></i>
                    <h5 className="text-muted">No active sessions found.</h5>
                </div>
            )}
        </Layout>
    );
};

export default ActiveSessions;
