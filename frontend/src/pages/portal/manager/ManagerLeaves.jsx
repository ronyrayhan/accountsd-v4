import React, { useState, useEffect } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../api/axios';

const ManagerLeaves = () => {
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actioning, setActioning] = useState(false);
    const [rejectionComment, setRejectionComment] = useState('');
    const [selectedLeave, setSelectedLeave] = useState(null);

    const fetchLeaves = async () => {
        try {
            const res = await api.get('/portal/manager/leaves');
            setLeaves(res.data);
        } catch (err) {
            console.error('Error fetching subordinate leaves:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaves();
    }, []);

    const handleAuthorize = async (leaveId, status, comment = '') => {
        setActioning(true);
        try {
            await api.post('/portal/manager/authorize', {
                leave_id: leaveId,
                status,
                comment: status === 'Rejected' ? comment : 'Approved by Manager'
            });
            await fetchLeaves();
            setSelectedLeave(null);
            setRejectionComment('');
        } catch (err) {
            alert(err.response?.data?.message || 'Action failed');
        } finally {
            setActioning(false);
        }
    };

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>;

    const pendingLeaves = leaves.filter(l => l.status === 'Pending');
    const pastLeaves = leaves.filter(l => l.status !== 'Pending');

    return (
        <Layout title="Approver Center | Team Requests">
            <div className="row g-4">
                {/* Pending Requests */}
                <div className="col-12">
                    <div className="card border-0 shadow-sm rounded-4">
                        <div className="card-header bg-white border-0 p-4">
                            <h5 className="fw-bold mb-0">Pending Approvals <span className="badge bg-primary-subtle text-primary rounded-pill ms-2">{pendingLeaves.length}</span></h5>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th className="px-4">Employee</th>
                                            <th>Leave Type</th>
                                            <th>Period</th>
                                            <th>Days</th>
                                            <th>Reason</th>
                                            <th className="text-end px-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingLeaves.length > 0 ? pendingLeaves.map(l => (
                                            <tr key={l._id}>
                                                <td className="px-4">
                                                    <div className="fw-bold">{l.employee_id?.personal_info?.full_name}</div>
                                                    <div className="x-small text-muted">{l.employee_id?.employee_id}</div>
                                                </td>
                                                <td>
                                                    <span className="badge bg-info-subtle text-info border border-info-subtle px-3 py-1 rounded-pill">
                                                        {l.leave_type?.name}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="small fw-bold">
                                                        {new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td><span className="fw-bold">{l.total_days}</span></td>
                                                <td><div className="text-truncate" style={{ maxWidth: '200px' }} title={l.reason}>{l.reason || 'No reason provided'}</div></td>
                                                <td className="text-end px-4">
                                                    <div className="d-flex justify-content-end gap-2">
                                                        <button
                                                            className="btn btn-sm btn-success rounded-pill px-3"
                                                            onClick={() => handleAuthorize(l._id, 'Approved')}
                                                            disabled={actioning}
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-outline-danger rounded-pill px-3"
                                                            onClick={() => setSelectedLeave(l)}
                                                            disabled={actioning}
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="6" className="text-center py-5 text-muted">No pending requests at this time.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* History */}
                <div className="col-12">
                    <div className="card border-0 shadow-sm rounded-4">
                        <div className="card-header bg-white border-0 p-4">
                            <h6 className="fw-bold mb-0">Recent Team History</h6>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-sm table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th className="px-4">Employee</th>
                                            <th>Type</th>
                                            <th>Days</th>
                                            <th>Status</th>
                                            <th className="text-end px-4">Decision Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pastLeaves.slice(0, 10).map(l => (
                                            <tr key={l._id}>
                                                <td className="px-4 py-3">
                                                    <div className="fw-semibold small">{l.employee_id?.personal_info?.full_name}</div>
                                                </td>
                                                <td><span className="x-small text-muted">{l.leave_type?.code}</span></td>
                                                <td><span className="small">{l.total_days}</span></td>
                                                <td>
                                                    <span className={`badge rounded-pill x-small ${l.status === 'Approved' ? 'bg-success' : 'bg-danger'}`}>
                                                        {l.status}
                                                    </span>
                                                </td>
                                                <td className="text-end px-4 text-muted x-small">
                                                    {l.approved_at ? new Date(l.approved_at).toLocaleDateString() : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rejection Modal */}
            {selectedLeave && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4">
                            <div className="modal-header border-0 p-4 pb-0">
                                <h5 className="fw-bold">Reject Leave Request</h5>
                                <button type="button" className="btn-close" onClick={() => setSelectedLeave(null)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <p className="text-muted small">Are you sure you want to reject the leave for <strong>{selectedLeave.employee_id?.personal_info?.full_name}</strong>?</p>
                                <label className="form-label x-small fw-bold text-uppercase text-muted">Rejection Reason</label>
                                <textarea
                                    className="form-control bg-light border-0 rounded-4 p-3 shadow-none"
                                    rows="3"
                                    value={rejectionComment}
                                    onChange={e => setRejectionComment(e.target.value)}
                                    placeholder="e.g. Peak season conflict, Please reschedule..."
                                ></textarea>
                            </div>
                            <div className="modal-footer border-0 p-4 pt-0">
                                <button className="btn btn-light rounded-pill px-4" onClick={() => setSelectedLeave(null)}>Cancel</button>
                                <button
                                    className="btn btn-danger rounded-pill px-4"
                                    onClick={() => handleAuthorize(selectedLeave._id, 'Rejected', rejectionComment)}
                                    disabled={!rejectionComment || actioning}
                                >
                                    Confirm Rejection
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default ManagerLeaves;
