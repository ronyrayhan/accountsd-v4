import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const LeaveManagement = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('my-leaves');
    const [leaves, setLeaves] = useState([]); // My Leaves History
    const [balances, setBalances] = useState([]);
    const [types, setTypes] = useState([]); // Leave Types for dropdown
    const [approvalList, setApprovalList] = useState([]); // For Managers
    const [loading, setLoading] = useState(true);

    const targetId = user?.id;

    // Form State
    const [application, setApplication] = useState({
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
        files: []
    });

    useEffect(() => {
        fetchInitialData();
    }, [user, targetId]);

    const fetchInitialData = async () => {
        if (!targetId) return;
        setLoading(true);
        try {
            const [typesRes, balRes, myLeavesRes] = await Promise.all([
                api.get('/hr/leave-types'),
                api.get(`/hr/leaves/balances/${targetId}`),
                api.get(`/hr/leaves/me/${targetId}`)
            ]);

            setTypes(typesRes.data);
            setBalances(balRes.data);
            setLeaves(myLeavesRes.data);

            if (user.role === 'Admin' || user.role === 'HR') {
                fetchApprovals();
            }
        } catch (err) {
            console.error('Error fetching leave data:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchApprovals = async () => {
        try {
            const res = await api.get('/hr/leaves?status=Pending');
            setApprovalList(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleApply = async (e) => {
        e.preventDefault();

        const start = new Date(application.start_date);
        const end = new Date(application.end_date);
        const diffTime = Math.abs(end - start);
        const total_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const formData = new FormData();
        formData.append('employee_id', targetId);
        formData.append('leave_type_id', application.leave_type_id);
        formData.append('start_date', application.start_date);
        formData.append('end_date', application.end_date);
        formData.append('total_days', total_days);
        formData.append('reason', application.reason);

        if (application.files) {
            for (let i = 0; i < application.files.length; i++) {
                formData.append('attachments', application.files[i]);
            }
        }

        try {
            await api.post('/hr/leaves/apply', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert('Application submitted successfully!');
            setApplication({ leave_type_id: '', start_date: '', end_date: '', reason: '', files: [] });
            fetchInitialData();

            const modalEl = document.getElementById('newLeaveModal');
            if (window.bootstrap && modalEl) {
                const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.hide();
            }

        } catch (err) {
            alert(err.response?.data?.message || 'Application failed');
        }
    };

    const handleApproval = async (id, action) => {
        if (!confirm(`Are you sure you want to ${action} this request?`)) return;
        try {
            await api.post(`/hr/leaves/${id}/process`, {
                action,
                manager_id: user.id,
                manager_name: user.username,
                comment: action === 'Rejected' ? 'Rejected by Manager' : 'Approved'
            });
            fetchApprovals();
        } catch (err) {
            alert('Action failed');
        }
    };

    return (
        <Layout title="Leave Management"
            actions={
                <div className="d-flex gap-2">
                    {user.role === 'Admin' && (
                        <Link to="/hr/leave-settings" className="btn btn-light rounded-pill px-4">
                            <i className="fa-solid fa-cog me-2"></i> Settings
                        </Link>
                    )}
                    <button className="btn btn-primary rounded-pill px-4" data-bs-toggle="modal" data-bs-target="#newLeaveModal">
                        <i className="fa-solid fa-plus me-2"></i> Apply Leave
                    </button>
                </div>
            }
        >
            <ul className="nav nav-pills mb-4 bg-white p-2 rounded-pill shadow-sm d-inline-flex">
                <li className="nav-item">
                    <button className={`nav-link rounded-pill px-4 ${activeTab === 'my-leaves' ? 'active' : 'text-muted'}`} onClick={() => setActiveTab('my-leaves')}>My Dashboard</button>
                </li>
                {(user.role === 'Admin' || user.role === 'HR') && (
                    <li className="nav-item">
                        <button className={`nav-link rounded-pill px-4 ${activeTab === 'approvals' ? 'active' : 'text-muted'}`} onClick={() => setActiveTab('approvals')}>Approvals {approvalList.length > 0 && <span className="badge bg-danger ms-2">{approvalList.length}</span>}</button>
                    </li>
                )}
            </ul>

            {activeTab === 'my-leaves' && (
                <>
                    <div className="row g-3 mb-4">
                        {loading ? <div className="text-center py-4"><div className="spinner-border text-primary"></div></div> : balances.map((bal, idx) => (
                            <div className="col-6 col-lg-3" key={idx}>
                                <div className="balance-card h-100 p-3 rounded-4 bg-white shadow-sm border-0 position-relative overflow-hidden transition-all">
                                    <div className="position-absolute top-0 start-0 w-100" style={{ height: '4px', backgroundColor: bal.leave_type.color }}></div>
                                    <div className="d-flex flex-column h-100">
                                        <div className="icon-badge mb-2 d-inline-flex align-items-center justify-content-center rounded-3" style={{ backgroundColor: bal.leave_type.color + '22', color: bal.leave_type.color, width: 32, height: 32 }}>
                                            <i className="fa-solid fa-calendar-day small"></i>
                                        </div>
                                        <div className="extra-small text-muted fw-bold ls-1 text-uppercase mb-1">{bal.leave_type.name}</div>
                                        <div className="d-flex justify-content-between align-items-baseline">
                                            <h3 className="fw-black mb-0">{bal.available}d</h3>
                                            <span className="extra-small text-muted fw-bold">/ {bal.total_quota}</span>
                                        </div>
                                        <div className="progress mt-2" style={{ height: 4 }}>
                                            <div className="progress-bar rounded-pill" style={{ width: `${(bal.available / bal.total_quota) * 100}%`, backgroundColor: bal.leave_type.color }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="card history-card border-0 shadow-sm rounded-4 bg-white mb-5">
                        <div className="card-header bg-white border-0 p-4 pb-0">
                            <h6 className="fw-black m-0 text-dark small ls-1 text-uppercase d-flex align-items-center">
                                <i className="fa-solid fa-clock-rotate-left me-2 text-muted"></i> Application History
                            </h6>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="bg-light">
                                        <tr>
                                            <th className="ps-4">Type</th>
                                            <th>Date Range</th>
                                            <th>Days</th>
                                            <th>Status</th>
                                            <th>Attachments</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaves.map(lv => (
                                            <tr key={lv._id}>
                                                <td className="ps-4">
                                                    <span className="badge rounded-pill text-dark border fw-bold" style={{ borderColor: lv.leave_type?.color || '#ccc' }}>{lv.leave_type?.name || 'Unknown'}</span>
                                                </td>
                                                <td className="small">{new Date(lv.start_date).toLocaleDateString()} - {new Date(lv.end_date).toLocaleDateString()}</td>
                                                <td className="fw-bold">{lv.total_days}</td>
                                                <td><span className={`badge rounded-pill ${lv.status === 'Approved' ? 'bg-success' : lv.status === 'Rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>{lv.status}</span></td>
                                                <td>
                                                    {lv.attachments?.length > 0 ? (
                                                        <div className="d-flex gap-1">
                                                            {lv.attachments.map((file, i) => (
                                                                <a key={i} href={`http://localhost:5000/api/files/${file.filename}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-light border"><i className="fa-solid fa-paperclip small"></i></a>
                                                            ))}
                                                        </div>
                                                    ) : <span className="text-muted x-small">—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'approvals' && (
                <div className="card border-0 shadow-sm rounded-4">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th className="ps-4">Employee</th>
                                    <th>Leave Details</th>
                                    <th>Reason</th>
                                    <th>Attachments</th>
                                    <th className="text-end pe-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {approvalList.map(item => (
                                    <tr key={item._id}>
                                        <td className="ps-4">
                                            <div className="fw-bold">{item.employee_id?.personal_info?.full_name}</div>
                                            <div className="x-small text-muted">{item.employee_id?.employment_info?.current_department}</div>
                                        </td>
                                        <td>
                                            <div className="badge bg-light text-dark border mb-1">{item.leave_type?.name || 'Request'}</div>
                                            <div className="small">{new Date(item.start_date).toLocaleDateString()} ({item.total_days} days)</div>
                                        </td>
                                        <td><div className="small text-muted text-truncate" style={{ maxWidth: 200 }}>{item.reason}</div></td>
                                        <td>
                                            {item.attachments?.length > 0 ? (
                                                <a href={`http://localhost:5000/api/files/${item.attachments[0].filename}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary rounded-pill"><i className="fa-solid fa-file me-1"></i> View Doc</a>
                                            ) : <span className="text-muted x-small">None</span>}
                                        </td>
                                        <td className="text-end pe-4">
                                            <button className="btn btn-sm btn-success rounded-pill px-3 me-2" onClick={() => handleApproval(item._id, 'Approved')}><i className="fa-solid fa-check"></i></button>
                                            <button className="btn btn-sm btn-danger rounded-pill px-3" onClick={() => handleApproval(item._id, 'Rejected')}><i className="fa-solid fa-xmark"></i></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="modal fade" id="newLeaveModal" tabIndex="-1">
                <div className="modal-dialog modal-dialog-centered">
                    <form className="modal-content border-0 shadow-lg rounded-5 bg-white" onSubmit={handleApply}>
                        <div className="modal-header border-0 p-4 pb-0">
                            <h5 className="fw-black m-0 text-dark">Leave Application</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body p-4">
                            <div className="mb-4">
                                <label className="extra-small fw-black text-muted ls-1 text-uppercase mb-2">Leave Category</label>
                                <select className="form-select rounded-3 border-light bg-light p-3 fw-bold small" required value={application.leave_type_id} onChange={e => setApplication({ ...application, leave_type_id: e.target.value })}>
                                    <option value="">Select Category...</option>
                                    {types.map(t => (
                                        <option key={t._id} value={t._id}>{t.name} ({t.default_days - (balances.find(b => b.leave_type._id === t._id)?.used || 0)} days available)</option>
                                    ))}
                                </select>
                            </div>
                            <div className="row g-3 mb-4">
                                <div className="col-6">
                                    <label className="extra-small fw-black text-muted ls-1 text-uppercase mb-2">Duration From</label>
                                    <input type="date" className="form-control rounded-3 border-light bg-light p-3 fw-bold small" required value={application.start_date} onChange={e => setApplication({ ...application, start_date: e.target.value })} />
                                </div>
                                <div className="col-6">
                                    <label className="extra-small fw-black text-muted ls-1 text-uppercase mb-2">Duration To</label>
                                    <input type="date" className="form-control rounded-3 border-light bg-light p-3 fw-bold small" required value={application.end_date} onChange={e => setApplication({ ...application, end_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="extra-small fw-black text-muted ls-1 text-uppercase mb-2">Supporting Evidence</label>
                                <input type="file" className="form-control rounded-3 border-light bg-light p-3 fw-bold small" multiple onChange={e => setApplication({ ...application, files: e.target.files })} />
                            </div>
                            <div className="mb-1">
                                <label className="extra-small fw-black text-muted ls-1 text-uppercase mb-2">Justification / Reason</label>
                                <textarea className="form-control rounded-3 border-light bg-light p-3 fw-bold small" rows="3" required placeholder="Describe the reason for your request..." value={application.reason} onChange={e => setApplication({ ...application, reason: e.target.value })}></textarea>
                            </div>
                        </div>
                        <div className="modal-footer border-0 p-4 pt-0">
                            <button type="submit" className="btn btn-primary w-100 rounded-pill fw-black py-3 shadow-lg ls-1">SUBMIT APPLICATION</button>
                        </div>
                    </form>
                </div>
            </div>

            <style>{`
                .balance-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.05) !important;
                }
            `}</style>
        </Layout>
    );
};

export default LeaveManagement;
