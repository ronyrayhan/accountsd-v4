import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';

const Logs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await api.get('/logs');
                setLogs(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    if (loading) return <Layout title="Audit Trail">
        <div className="d-flex justify-content-center align-items-center vh-100">
            <div className="spinner-border text-primary" role="status"></div>
        </div>
    </Layout>;

    return (
        <Layout title="System Audit Trail">
            <div className="card shadow-sm border-0 overflow-hidden">
                <div className="px-4 pt-4 pb-2 d-flex justify-content-between align-items-center bg-white">
                    <h5 className="fw-bold m-0 text-bright">Activity Stream</h5>
                    <span className="badge bg-light text-muted border px-3">Last 300 records</span>
                </div>
                <div className="table-responsive">
                    <table className="table align-middle m-0">
                        <thead>
                            <tr>
                                <th className="ps-4">Timestamp</th>
                                <th>Operator</th>
                                <th>Action Context</th>
                                <th className="pe-4">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, i) => (
                                <tr key={i}>
                                    <td className="ps-4">
                                        <div className="d-flex align-items-center gap-2">
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: log.type === 'entry' ? '#3b82f6' : (log.type === 'edit' ? '#8b5cf6' : '#f59e0b') }}></div>
                                            <div className="text-main small fw-medium">{new Date(log.time).toLocaleString()}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="badge bg-light text-muted border px-2 py-1 small">
                                            <i className="fa-solid fa-user-circle me-1 opacity-50"></i>{log.user}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="small fw-bold text-uppercase ls-1" style={{ color: log.type === 'edit' ? '#8b5cf6' : (log.type === 'adj' ? '#f59e0b' : '#3b82f6'), fontSize: '0.65rem' }}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="pe-4">
                                        <div className="text-muted small text-truncate" style={{ maxWidth: '400px' }}>{log.detail}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {logs.length === 0 && (
                <div className="text-center py-5 mt-4 card border-0">
                    <i className="fa-solid fa-stream fs-1 mb-3 text-muted opacity-20"></i>
                    <h5 className="text-muted">No activity logs found.</h5>
                </div>
            )}
        </Layout>
    );
};

export default Logs;
