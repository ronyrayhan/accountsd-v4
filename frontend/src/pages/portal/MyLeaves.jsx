import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const MyLeaves = () => {
    const { user } = useAuth();
    const [balances, setBalances] = useState([]);
    const [history, setHistory] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showApplyModal, setShowApplyModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        leave_type_id: '',
        start_date: '',
        end_date: '',
        total_days: 1,
        reason: ''
    });
    const [files, setFiles] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [balRes, histRes, typeRes] = await Promise.all([
                api.get('/portal/balances'),
                api.get('/portal/leaves'),
                api.get('/portal/leave-types')
            ]);
            setBalances(balRes.data);
            setHistory(histRes.data);
            setLeaveTypes(typeRes.data);
        } catch (err) {
            console.error('Error fetching leave data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleApply = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => data.append(key, formData[key]));
            files.forEach(file => data.append('attachments', file));

            await api.post('/portal/apply', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert('Leave application submitted successfully!');
            setShowApplyModal(false);
            setFormData({ leave_type_id: '', start_date: '', end_date: '', total_days: 1, reason: '' });
            setFiles([]);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to submit application');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <Layout
            title="Leave Management"
            actions={
                <button className="btn btn-primary rounded-pill px-4" onClick={() => setShowApplyModal(true)}>
                    <i className="fa-solid fa-plus me-2"></i> Apply for Leave
                </button>
            }
        >
            <div className="row g-4">
                {/* Leave Balances */}
                <div className="col-12">
                    <div className="row g-4">
                        {balances.map((b, idx) => (
                            <div className="col-md-3" key={idx}>
                                <div className="card border-0 shadow-sm rounded-4 p-4 text-center h-100">
                                    <h6 className="text-muted fw-bold text-uppercase x-small mb-3">{b.leave_type.name}</h6>
                                    <div className="display-6 fw-bold text-primary mb-1">{b.available}</div>
                                    <div className="x-small text-muted">Days Available</div>
                                    <div className="progress mt-3" style={{ height: '5px' }}>
                                        <div
                                            className="progress-bar bg-primary"
                                            style={{ width: `${(b.used / b.total_quota) * 100}%` }}
                                        ></div>
                                    </div>
                                    <div className="d-flex justify-content-between mt-2 x-small text-muted">
                                        <span>Used: {b.used}</span>
                                        <span>Total: {b.total_quota}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* History Table */}
                <div className="col-12">
                    <div className="card border-0 shadow-sm rounded-4">
                        <div className="card-header bg-white border-0 p-4">
                            <h5 className="fw-bold mb-0">My Leave History</h5>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="px-4">Type</th>
                                        <th>Duration</th>
                                        <th>Days</th>
                                        <th>Status</th>
                                        <th className="text-end px-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.length > 0 ? history.map((l, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4">
                                                <div className="fw-bold">{l.leave_type?.name}</div>
                                                <div className="x-small text-muted">{l.reason?.slice(0, 30)}...</div>
                                            </td>
                                            <td>
                                                <div className="small">
                                                    {new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td><span className="fw-bold">{l.total_days}</span></td>
                                            <td>
                                                <span className={`badge rounded-pill ${l.status === 'Approved' ? 'bg-success-subtle text-success' :
                                                        l.status === 'Rejected' ? 'bg-danger-subtle text-danger' :
                                                            'bg-warning-subtle text-warning'
                                                    }`}>
                                                    {l.status}
                                                </span>
                                            </td>
                                            <td className="text-end px-4">
                                                <button className="btn btn-sm btn-outline-secondary rounded-pill">View</button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="text-center py-5 text-muted">No leave requests found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Application Modal (Bootstrap simplified) */}
            {showApplyModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 rounded-4 shadow">
                            <form onSubmit={handleApply}>
                                <div className="modal-header border-0 p-4">
                                    <h5 className="modal-title fw-bold">Apply for Leave</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowApplyModal(false)}></button>
                                </div>
                                <div className="modal-body p-4 pt-0">
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Leave Type</label>
                                        <select
                                            className="form-select rounded-3"
                                            required
                                            value={formData.leave_type_id}
                                            onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
                                        >
                                            <option value="">Select a type...</option>
                                            {leaveTypes.map(t => (
                                                <option key={t._id} value={t._id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-bold">Start Date</label>
                                            <input
                                                type="date"
                                                className="form-control rounded-3"
                                                required
                                                value={formData.start_date}
                                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-bold">End Date</label>
                                            <input
                                                type="date"
                                                className="form-control rounded-3"
                                                required
                                                value={formData.end_date}
                                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Total Days</label>
                                        <input
                                            type="number"
                                            className="form-control rounded-3"
                                            required min="0.5" step="0.5"
                                            value={formData.total_days}
                                            onChange={(e) => setFormData({ ...formData, total_days: e.target.value })}
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Reason</label>
                                        <textarea
                                            className="form-control rounded-3"
                                            rows="3"
                                            required
                                            value={formData.reason}
                                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                        ></textarea>
                                    </div>
                                    <div className="mb-0">
                                        <label className="form-label small fw-bold">Attachments (if required)</label>
                                        <input
                                            type="file"
                                            className="form-control rounded-3"
                                            multiple
                                            onChange={(e) => setFiles(Array.from(e.target.files))}
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer border-0 p-4 pt-0">
                                    <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setShowApplyModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={submitting}>
                                        {submitting ? 'Submitting...' : 'Submit Application'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default MyLeaves;
