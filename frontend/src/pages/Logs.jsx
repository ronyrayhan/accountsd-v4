import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';

const Logs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // Filter states
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [fetchLimit, setFetchLimit] = useState('300');

    const fetchLogs = async (isAll = false) => {
        setLoading(true);
        try {
            const params = {
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                limit: isAll ? 'all' : fetchLimit
            };
            const res = await api.get('/logs', { params });
            setLogs(res.data);
            if (isAll) setFetchLimit('all');
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setInitialLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    if (initialLoading) return <Layout title="Audit Trail">
        <div className="d-flex justify-content-center align-items-center vh-100">
            <div className="spinner-border text-primary" role="status"></div>
        </div>
    </Layout>;

    return (
        <Layout title="System Audit Trail">
            <div className="card shadow-sm border-0 mb-4 p-4 rounded-4 bg-white">
                <div className="row g-3 align-items-end">
                    <div className="col-md-3">
                        <label className="form-label small fw-bold text-muted text-uppercase ls-1">Start Date</label>
                        <input type="date" className="form-control border-light bg-light rounded-3 shadow-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label small fw-bold text-muted text-uppercase ls-1">End Date</label>
                        <input type="date" className="form-control border-light bg-light rounded-3 shadow-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="col-md-2">
                        <button className="btn btn-primary w-100 rounded-3 fw-bold shadow-sm" onClick={() => fetchLogs()} disabled={loading}>
                            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-filter me-2"></i>} Apply
                        </button>
                    </div>
                    <div className="col-md-2">
                        <button className="btn btn-outline-dark w-100 rounded-3 fw-bold" onClick={() => { setStartDate(''); setEndDate(''); setFetchLimit('300'); fetchLogs(); }}>
                            Reset
                        </button>
                    </div>
                    <div className="col-md-2 text-end">
                        <button className="btn btn-danger btn-sm rounded-pill px-3 fw-bold" onClick={() => { if (window.confirm('Warning: Loading ALL logs might slow down your browser if there are thousands of entries. Continue?')) fetchLogs(true); }} disabled={loading || fetchLimit === 'all'}>
                            <i className="fa-solid fa-database me-1"></i> {fetchLimit === 'all' ? 'All Data Loaded' : 'Retrieve All Data'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="card shadow-sm border-0 overflow-hidden rounded-4">
                <div className="px-4 pt-4 pb-2 d-flex justify-content-between align-items-center bg-white border-bottom">
                    <div>
                        <h5 className="fw-bold m-0 text-dark">Activity Stream</h5>
                        <p className="text-muted x-small mb-0">Track every administrative action across the system</p>
                    </div>
                    <span className="badge bg-light text-muted border px-3 py-2 rounded-pill h-50">
                        {fetchLimit === 'all' ? 'Showing Complete History' : `Showing Last ${logs.length} records`}
                    </span>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle m-0">
                        <thead className="bg-light">
                            <tr>
                                <th className="ps-4 border-0 py-3 x-small fw-bold text-uppercase ls-1 text-muted">Timestamp</th>
                                <th className="border-0 py-3 x-small fw-bold text-uppercase ls-1 text-muted">Operator</th>
                                <th className="border-0 py-3 x-small fw-bold text-uppercase ls-1 text-muted">Action Context</th>
                                <th className="pe-4 border-0 py-3 x-small fw-bold text-uppercase ls-1 text-muted">Detailed Info</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, i) => (
                                <tr key={i} className="border-bottom border-light">
                                    <td className="ps-4 py-3">
                                        <div className="d-flex align-items-center gap-2">
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: log.type === 'delete' ? '#ef4444' : (log.type === 'edit' ? '#8b5cf6' : (log.type === 'setting' ? '#f59e0b' : '#3b82f6')) }}></div>
                                            <div className="text-dark small fw-semibold">{new Date(log.time).toLocaleString()}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="badge bg-light text-dark border-0 shadow-sm px-3 py-1 small rounded-pill">
                                            <i className="fa-solid fa-user-circle me-1 opacity-50"></i>{log.user}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="small fw-extrabold text-uppercase ls-1" style={{ color: log.type === 'delete' ? '#ef4444' : (log.type === 'edit' ? '#8b5cf6' : '#3b82f6'), fontSize: '0.65rem' }}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="pe-4">
                                        <div className="text-muted small" style={{ fontSize: '0.85rem' }}>{log.detail}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {logs.length === 0 && !loading && (
                <div className="text-center py-5 mt-4 card border-0 shadow-sm rounded-4">
                    <i className="fa-solid fa-magnifying-glass fs-1 mb-3 text-muted opacity-25"></i>
                    <h5 className="text-muted">No activity logs found for this period.</h5>
                    <p className="text-muted small">Try adjusting your date filters.</p>
                </div>
            )}
        </Layout>
    );
};

export default Logs;
