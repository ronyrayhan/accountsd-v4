import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';

const HRManagement = () => {
    const [employees, setEmployees] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('attendance');

    // Attendance State
    const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);

    // Leave State
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leaveForm, setLeaveForm] = useState({ employee_id: '', leave_type: 'Casual', start_date: '', end_date: '', reason: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [empRes, leaveRes] = await Promise.all([
                api.get('/payroll/employees'),
                api.get('/hr/leaves')
            ]);
            setEmployees(empRes.data);
            setLeaves(leaveRes.data);
            fetchAttendance(attDate);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAttendance = async (date) => {
        try {
            const res = await api.get(`/hr/attendance?date=${date}`);
            setAttendance(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAttChange = async (empId, status) => {
        try {
            await api.post('/hr/attendance', { employee_id: empId, date: attDate, status });
            fetchAttendance(attDate);
        } catch (err) { alert('Update failed'); }
    };

    const handleLeaveStatus = async (id, status) => {
        try {
            await api.patch(`/hr/leaves/${id}/status`, { status });
            fetchData();
        } catch (err) { alert('Action failed'); }
    };

    const handleSaveLeave = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hr/leaves', leaveForm);
            setShowLeaveModal(false);
            fetchData();
            setLeaveForm({ employee_id: '', leave_type: 'Casual', start_date: '', end_date: '', reason: '' });
        } catch (err) { alert('Request failed'); }
    };

    const getAttStatus = (empId) => {
        const att = attendance.find(a => a.employee_id?._id === empId || a.employee_id === empId);
        return att ? att.status : 'Absent';
    };

    return (
        <Layout title="HR Management">
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body p-2 d-flex gap-2">
                    <button className={`btn flex-grow-1 py-2 rounded-3 ${activeTab === 'attendance' ? 'btn-primary' : 'btn-light'}`} onClick={() => setActiveTab('attendance')}>
                        <i className="fa-solid fa-calendar-check me-2"></i> Attendance
                    </button>
                    <button className={`btn flex-grow-1 py-2 rounded-3 ${activeTab === 'leaves' ? 'btn-primary' : 'btn-light'}`} onClick={() => setActiveTab('leaves')}>
                        <i className="fa-solid fa-umbrella-beach me-2"></i> Leave Requests
                    </button>
                    <button className={`btn flex-grow-1 py-2 rounded-3 ${activeTab === 'employees' ? 'btn-primary' : 'btn-light'}`} onClick={() => setActiveTab('employees')}>
                        <i className="fa-solid fa-users-viewfinder me-2"></i> Directory
                    </button>
                </div>
            </div>

            {activeTab === 'attendance' && (
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                    <div className="card-header bg-white border-bottom p-4 d-flex justify-content-between align-items-center">
                        <div>
                            <h5 className="fw-bold mb-0">Daily Attendance Roll Call</h5>
                            <p className="text-muted small mb-0">Update employee presence for the selected day</p>
                        </div>
                        <input type="date" className="form-control w-auto border-0 bg-light shadow-sm fw-bold" value={attDate} onChange={e => { setAttDate(e.target.value); fetchAttendance(e.target.value); }} />
                    </div>
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th className="ps-4">Employee</th>
                                    <th>Status</th>
                                    <th className="text-center">Quick Actions</th>
                                    <th>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map(emp => (
                                    <tr key={emp.id}>
                                        <td className="ps-4 py-3">
                                            <div className="d-flex align-items-center">
                                                <div className="bg-primary bg-opacity-10 text-primary rounded-circle p-2 me-3 fw-bold small" style={{ width: 35, height: 35, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {emp.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="fw-bold">{emp.name}</div>
                                                    <div className="x-small text-muted">{emp.designation}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge rounded-pill ${getAttStatus(emp.id) === 'Present' ? 'bg-success' : getAttStatus(emp.id) === 'Late' ? 'bg-warning text-dark' : 'bg-danger'}`}>
                                                {getAttStatus(emp.id)}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            <div className="btn-group btn-group-sm rounded-pill overflow-hidden border">
                                                <button className={`btn ${getAttStatus(emp.id) === 'Present' ? 'btn-success' : 'btn-white'}`} onClick={() => handleAttChange(emp.id, 'Present')}>P</button>
                                                <button className={`btn ${getAttStatus(emp.id) === 'Late' ? 'btn-warning' : 'btn-white'}`} onClick={() => handleAttChange(emp.id, 'Late')}>L</button>
                                                <button className={`btn ${getAttStatus(emp.id) === 'Absent' ? 'btn-danger' : 'btn-white'}`} onClick={() => handleAttChange(emp.id, 'Absent')}>A</button>
                                                <button className={`btn ${getAttStatus(emp.id) === 'Half-Day' ? 'btn-info text-white' : 'btn-white'}`} onClick={() => handleAttChange(emp.id, 'Half-Day')}>H</button>
                                            </div>
                                        </td>
                                        <td>
                                            <input type="text" className="form-control form-control-sm border-0 bg-light" placeholder="Note..." onBlur={(e) => {
                                                if (e.target.value) api.post('/hr/attendance', { employee_id: emp.id, date: attDate, remarks: e.target.value });
                                            }} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'leaves' && (
                <div className="card border-0 shadow-sm rounded-4">
                    <div className="card-header bg-white border-bottom p-4 d-flex justify-content-between align-items-center">
                        <h5 className="fw-bold mb-0">Manage Leaves</h5>
                        <button className="btn btn-dark btn-sm rounded-pill px-3" onClick={() => setShowLeaveModal(true)}>
                            <i className="fa-solid fa-plus me-1"></i> New Request
                        </button>
                    </div>
                    <div className="table-responsive">
                        <table className="table align-middle table-hover">
                            <thead className="bg-light">
                                <tr>
                                    <th className="ps-4 text-muted x-small ls-1">REQUESTER</th>
                                    <th className="text-muted x-small ls-1">TYPE</th>
                                    <th className="text-muted x-small ls-1">PERIOD</th>
                                    <th className="text-muted x-small ls-1">STATUS</th>
                                    <th className="text-center text-muted x-small ls-1">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaves.map(lv => (
                                    <tr key={lv.id}>
                                        <td className="ps-4 py-3">
                                            <div className="fw-bold">{lv.employee_id?.name}</div>
                                            <div className="x-small text-muted">{lv.reason}</div>
                                        </td>
                                        <td><span className="badge bg-secondary-subtle text-secondary border">{lv.leave_type}</span></td>
                                        <td>
                                            <div className="small fw-medium">{new Date(lv.start_date).toLocaleDateString()} - {new Date(lv.end_date).toLocaleDateString()}</div>
                                            <div className="x-small text-muted">{lv.total_days || 0} days</div>
                                        </td>
                                        <td>
                                            <span className={`badge ${lv.status === 'Approved' ? 'bg-success' : lv.status === 'Rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                                {lv.status}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            {lv.status === 'Pending' && (
                                                <div className="d-flex justify-content-center gap-2">
                                                    <button className="btn btn-sm btn-success rounded-circle p-0" title="Approve" style={{ width: 28, height: 28 }} onClick={() => handleLeaveStatus(lv.id, 'Approved')}>
                                                        <i className="fa-solid fa-check small"></i>
                                                    </button>
                                                    <button className="btn btn-sm btn-danger rounded-circle p-0" title="Reject" style={{ width: 28, height: 28 }} onClick={() => handleLeaveStatus(lv.id, 'Rejected')}>
                                                        <i className="fa-solid fa-xmark small"></i>
                                                    </button>
                                                </div>
                                            )}
                                            {lv.status !== 'Pending' && <div className="x-small text-muted">by {lv.approved_by || 'System'}</div>}
                                        </td>
                                    </tr>
                                ))}
                                {leaves.length === 0 && <tr><td colSpan="5" className="text-center py-5 text-muted">No leave requests found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'employees' && (
                <div className="row g-4">
                    {employees.map(emp => (
                        <div className="col-md-4" key={emp.id}>
                            <div className="card border-0 shadow-sm rounded-4 hover-shadow transition-all">
                                <div className="card-body p-4">
                                    <div className="d-flex align-items-center mb-3">
                                        <div className="bg-primary bg-opacity-5 text-primary rounded-4 p-3 me-3">
                                            <i className="fa-solid fa-user-tie fs-4"></i>
                                        </div>
                                        <div>
                                            <h6 className="fw-bold mb-0">{emp.name}</h6>
                                            <div className="x-small text-muted">{emp.designation} | {emp.department}</div>
                                        </div>
                                    </div>
                                    <div className="border-top pt-3 mt-3">
                                        <div className="d-flex align-items-center gap-2 mb-2 text-muted small">
                                            <i className="fa-solid fa-envelope w-20px"></i> {emp.email || 'No email set'}
                                        </div>
                                        <div className="d-flex align-items-center gap-2 text-muted small">
                                            <i className="fa-solid fa-phone w-20px"></i> {emp.phone || 'No phone set'}
                                        </div>
                                    </div>
                                    <div className="mt-3 d-flex justify-content-between align-items-center">
                                        <span className={`badge ${emp.status === 'Active' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} border px-3`}>{emp.status}</span>
                                        <button className="btn btn-link btn-sm text-primary p-0 text-decoration-none">View Profile <i className="fa-solid fa-arrow-right-long ms-1"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showLeaveModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <form className="modal-content border-0 shadow-lg rounded-4" onSubmit={handleSaveLeave}>
                            <div className="modal-header border-0 p-4 pb-0">
                                <h5 className="fw-bold m-0">Create Leave Request</h5>
                                <button type="button" className="btn-close" onClick={() => setShowLeaveModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="row g-3">
                                    <div className="col-12">
                                        <label className="form-label small fw-bold">Select Employee</label>
                                        <select className="form-select border-0 bg-light shadow-sm" value={leaveForm.employee_id} onChange={e => setLeaveForm({ ...leaveForm, employee_id: e.target.value })} required>
                                            <option value="">-- Choose Employee --</option>
                                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label small fw-bold">Leave Type</label>
                                        <select className="form-select border-0 bg-light shadow-sm" value={leaveForm.leave_type} onChange={e => setLeaveForm({ ...leaveForm, leave_type: e.target.value })} required>
                                            <option value="Casual">Casual</option>
                                            <option value="Sick">Sick</option>
                                            <option value="Annual">Annual</option>
                                            <option value="Unpaid">Unpaid</option>
                                        </select>
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label small fw-bold">Start Date</label>
                                        <input type="date" className="form-control border-0 bg-light shadow-sm" value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })} required />
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label small fw-bold">End Date</label>
                                        <input type="date" className="form-control border-0 bg-light shadow-sm" value={leaveForm.end_date} onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })} required />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label small fw-bold">Reason / Note</label>
                                        <textarea className="form-control border-0 bg-light shadow-sm" rows="3" value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}></textarea>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer border-0 p-4 pt-0">
                                <button type="submit" className="btn btn-primary w-100 py-2 rounded-3 fw-bold shadow-sm">Submit Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default HRManagement;
