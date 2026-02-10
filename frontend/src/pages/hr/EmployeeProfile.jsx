import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { getFileURL } from '../../utils/urlHelper';

const EmployeeProfile = () => {
    const { id } = useParams();
    const [employee, setEmployee] = useState(null);
    const [history, setHistory] = useState([]);
    const [onboardingProgress, setOnboardingProgress] = useState([]);
    const [viewingOnboard, setViewingOnboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [todayAttendance, setTodayAttendance] = useState(null);

    // Career Change Modal State
    const [careerChange, setCareerChange] = useState({
        change_type: 'Promotion',
        effective_date: new Date().toISOString().split('T')[0],
        new_designation: '',
        new_department: '',
        new_salary: 0,
        reason: ''
    });

    const fetchData = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const [empRes, histRes, onboardRes, attendRes] = await Promise.all([
                api.get(`/hr/employees/${id}`),
                api.get(`/hr/employees/${id}/history`),
                api.get(`/onboarding/progress/${id}`),
                api.get(`/hr/attendance?employee_id=${id}&start_date=${today}&end_date=${today}`)
            ]);
            setEmployee(empRes.data);
            setHistory(histRes.data);
            setOnboardingProgress(onboardRes.data);
            setTodayAttendance(attendRes.data[0] || null);

            // Sync career change form with current values
            if (empRes.data) {
                setCareerChange(prev => ({
                    ...prev,
                    new_designation: empRes.data.employment_info?.current_designation || '',
                    new_department: empRes.data.employment_info?.current_department || '',
                    new_salary: empRes.data.compensation?.current_salary || 0
                }));
            }
        } catch (err) {
            console.error('Error fetching employee profile:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchData();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [id]);

    const handleResetOnboarding = async () => {
        if (!window.confirm('Are you sure you want to reset onboarding for this employee? All current progress, signatures, and form data will be permanently deleted.')) return;

        try {
            await api.post(`/onboarding/reset/${id}`);
            alert('Onboarding reset successfully.');
            fetchData();
        } catch (err) {
            console.error('Error resetting onboarding:', err);
            alert(err.response?.data?.detail || 'Reset failed');
        }
    };

    const handleCareerChange = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hr/career-change', {
                employee_id: id,
                change_type: careerChange.change_type,
                effective_date: careerChange.effective_date,
                reason: careerChange.reason,
                new_values: {
                    designation: careerChange.new_designation,
                    department: careerChange.new_department,
                    salary: careerChange.new_salary
                }
            });

            // Close modal safely
            if (window.bootstrap && window.bootstrap.Modal) {
                const modal = document.getElementById('careerChangeModal');
                const bsModal = window.bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            }

            fetchData();
            alert('Career history updated successfully!');
        } catch (err) {
            console.error('Error recording career change:', err);
            alert(err.response?.data?.message || 'Update failed');
        }
    };

    if (loading) return (
        <Layout title="Employee Profile">
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status"></div>
            </div>
        </Layout>
    );

    if (!employee) return (
        <Layout title="Employee Profile">
            <div className="text-center py-5">Employee not found.</div>
        </Layout>
    );

    return (
        <Layout
            title="Profile Details"
            actions={
                <div className="d-flex gap-2">
                    <button className="btn btn-light rounded-pill px-4">
                        <i className="fa-solid fa-pen-to-square me-2"></i> Edit Profile
                    </button>
                    <button className="btn btn-outline-primary rounded-pill px-4" data-bs-toggle="modal" data-bs-target="#careerChangeModal">
                        <i className="fa-solid fa-arrow-up-right-dots me-2"></i> Promotion / Change
                    </button>
                </div>
            }
        >
            {/* Profile Header Card */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 bg-gradient-light">
                <div className="card-body p-4 p-lg-5">
                    <div className="row align-items-center">
                        <div className="col-auto">
                            <div className="bg-primary bg-opacity-25 text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold display-4 shadow-sm" style={{ width: 120, height: 120 }}>
                                {employee.personal_info?.full_name?.charAt(0) || '?'}
                            </div>
                        </div>
                        <div className="col">
                            <div className="d-flex align-items-center gap-3 mb-1">
                                <h1 className="fw-bold mb-0 text-bright">{employee.personal_info?.full_name}</h1>
                                <span className={`badge rounded-pill px-3 py-1 ${employee.employment_info?.status === 'Active' ? 'bg-success text-white' : 'bg-secondary text-white'}`}>
                                    {employee.employment_info?.status}
                                </span>
                            </div>
                            <div className="fs-5 text-muted mb-3">
                                {employee.employment_info?.current_designation} <span className="mx-2 fs-6 opacity-25">|</span> {employee.employment_info?.current_department}
                            </div>
                            <div className="d-flex flex-wrap gap-4 mt-2">
                                <div className="d-flex align-items-center gap-2">
                                    <div className="bg-white rounded-circle shadow-sm p-2 text-primary" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fa-solid fa-fingerprint small"></i>
                                    </div>
                                    <span className="small fw-bold text-muted">{employee.employee_id}</span>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="bg-white rounded-circle shadow-sm p-2 text-primary" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fa-solid fa-id-card small"></i>
                                    </div>
                                    <span className="small fw-bold text-muted">RFID: {employee.rfid_card_number || 'Not Linked'}</span>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="bg-white rounded-circle shadow-sm p-2 text-primary" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fa-solid fa-calendar-day small"></i>
                                    </div>
                                    <span className="small fw-bold text-muted">Joined {employee.employment_info?.joining_date ? new Date(employee.employment_info.joining_date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'N/A'}</span>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="bg-warning-subtle text-warning-emphasis rounded-pill px-3 py-1 small fw-bold border border-warning-subtle shadow-sm">
                                        <i className="fa-solid fa-award me-1"></i> {employee.tenure_years || 0} Years
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Tabs */}
            <div className="row g-4">
                <div className="col-lg-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white">
                        <button
                            className={`btn text-start py-3 px-4 rounded-4 mb-2 d-flex align-items-center gap-3 transition-all ${activeTab === 'overview' ? 'btn-primary shadow-sm' : 'btn-light border-0'}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            <i className="fa-solid fa-id-card-clip fs-5"></i>
                            <span className="fw-bold">General Profile</span>
                        </button>
                        <button
                            className={`btn text-start py-3 px-4 rounded-4 mb-2 d-flex align-items-center gap-3 transition-all ${activeTab === 'history' ? 'btn-primary shadow-sm' : 'btn-light border-0'}`}
                            onClick={() => setActiveTab('history')}
                        >
                            <i className="fa-solid fa-timeline fs-5"></i>
                            <span className="fw-bold">Career History</span>
                        </button>
                        <button
                            className={`btn text-start py-3 px-4 rounded-4 mb-2 d-flex align-items-center gap-3 transition-all ${activeTab === 'onboarding' ? 'btn-primary shadow-sm' : 'btn-light border-0'}`}
                            onClick={() => setActiveTab('onboarding')}
                        >
                            <i className="fa-solid fa-graduation-cap fs-5"></i>
                            <span className="fw-bold">Onboarding</span>
                        </button>
                    </div>

                    <div className="card border-0 shadow-sm rounded-4 p-4 mt-4 bg-white">
                        <h6 className="text-muted fw-bold text-uppercase x-small mb-4">Compensation Info</h6>
                        <div className="mb-4">
                            <div className="x-small text-muted mb-1">Current Base Salary</div>
                            <h4 className="fw-bold mb-0 text-dark">BDT {employee.compensation?.current_salary?.toLocaleString() || '0'}</h4>
                        </div>
                        <div className="border-top pt-3">
                            <div className="small text-muted mb-2"><i className="fa-solid fa-building-columns me-2 small"></i> Bank Details</div>
                            <div className="small fw-bold text-dark">{employee.compensation?.bank_name || 'N/A'}</div>
                            <div className="x-small text-muted">{employee.compensation?.bank_account || 'N/A'}</div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-9">
                    {/* Tab Content: Overview */}
                    {activeTab === 'overview' && (
                        <div className="card border-0 shadow-sm rounded-4 p-4 p-lg-5 bg-white h-100">
                            <h4 className="fw-bold mb-4">Personal Information</h4>
                            <div className="row g-4">
                                <div className="col-md-6">
                                    <div className="mb-4">
                                        <label className="text-muted x-small fw-bold text-uppercase mb-1">Contact Email</label>
                                        <div className="fw-bold text-dark">{employee.personal_info?.email || '—'}</div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="text-muted x-small fw-bold text-uppercase mb-1">Phone Number</label>
                                        <div className="fw-bold text-dark">{employee.personal_info?.phone || '—'}</div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="text-muted x-small fw-bold text-uppercase mb-1">Date of Birth</label>
                                        <div className="fw-bold text-dark">{employee.personal_info?.date_of_birth ? new Date(employee.personal_info.date_of_birth).toLocaleDateString() : '—'}</div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="text-muted x-small fw-bold text-uppercase mb-1">National ID</label>
                                        <div className="fw-bold text-dark">{employee.personal_info?.national_id || '—'}</div>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="card shadow-sm border-0 rounded-4 bg-light p-4 mb-4">
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <h6 className="fw-bold text-muted text-uppercase x-small mb-0">Live Attendance Status</h6>
                                            <span className={`badge rounded-pill ${todayAttendance?.punch_in && !todayAttendance?.punch_out ? 'bg-success pulse-animation' : 'bg-secondary'}`}>
                                                {todayAttendance?.punch_in && !todayAttendance?.punch_out ? 'On Premise' : 'Off Premise'}
                                            </span>
                                        </div>
                                        <div className="display-6 fw-bold text-dark font-monospace mb-2">
                                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </div>
                                        <div className="row g-2 mt-2 pt-3 border-top">
                                            <div className="col-6">
                                                <div className="x-small text-muted mb-1">Punched In</div>
                                                <div className="fw-bold small text-dark">{todayAttendance?.punch_in ? new Date(todayAttendance.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
                                            </div>
                                            <div className="col-6 text-end">
                                                <div className="x-small text-muted mb-1">Hours Today</div>
                                                <div className="fw-bold small text-primary">
                                                    {(() => {
                                                        let h = todayAttendance?.total_hours || 0;
                                                        if (todayAttendance?.punch_in && !todayAttendance?.punch_out) {
                                                            const diff = (currentTime - new Date(todayAttendance.punch_in)) / 3600000;
                                                            h += diff;
                                                        }
                                                        return h.toFixed(2);
                                                    })()}h
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="text-muted x-small fw-bold text-uppercase mb-1">Gender / Blood Group</label>
                                        <div className="fw-bold text-dark">{employee.personal_info?.gender || '—'} / {employee.personal_info?.blood_group || '—'}</div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="text-muted x-small fw-bold text-uppercase mb-1">Present Address</label>
                                        <div className="small text-dark fw-bold" style={{ maxWidth: 300 }}>{employee.personal_info?.present_address || '—'}</div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="text-muted x-small fw-bold text-uppercase mb-1">Emergency Contact</label>
                                        <div className="fw-bold text-dark">{employee.personal_info?.emergency_contact || '—'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab Content: History */}
                    {activeTab === 'history' && (
                        <div className="card border-0 shadow-sm rounded-4 p-4 p-lg-5 bg-white h-100">
                            <h4 className="fw-bold mb-4">Career Journey</h4>
                            <div className="timeline-container px-3 px-lg-4 py-2 border-start ms-4">
                                {/* Current Position Item */}
                                <div className="timeline-item position-relative mb-5 pb-3">
                                    <div className="timeline-dot position-absolute bg-primary rounded-circle" style={{ width: 20, height: 20, left: -44, top: 0, border: '4px solid white', boxShadow: '0 0 0 4px #eef2ff' }}></div>
                                    <div className="d-flex justify-content-between align-items-start">
                                        <div>
                                            <div className="badge bg-primary rounded-pill px-3 py-1 mb-2 small">CURRENT POSITION</div>
                                            <h5 className="fw-bold text-dark mb-1">{employee.employment_info?.current_designation}</h5>
                                            <div className="text-muted small mb-3">{employee.employment_info?.current_department} <span className="mx-2">•</span> Joined {employee.employment_info?.joining_date ? new Date(employee.employment_info.joining_date).toLocaleDateString() : 'N/A'}</div>
                                        </div>
                                        <div className="text-end">
                                            <div className="fw-bold text-primary">{employee.compensation?.current_salary?.toLocaleString() || '0'} BDT</div>
                                        </div>
                                    </div>
                                </div>

                                {/* History Items */}
                                {history.length === 0 ? (
                                    <div className="text-muted small opacity-75">No recorded career changes yet. Initial recruitment record is shown above.</div>
                                ) : (
                                    history.map((h, i) => (
                                        <div className="timeline-item position-relative mb-5 pb-3" key={h._id}>
                                            <div className="timeline-dot position-absolute bg-light rounded-circle border" style={{ width: 16, height: 16, left: -42, top: 2 }}></div>
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <div className={`badge rounded-pill px-2 py-1 mb-2 x-small ${h.change_type === 'Promotion' ? 'bg-success text-white' : h.change_type === 'Increment' ? 'bg-info text-dark' : 'bg-light text-muted'}`}>
                                                        {h.change_type?.toUpperCase()}
                                                    </div>
                                                    <h6 className="fw-bold text-dark mb-1">{h.new_values?.designation} <i className="fa-solid fa-arrow-right-long text-muted mx-2 small"></i> {h.previous_values?.designation}</h6>
                                                    <div className="text-muted extra-small mb-2">Effective: {h.effective_date ? new Date(h.effective_date).toLocaleDateString() : 'N/A'} <span className="mx-2">•</span> Approved by: {h.approved_by}</div>
                                                    <p className="small text-muted bg-light p-2 rounded-3" style={{ maxWidth: 400 }}>{h.reason}</p>
                                                </div>
                                                <div className="text-end">
                                                    <div className="fw-bold x-small text-muted">{h.previous_values?.salary?.toLocaleString()} →</div>
                                                    <div className="fw-bold text-dark">{h.new_values?.salary?.toLocaleString()} BDT</div>
                                                    {h.increment_percentage && <div className="text-success extra-small fw-bold">+{h.increment_percentage}% Increase</div>}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tab Content: Onboarding */}
                    {activeTab === 'onboarding' && (
                        <div className="card border-0 shadow-sm rounded-4 p-4 p-lg-5 bg-white h-100">
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h4 className="fw-bold mb-0 text-bright">Onboarding Progress</h4>
                                <div className="d-flex align-items-center gap-3">
                                    <button
                                        className="btn btn-sm btn-outline-danger rounded-pill px-3"
                                        onClick={handleResetOnboarding}
                                        title="Clear all progress and ask employee to start over"
                                    >
                                        <i className="fa-solid fa-rotate-left me-1"></i> Reset Onboarding
                                    </button>
                                    <span className={`badge rounded-pill px-3 py-2 ${employee.onboarding_status === 'Completed' ? 'bg-success text-white' : 'bg-warning text-white'}`}>
                                        {employee.onboarding_status || 'Pending'}
                                    </span>
                                </div>
                            </div>

                            {onboardingProgress.length === 0 ? (
                                <div className="text-center py-5 text-muted">No onboarding history found for this employee.</div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Material</th>
                                                <th>Status</th>
                                                <th>Date</th>
                                                <th>Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {onboardingProgress.map(p => (
                                                <tr key={p._id}>
                                                    <td>
                                                        <div className="fw-bold small text-bright">{p.content_id?.title}</div>
                                                        <div className="x-small text-muted text-uppercase">{p.content_id?.type}</div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge rounded-pill ${p.status === 'Completed' ? 'bg-success' :
                                                            p.status === 'Acknowledged' ? 'bg-info' : 'bg-secondary'}`}>
                                                            {p.status}
                                                        </span>
                                                    </td>
                                                    <td className="small">{p.completed_at ? new Date(p.completed_at).toLocaleDateString() : 'N/A'}</td>
                                                    <td>
                                                        {p.digital_signature && (
                                                            <div className="x-small">
                                                                <span className="fw-bold text-primary font-monospace">{p.digital_signature}</span>
                                                            </div>
                                                        )}
                                                        {p.form_data && (
                                                            <button
                                                                className="btn btn-xs btn-outline-primary py-0 px-2 rounded-pill x-small mt-1"
                                                                onClick={() => setViewingOnboard(p)}
                                                            >
                                                                <i className="fa-solid fa-list-ul me-1"></i> Data
                                                            </button>
                                                        )}
                                                        {p.progress_file_path && (
                                                            <a href={`${getFileURL(p.progress_file_path)}`} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-outline-secondary py-0 px-2 rounded-pill x-small mt-1 d-inline-block">
                                                                <i className="fa-solid fa-file-pdf me-1"></i> File
                                                            </a>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div >

            {/* Career Change Modal */}
            < div className="modal fade" id="careerChangeModal" tabIndex="-1" >
                <div className="modal-dialog modal-dialog-centered">
                    <form className="modal-content border-0 shadow-lg rounded-4" onSubmit={handleCareerChange}>
                        <div className="modal-header border-0 p-4 pb-0">
                            <h5 className="fw-bold m-0 text-bright">Record Promotion & Change</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body p-4">
                            <div className="row g-3">
                                <div className="col-12">
                                    <label className="form-label x-small fw-bold text-muted text-uppercase mb-1">Change Type</label>
                                    <select
                                        className="form-select rounded-3 bg-light border-0 shadow-none px-3"
                                        value={careerChange.change_type}
                                        onChange={e => setCareerChange({ ...careerChange, change_type: e.target.value })}
                                    >
                                        <option value="Promotion">Promotion</option>
                                        <option value="Transfer">Department Transfer</option>
                                        <option value="Increment">Salary Increment</option>
                                        <option value="Demotion">Demotion</option>
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label x-small fw-bold text-muted text-uppercase mb-1">New Designation</label>
                                    <input
                                        type="text"
                                        className="form-control rounded-3 bg-light border-0 shadow-none px-3"
                                        value={careerChange.new_designation}
                                        onChange={e => setCareerChange({ ...careerChange, new_designation: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label x-small fw-bold text-muted text-uppercase mb-1">New Department</label>
                                    <input
                                        type="text"
                                        className="form-control rounded-3 bg-light border-0 shadow-none px-3"
                                        value={careerChange.new_department}
                                        onChange={e => setCareerChange({ ...careerChange, new_department: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label x-small fw-bold text-muted text-uppercase mb-1">Effective Date</label>
                                    <input
                                        type="date"
                                        className="form-control rounded-3 bg-light border-0 shadow-none px-3"
                                        value={careerChange.effective_date}
                                        onChange={e => setCareerChange({ ...careerChange, effective_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label x-small fw-bold text-muted text-uppercase mb-1">New Salary (BDT)</label>
                                    <input
                                        type="number"
                                        className="form-control rounded-3 bg-light border-0 shadow-none px-3 fw-bold"
                                        value={careerChange.new_salary}
                                        onChange={e => setCareerChange({ ...careerChange, new_salary: Number(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div className="col-12">
                                    <label className="form-label x-small fw-bold text-muted text-uppercase mb-1">Reason / Notes</label>
                                    <textarea
                                        className="form-control rounded-3 bg-light border-0 shadow-none px-3"
                                        rows="2"
                                        value={careerChange.reason}
                                        onChange={e => setCareerChange({ ...careerChange, reason: e.target.value })}
                                        placeholder="e.g. Annual appraisal 2026..."
                                    ></textarea>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer border-0 p-4 pt-0">
                            <button type="submit" className="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow-sm transition-all border-0">
                                <i className="fa-solid fa-cloud-arrow-up me-2"></i> Save Changes to History
                            </button>
                        </div>
                    </form>
                </div>
            </div >

            {/* Onboarding Data Details Modal */}
            {
                viewingOnboard && (
                    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                                <div className="modal-header border-0 p-4 pb-0">
                                    <h5 className="fw-bold m-0 text-bright">Submission Details</h5>
                                    <button type="button" className="btn-close" onClick={() => setViewingOnboard(null)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <div className="text-center mb-4">
                                        <div className="badge bg-primary-subtle text-primary rounded-pill px-3 py-2 mb-2">
                                            {viewingOnboard.content_id?.title}
                                        </div>
                                        <h6 className="text-muted small">Information provided by Student</h6>
                                    </div>

                                    <div className="bg-light rounded-4 p-3 border">
                                        {Object.entries(viewingOnboard.form_data || {}).map(([key, value], idx) => (
                                            <div key={idx} className={`mb-3 ${idx < Object.entries(viewingOnboard.form_data || {}).length - 1 ? 'border-bottom pb-2' : ''}`}>
                                                <label className="extra-small fw-bold text-muted text-uppercase d-block mb-1">{key}</label>
                                                {typeof value === 'string' && (value.includes('uploads/') || value.includes('uploads\\')) ? (
                                                    <a href={`${getFileURL(value)}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-light rounded-pill px-3 mt-1 shadow-sm border">
                                                        <i className="fa-solid fa-file-image me-2 text-primary"></i> View Uploaded File
                                                    </a>
                                                ) : (
                                                    <div className="fw-bold text-dark">{value || 'N/A'}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="modal-footer border-0 p-4 pt-0">
                                    <button type="button" className="btn btn-light rounded-pill px-4 w-100 py-2 fw-bold" onClick={() => setViewingOnboard(null)}>Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </Layout >
    );
};

export default EmployeeProfile;
