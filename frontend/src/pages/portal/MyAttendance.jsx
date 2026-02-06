import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const MyAttendance = () => {
    const { user } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    const fetchAttendance = async () => {
        try {
            setLoading(true);
            const res = await api.get('/portal/dashboard'); // dashboard returns history for last 7 days by default
            // In a real app, we might want a dedicated endpoint for longer history
            setHistory(res.data.history || []);
        } catch (err) {
            console.error('Error fetching attendance:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendance();
    }, []);

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <Layout title="My Attendance History">
            <div className="row g-4">
                <div className="col-12">
                    <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center">
                            <h5 className="fw-bold mb-0">Recent Attendance Logs</h5>
                            <div className="d-flex gap-2">
                                <input
                                    type="month"
                                    className="form-control form-control-sm"
                                    value={filterMonth}
                                    onChange={(e) => setFilterMonth(e.target.value)}
                                />
                                <button className="btn btn-sm btn-primary" onClick={fetchAttendance}>
                                    <i className="fa-solid fa-sync"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="px-4">Date</th>
                                        <th>First Punch</th>
                                        <th>Last Punch</th>
                                        <th>Total Hours</th>
                                        <th className="text-end px-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.length > 0 ? history.map((h, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4">
                                                <div className="fw-bold">{new Date(h.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                                            </td>
                                            <td>{h.first_punch ? new Date(h.first_punch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                                            <td>{h.last_punch ? new Date(h.last_punch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                                            <td>
                                                <div className="fw-bold text-primary">{h.total_hours.toFixed(2)}h</div>
                                            </td>
                                            <td className="text-end px-4">
                                                <span className={`badge rounded-pill ${h.total_hours >= 8 ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`}>
                                                    {h.total_hours >= 8 ? 'Full Day' : 'Half Day / Short'}
                                                </span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="text-center py-5 text-muted">
                                                <i className="fa-solid fa-calendar-xmark fs-2 d-block mb-3"></i>
                                                No attendance logs found for this period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default MyAttendance;
