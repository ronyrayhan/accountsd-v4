import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api, { viewFile } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const LeaveManagement = () => {
    const { user } = useAuth();
    const handleResyncAll = async () => {
        if (!confirm('This will recalculate all employee leave balances from their history. Proceed?')) return;
        setGlobalLoading(true);
        try {
            await api.post('/hr/leaves/resync-all');
            alert('All balances recalculated successfully!');
            fetchGlobalData();
        } catch (err) {
            console.error(err);
            alert('Resync failed');
        } finally {
            setGlobalLoading(false);
        }
    };

    const isAdminOrHR = user?.role === 'Admin' || user?.role === 'HR';
    const [activeTab, setActiveTab] = useState(isAdminOrHR ? 'global-hub' : 'my-leaves');
    const [leaves, setLeaves] = useState([]); // My Leaves History
    const [balances, setBalances] = useState([]); // Current displayed balances
    const [myBalances, setMyBalances] = useState([]); // Cached private balances
    const [allBalances, setAllBalances] = useState([]); // All employees balances
    const [allHistory, setAllHistory] = useState([]); // All employees history
    const [types, setTypes] = useState([]); // Leave Types for dropdown
    const [approvalList, setApprovalList] = useState([]); // For Managers
    const [loading, setLoading] = useState(true);
    const [globalLoading, setGlobalLoading] = useState(false);

    const targetId = user?.id;

    // Form State
    const [application, setApplication] = useState({
        employee_id: '',
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
        files: []
    });
    const [employees, setEmployees] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

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
            setMyBalances(balRes.data);
            setLeaves(myLeavesRes.data);

            if (user.role === 'Admin' || user.role === 'HR') {
                fetchApprovals();
                fetchEmployees();
                fetchGlobalData();
            }
        } catch (err) {
            console.error('Error fetching leave data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchSelectedBalances = async () => {
            const selectedEmpId = application.employee_id || targetId;
            if (!selectedEmpId) return;

            // If it's the current user, use cached myBalances to save a network call
            if (selectedEmpId === targetId) {
                setBalances(myBalances);
                return;
            }

            try {
                const res = await api.get(`/hr/leaves/balances/${selectedEmpId}`);
                setBalances(res.data);
            } catch (err) {
                console.error('Error fetching selected employee balances:', err);
                setBalances([]);
            }
        };

        fetchSelectedBalances();
    }, [application.employee_id, targetId, myBalances]);

    const fetchApprovals = async () => {
        try {
            const res = await api.get('/hr/leaves?status=Pending');
            setApprovalList(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/hr/employees');
            setEmployees(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchGlobalData = async () => {
        setGlobalLoading(true);
        try {
            const [balRes, histRes] = await Promise.all([
                api.get('/hr/leaves/all-balances'),
                api.get('/hr/leaves')
            ]);
            setAllBalances(balRes.data);
            setAllHistory(histRes.data);
        } catch (err) {
            console.error('Error fetching global data:', err);
        } finally {
            setGlobalLoading(false);
        }
    };

    const handleApply = async (e) => {
        e.preventDefault();

        const start = new Date(application.start_date);
        const end = new Date(application.end_date);
        const diffTime = Math.abs(end - start);
        const total_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const formData = new FormData();
        const empId = (user.role === 'Admin' || user.role === 'HR') ? (application.employee_id || targetId) : targetId;

        formData.append('employee_id', empId);
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
            setApplication({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', reason: '', files: [] });
            fetchInitialData();
            if (isAdminOrHR) fetchGlobalData();

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
            fetchGlobalData();
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
                {(user.role === 'Admin' || user.role === 'HR') && (
                    <>
                        <li className="nav-item">
                            <button className={`nav-link rounded-pill px-4 ${activeTab === 'global-hub' ? 'active' : 'text-muted'}`} onClick={() => setActiveTab('global-hub')}>Global Hub</button>
                        </li>
                        <li className="nav-item">
                            <button className={`nav-link rounded-pill px-4 ${activeTab === 'approvals' ? 'active' : 'text-muted'}`} onClick={() => setActiveTab('approvals')}>Approvals {approvalList.length > 0 && <span className="badge bg-danger ms-2">{approvalList.length}</span>}</button>
                        </li>
                    </>
                )}
                <li className="nav-item">
                    <button className={`nav-link rounded-pill px-4 ${activeTab === 'my-leaves' ? 'active' : 'text-muted'}`} onClick={() => setActiveTab('my-leaves')}>{isAdminOrHR ? 'My Profile' : 'My Dashboard'}</button>
                </li>
            </ul>

            {activeTab === 'global-hub' && (
                <div className="row g-4">
                    {/* Segment 1: All Employee Balances */}
                    <div className="col-12 col-xl-5">
                        <div className="card border-0 shadow-sm rounded-4 h-100">
                            <div className="card-header bg-white border-0 p-4 d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="fw-black m-0 text-dark small ls-1 text-uppercase">Employee Quotas</h6>
                                    <button className="btn btn-link p-0 extra-small text-primary text-decoration-none" onClick={handleResyncAll} title="Force recalculate all balances">
                                        <i className="fa-solid fa-sync-alt me-1"></i> Sync Balances
                                    </button>
                                </div>
                                <div className="input-group input-group-sm w-50">
                                    <span className="input-group-text bg-light border-0 rounded-start-pill ps-3"><i className="fa-solid fa-search text-muted x-small"></i></span>
                                    <input type="text" className="form-control bg-light border-0 rounded-end-pill x-small" placeholder="Search employee..." onChange={e => setSearchQuery(e.target.value)} />
                                </div>
                            </div>
                            <div className="card-body p-0">
                                <div className="table-responsive" style={{ maxHeight: '600px' }}>
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="bg-light position-sticky top-0">
                                            <tr>
                                                <th className="ps-4 x-small fw-black text-muted py-3">EMPLOYEE</th>
                                                {types.map(t => <th key={t._id} className="text-center x-small fw-black text-muted">{t.code}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allBalances.filter(b => b.employee_id?.personal_info?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || b.employee_id?.employee_id?.includes(searchQuery)).map(b => (
                                                <tr key={b._id}>
                                                    <td className="ps-4">
                                                        <div className="fw-bold small">{b.employee_id?.personal_info?.full_name}</div>
                                                        <div className="x-small text-muted">{b.employee_id?.employee_id}</div>
                                                    </td>
                                                    {types.map(t => {
                                                        const bal = b.balances.find(lb => (lb.leave_type?._id || lb.leave_type)?.toString() === t._id.toString());
                                                        const total = bal ? bal.total : t.default_days;
                                                        const used = bal ? bal.used : 0;
                                                        return (
                                                            <td key={t._id} className="text-center">
                                                                <span className="small fw-bold">{total - used}</span>
                                                                <span className="text-muted x-small">/{total}</span>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Segment 2: All History */}
                    <div className="col-12 col-xl-7">
                        <div className="card border-0 shadow-sm rounded-4 h-100">
                            <div className="card-header bg-white border-0 p-4">
                                <h6 className="fw-black m-0 text-dark small ls-1 text-uppercase">Global History</h6>
                            </div>
                            <div className="card-body p-0">
                                <div className="table-responsive" style={{ maxHeight: '600px' }}>
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="bg-light position-sticky top-0">
                                            <tr>
                                                <th className="ps-4 x-small fw-black text-muted">EMPLOYEE</th>
                                                <th className="x-small fw-black text-muted">TYPE & DURATION</th>
                                                <th className="x-small fw-black text-muted">STATUS</th>
                                                <th className="pe-4 text-center x-small fw-black text-muted">DOC</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allHistory.map(lv => (
                                                <tr key={lv._id}>
                                                    <td className="ps-4">
                                                        <div className="fw-bold small">{lv.employee_id?.personal_info?.full_name}</div>
                                                        <div className="x-small text-muted">{lv.employee_id?.employment_info?.current_department}</div>
                                                    </td>
                                                    <td>
                                                        <div className="small fw-bold">{lv.leave_type?.name}</div>
                                                        <div className="x-small text-muted">{new Date(lv.start_date).toLocaleDateString()} - {lv.total_days}d</div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge rounded-pill extra-small ${lv.status === 'Approved' ? 'bg-success' : lv.status === 'Rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                                            {lv.status}
                                                        </span>
                                                    </td>
                                                    <td className="pe-4 text-center">
                                                        {lv.attachments?.length > 0 && <span className="text-primary cursor-pointer" onClick={() => viewFile(lv.attachments[0].filename)}><i className="fa-solid fa-file-lines"></i></span>}
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
            )}

            {activeTab === 'approvals' && (
                <div className="card border-0 shadow-sm rounded-4">
                    <div className="card-header bg-white border-0 p-4">
                        <h6 className="fw-black m-0 text-dark small ls-1 text-uppercase">Pending Approvals</h6>
                    </div>
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
                                {approvalList.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center py-5 text-muted">No pending requests</td></tr>
                                ) : approvalList.map(item => (
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
                                                <button onClick={() => viewFile(item.attachments[0].filename)} className="btn btn-sm btn-outline-primary rounded-pill">
                                                    <i className="fa-solid fa-file me-1"></i> View Doc
                                                </button>
                                            ) : (
                                                <span className="text-muted extra-small">—</span>
                                            )}
                                        </td>
                                        <td className="text-end pe-4">
                                            <button className="btn btn-sm btn-success rounded-pill px-3 me-2" onClick={() => handleApproval(item._id, 'Approved')} title="Approve"><i className="fa-solid fa-check"></i></button>
                                            <button className="btn btn-sm btn-danger rounded-pill px-3" onClick={() => handleApproval(item._id, 'Rejected')} title="Reject"><i className="fa-solid fa-xmark"></i></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'my-leaves' && (
                <>
                    <div className="row g-3 mb-4">
                        {loading ? <div className="text-center py-4"><div className="spinner-border text-primary"></div></div> : myBalances.map((bal, idx) => (
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
                                                                <button key={i} onClick={() => viewFile(file.filename)} className="btn btn-sm btn-light border"><i className="fa-solid fa-paperclip small"></i></button>
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

            <div className="modal fade" id="newLeaveModal" tabIndex="-1">
                <div className="modal-dialog modal-dialog-centered">
                    <form className="modal-content border-0 shadow-lg rounded-5 bg-white" onSubmit={handleApply}>
                        <div className="modal-header border-0 p-4 pb-0">
                            <h5 className="fw-black m-0 text-dark">{(user.role === 'Admin' || user.role === 'HR') ? 'Admin Leave Entry' : 'Leave Application'}</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body p-4">
                            {(user.role === 'Admin' || user.role === 'HR') && (
                                <div className="mb-4">
                                    <label className="extra-small fw-black text-muted ls-1 text-uppercase mb-2">Select Employee</label>
                                    <select
                                        className="form-select rounded-3 border-light bg-light p-3 fw-bold small"
                                        required
                                        value={application.employee_id}
                                        onChange={e => setApplication({ ...application, employee_id: e.target.value })}
                                    >
                                        <option value="">Apply for myself ({user.username})</option>
                                        {employees.map(emp => (
                                            <option key={emp._id} value={emp._id}>
                                                {emp.personal_info?.full_name} ({emp.employee_id})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="mb-4">
                                <label className="extra-small fw-black text-muted ls-1 text-uppercase mb-2">Leave Category</label>
                                <select className="form-select rounded-3 border-light bg-light p-3 fw-bold small" required value={application.leave_type_id} onChange={e => setApplication({ ...application, leave_type_id: e.target.value })}>
                                    <option value="">Select Category...</option>
                                    {types.map(t => {
                                        const bal = balances.find(b => b.leave_type?._id === t._id);
                                        const available = bal ? bal.available : t.default_days;
                                        return (
                                            <option key={t._id} value={t._id}>
                                                {t.name} (Available: {available} days)
                                            </option>
                                        );
                                    })}
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
                                <input type="file" className="form-control rounded-3 border-light bg-light p-3 fw-bold small" multiple accept="image/*,.pdf" onChange={e => setApplication({ ...application, files: e.target.files })} />
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
