import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/axios';

const EmployeeForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [form, setForm] = useState({
        employee_id: '',
        rfid_card_number: '',
        personal_info: {
            full_name: '',
            date_of_birth: '',
            gender: '',
            blood_group: '',
            phone: '',
            email: '',
            national_id: '',
            present_address: '',
            permanent_address: '',
            emergency_contact: ''
        },
        employment_info: {
            joining_date: new Date().toISOString().split('T')[0],
            joining_position: '',
            current_designation: '',
            current_department: '',
            employment_type: 'Full-time',
            status: 'Active',
            shift_id: ''
        },
        compensation: {
            current_salary: 0,
            bank_name: '',
            bank_account: ''
        }
    });

    const [loading, setLoading] = useState(isEdit);
    const [leaveBalances, setLeaveBalances] = useState([]);

    useEffect(() => {
        if (isEdit) {
            const fetchEmployee = async () => {
                try {
                    const res = await api.get(`/hr/employees/${id}`);
                    const data = res.data;
                    // Format dates for input fields
                    if (data.employment_info?.joining_date) {
                        data.employment_info.joining_date = new Date(data.employment_info.joining_date).toISOString().split('T')[0];
                    }
                    if (data.personal_info?.date_of_birth) {
                        data.personal_info.date_of_birth = new Date(data.personal_info.date_of_birth).toISOString().split('T')[0];
                    }
                    if (data.employment_info?.reporting_manager_id?._id) {
                        data.employment_info.reporting_manager_id = data.employment_info.reporting_manager_id._id;
                    }
                    if (data.employment_info?.shift_id?._id) {
                        data.employment_info.shift_id = data.employment_info.shift_id._id;
                    }
                    setForm(data);
                } catch (err) {
                    console.error('Error fetching employee:', err);
                    alert('Failed to load employee data');
                } finally {
                    // Fetch linked user if edit mode
                    if (isEdit) {
                        try {
                            const userRes = await api.get(`/admin/users/employee/${id}`);
                            setForm(prev => ({ ...prev, user_account: userRes.data }));
                        } catch (err) {
                            console.log('No user account linked');
                        }

                        // Fetch Leave Balances (Quotas)
                        try {
                            const balRes = await api.get(`/hr/leaves/balances/${id}`);
                            setLeaveBalances(balRes.data);
                        } catch (err) {
                            console.error('Error fetching leave balances:', err);
                        }
                    }
                    setLoading(false);
                }
            };
            fetchEmployee();
        }
    }, [id, isEdit]);

    const [employees, setEmployees] = useState([]);
    const [shifts, setShifts] = useState([]); // NEW
    const [showUserModal, setShowUserModal] = useState(false);
    const [userForm, setUserForm] = useState({ username: '', password: '', role: 'ESS' });
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Fetch All Active Employees (for Manager dropdown)
                const empRes = await api.get('/hr/employees?status=Active');
                setEmployees(empRes.data);

                // Fetch All Leave Types (to set default quotas)
                const typeRes = await api.get('/hr/leave-types');

                // Fetch All Shifts
                const shiftRes = await api.get('/hr/shifts');
                setShifts(shiftRes.data);

                if (isEdit) {
                    // Handled in the separate ID-based useEffect
                } else {
                    // For new employees, pre-fill leaveBalances with defaults
                    const defaults = typeRes.data.map(type => ({
                        leave_type: type,
                        total_quota: type.default_days
                    }));
                    setLeaveBalances(defaults);
                }
            } catch (err) {
                console.error('Error fetching initial form data:', err);
            }
        };
        fetchInitialData();
    }, [isEdit]);


    const handleChange = (section, field, value) => {
        if (section) {
            setForm(prev => ({
                ...prev,
                [section]: {
                    ...prev[section],
                    [field]: value
                }
            }));
        } else {
            setForm(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleQuotaChange = (type_id, value) => {
        setLeaveBalances(prev => prev.map(b =>
            b.leave_type._id === type_id ? { ...b, total_quota: Number(value) } : b
        ));
    };

    const handleCreateAccess = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/admin/users', {
                ...userForm,
                employee_id: id
            });
            setForm(prev => ({ ...prev, user_account: res.data }));
            setShowUserModal(false);
            alert('Access enabled successfully!');
        } catch (err) {
            alert('Failed to create access: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Clean up data before sending
            const submittedData = JSON.parse(JSON.stringify(form));

            // If RFID is empty string, make it undefined so sparse indexing works correctly
            if (!submittedData.rfid_card_number || submittedData.rfid_card_number.trim() === '') {
                delete submittedData.rfid_card_number;
            }

            // Clean up empty dates to avoid CastError
            if (!submittedData.personal_info.date_of_birth) {
                delete submittedData.personal_info.date_of_birth;
            }

            // Clean up empty blood group to avoid Enum validation error
            if (!submittedData.personal_info.blood_group) {
                delete submittedData.personal_info.blood_group;
            }

            if (isEdit) {
                await api.put(`/hr/employees/${id}`, submittedData);
            } else {
                const res = await api.post('/hr/employees', submittedData);
                // Get the newly created employee ID
                const newEmpId = res.data._id;

                // Save Quotas for new employee
                for (const bal of leaveBalances) {
                    await api.post('/hr/leaves/allocate', {
                        employee_id: newEmpId,
                        leave_type_id: bal.leave_type._id,
                        total_days: bal.total_quota
                    });
                }
            }

            // Save Quotas (For Edit mode)
            if (isEdit) {
                for (const bal of leaveBalances) {
                    await api.post('/hr/leaves/allocate', {
                        employee_id: id,
                        leave_type_id: bal.leave_type._id,
                        total_days: bal.total_quota
                    });
                }
            }
            navigate('/hr/employees');
        } catch (err) {
            console.error('Error saving employee:', err);
            alert(err.response?.data?.message || 'Failed to save employee data');
        }
    };

    if (loading) return (
        <Layout title={isEdit ? "Edit Employee" : "Add New Employee"}>
            <div className="d-flex justify-content-center py-5">
                <div className="spinner-border text-primary"></div>
            </div>
        </Layout>
    );

    return (
        <Layout title={isEdit ? "Edit Employee Profile" : "Onboard New Employee"}>
            <form onSubmit={handleSubmit}>
                <div className="row g-4">
                    {/* Primary Info */}
                    <div className="col-lg-8">
                        <div className="card border-0 shadow-sm rounded-4 mb-4">
                            <div className="card-header bg-white border-0 p-4 pb-0">
                                <h5 className="fw-bold mb-0">Personal Information</h5>
                            </div>
                            <div className="card-body p-4">
                                <div className="row g-3">
                                    <div className="col-md-8">
                                        <label className="form-label small fw-bold text-muted">Full Name</label>
                                        <input
                                            type="text"
                                            className="form-control rounded-3"
                                            value={form.personal_info.full_name}
                                            onChange={e => handleChange('personal_info', 'full_name', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted">Joining ID</label>
                                        <input
                                            type="text"
                                            className="form-control rounded-3 font-monospace"
                                            placeholder="EMP-XXX"
                                            value={form.employee_id}
                                            onChange={e => handleChange(null, 'employee_id', e.target.value)}
                                            required
                                            readOnly={isEdit}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-muted">Email Address</label>
                                        <input
                                            type="email"
                                            className="form-control rounded-3"
                                            value={form.personal_info.email}
                                            onChange={e => handleChange('personal_info', 'email', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-muted">Phone Number</label>
                                        <input
                                            type="text"
                                            className="form-control rounded-3"
                                            value={form.personal_info.phone}
                                            onChange={e => handleChange('personal_info', 'phone', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted">Date of Birth</label>
                                        <input
                                            type="date"
                                            className="form-control rounded-3"
                                            value={form.personal_info.date_of_birth}
                                            onChange={e => handleChange('personal_info', 'date_of_birth', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted">Gender</label>
                                        <select
                                            className="form-select rounded-3"
                                            value={form.personal_info.gender}
                                            onChange={e => handleChange('personal_info', 'gender', e.target.value)}
                                        >
                                            <option value="">Select</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted">Blood Group</label>
                                        <select
                                            className="form-select rounded-3"
                                            value={form.personal_info.blood_group}
                                            onChange={e => handleChange('personal_info', 'blood_group', e.target.value)}
                                        >
                                            <option value="">Select</option>
                                            <option value="A+">A+</option>
                                            <option value="A-">A-</option>
                                            <option value="B+">B+</option>
                                            <option value="B-">B-</option>
                                            <option value="O+">O+</option>
                                            <option value="O-">O-</option>
                                            <option value="AB+">AB+</option>
                                            <option value="AB-">AB-</option>
                                        </select>
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label small fw-bold text-muted">Emergency Contact</label>
                                        <input
                                            type="text"
                                            className="form-control rounded-3"
                                            placeholder="Name - Relationship - Phone"
                                            value={form.personal_info.emergency_contact}
                                            onChange={e => handleChange('personal_info', 'emergency_contact', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-muted">Present Address</label>
                                        <textarea
                                            className="form-control rounded-3"
                                            rows="2"
                                            value={form.personal_info.present_address}
                                            onChange={e => handleChange('personal_info', 'present_address', e.target.value)}
                                        ></textarea>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-muted">Permanent Address</label>
                                        <textarea
                                            className="form-control rounded-3"
                                            rows="2"
                                            value={form.personal_info.permanent_address}
                                            onChange={e => handleChange('personal_info', 'permanent_address', e.target.value)}
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card border-0 shadow-sm rounded-4 mb-4">
                            <div className="card-header bg-white border-0 p-4 pb-0">
                                <h5 className="fw-bold mb-0">Employment & Compensation</h5>
                            </div>
                            <div className="card-body p-4">
                                <div className="row g-3">
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted">Joining Position</label>
                                        <input
                                            type="text"
                                            className="form-control rounded-3"
                                            value={form.employment_info.joining_position}
                                            onChange={e => handleChange('employment_info', 'joining_position', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted">Current Designation</label>
                                        <input
                                            type="text"
                                            className="form-control rounded-3"
                                            value={form.employment_info.current_designation}
                                            onChange={e => handleChange('employment_info', 'current_designation', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted">Department</label>
                                        <input
                                            type="text"
                                            className="form-control rounded-3"
                                            value={form.employment_info.current_department}
                                            onChange={e => handleChange('employment_info', 'current_department', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted">Joining Date</label>
                                        <input
                                            type="date"
                                            className="form-control rounded-3"
                                            value={form.employment_info.joining_date}
                                            onChange={e => handleChange('employment_info', 'joining_date', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted">Employment Type</label>
                                        <select
                                            className="form-select rounded-3"
                                            value={form.employment_info.employment_type}
                                            onChange={e => handleChange('employment_info', 'employment_type', e.target.value)}
                                        >
                                            <option value="Full-time">Full-time</option>
                                            <option value="Contract">Contract</option>
                                            <option value="Intern">Intern</option>
                                            <option value="Part-time">Part-time</option>
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted">Base Salary (BDT)</label>
                                        <input
                                            type="number"
                                            className="form-control rounded-3 fw-bold"
                                            value={form.compensation.current_salary}
                                            onChange={e => handleChange('compensation', 'current_salary', Number(e.target.value))}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted">Working Shift</label>
                                        <select
                                            className="form-select rounded-3 fw-bold"
                                            value={form.employment_info.shift_id || ''}
                                            onChange={e => handleChange('employment_info', 'shift_id', e.target.value)}
                                            required
                                        >
                                            <option value="">Select Shift...</option>
                                            {shifts.map(shift => (
                                                <option key={shift._id} value={shift._id}>{shift.name} ({shift.start_time} - {shift.end_time})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted">Leave Approver (Manager)</label>
                                        <select
                                            className="form-select rounded-3"
                                            value={form.employment_info.reporting_manager_id || ''}
                                            onChange={e => handleChange('employment_info', 'reporting_manager_id', e.target.value)}
                                        >
                                            <option value="">Select Manager...</option>
                                            {employees.filter(e => e._id !== id).map(emp => (
                                                <option key={emp._id} value={emp._id}>{emp.personal_info.full_name} ({emp.employee_id})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Leave Allocation Section */}
                        <div className="card border-0 shadow-sm rounded-4 mb-4">
                            <div className="card-header bg-white border-0 p-4 pb-0 d-flex justify-content-between align-items-center">
                                <h5 className="fw-bold mb-0">Leave Allocation <span className="badge bg-warning-subtle text-warning-emphasis text-uppercase small ms-2">Overrides</span></h5>
                            </div>
                            <div className="card-body p-4">
                                <div className="alert bg-light border-0 small text-muted mb-4">
                                    <i className="fa-solid fa-circle-info me-2"></i>
                                    Modify the annual quota for this specific employee. These values override the default leave policy settings.
                                </div>
                                <div className="row g-3">
                                    {leaveBalances.map((bal, idx) => (
                                        <div key={idx} className="col-md-6 col-lg-4">
                                            <label className="form-label small fw-bold text-muted">{bal.leave_type.name} (Default: {bal.leave_type.default_days})</label>
                                            <div className="input-group">
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    value={bal.total_quota}
                                                    onChange={e => handleQuotaChange(bal.leave_type._id, e.target.value)}
                                                />
                                                <span className="input-group-text bg-light text-muted small">Days</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar components / RFID */}
                    <div className="col-lg-4">
                        <div className="card border-0 shadow-sm rounded-4 mb-4 bg-gradient-primary text-white">
                            <div className="card-body p-4">
                                <h6 className="fw-bold mb-3 d-flex align-items-center">
                                    <i className="fa-solid fa-id-card me-2"></i> RFID Card Integration
                                </h6>
                                <p className="small opacity-75 mb-4">Link an RFID card for automated tracking. Can be added later.</p>
                                <div className="mb-3">
                                    <label className="form-label x-small fw-bold text-white text-opacity-75">CARD IDENTIFIER (UID) <span className="opacity-50">(Optional)</span></label>
                                    <input
                                        type="text"
                                        className="form-control border-white border-opacity-25 bg-white bg-opacity-10 text-white rounded-3 shadow-none"
                                        placeholder="A1 B2 C3 D4"
                                        value={form.rfid_card_number}
                                        onChange={e => handleChange(null, 'rfid_card_number', e.target.value)}
                                    />
                                </div>
                                <div className="extra-small text-white text-opacity-75">
                                    <i className="fa-solid fa-circle-info me-1"></i> Ensure the device is online during linkage.
                                </div>
                            </div>
                        </div>

                        <div className="card border-0 shadow-sm rounded-4 mb-4">
                            <div className="card-body p-4">
                                <h6 className="fw-bold text-muted x-small mb-4 text-uppercase">System Controls</h6>
                                <div className="mb-4">
                                    <label className="form-label small fw-bold text-muted">Account Status</label>
                                    <select
                                        className="form-select rounded-3"
                                        value={form.employment_info.status}
                                        onChange={e => handleChange('employment_info', 'status', e.target.value)}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Probation">Probation</option>
                                        <option value="On Leave">On Leave</option>
                                        <option value="Resigned">Resigned</option>
                                        <option value="Terminated">Terminated</option>
                                    </select>
                                </div>

                                <div className="pt-2">
                                    <button type="submit" className="btn btn-primary w-100 py-3 rounded-3 fw-bold shadow-sm">
                                        <i className="fa-solid fa-cloud-arrow-up me-2"></i> {isEdit ? "Update Directory" : "Complete Onboarding"}
                                    </button>
                                    <button type="button" className="btn btn-light w-100 py-2 rounded-3 mt-3 fw-bold border-0" onClick={() => navigate('/hr/employees')}>
                                        Discard Changes
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="card border-0 shadow-sm rounded-4 mb-4">
                            <div className="card-body p-4">
                                <h6 className="fw-bold text-muted x-small mb-4 text-uppercase">System Access</h6>
                                {form.user_account ? (
                                    <div className="p-3 bg-success-subtle rounded-3 border border-success border-opacity-10 text-center">
                                        <i className="fa-solid fa-circle-check text-success h4 mb-2 d-block"></i>
                                        <span className="fw-bold small d-block">Access Enabled</span>
                                        <code className="extra-small text-success">@{form.user_account.username}</code>
                                    </div>
                                ) : (
                                    <div className="text-center p-3 border border-dashed rounded-4">
                                        <i className="fa-solid fa-user-lock text-muted h4 mb-2 d-block"></i>
                                        <p className="extra-small text-muted mb-3">No system account linked. Employee cannot login to the system.</p>
                                        <button
                                            type="button"
                                            className="btn btn-outline-primary btn-sm rounded-pill fw-bold"
                                            onClick={() => setShowUserModal(true)}
                                        >
                                            Create Access
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="alert bg-info-subtle border-0 rounded-4 p-4">
                            <h6 className="fw-bold text-info mb-1"><i className="fa-solid fa-circle-check me-2"></i> Form Helper</h6>
                            <p className="extra-small text-info text-opacity-75 mb-0">Fields marked with required in the underlying model must be filled. RFID card can be added later if not available during onboarding.</p>
                        </div>
                    </div>
                </div>
            </form>

            {/* User Access Modal */}
            {
                showUserModal && (
                    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog modal-dialog-centered">
                            <form className="modal-content border-0 shadow-lg rounded-4" onSubmit={handleCreateAccess}>
                                <div className="modal-header border-0 p-4 pb-0">
                                    <h5 className="fw-bold m-0">Enable System Access</h5>
                                </div>
                                <div className="modal-body p-4">
                                    <p className="small text-muted mb-4">Set up a system account for this employee. They will use these credentials to login to the platform.</p>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Username</label>
                                        <input
                                            type="text"
                                            className="form-control rounded-3"
                                            required
                                            value={userForm.username}
                                            onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                                            placeholder="e.g. john.doe"
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Initial Password</label>
                                        <input
                                            type="password"
                                            className="form-control rounded-3"
                                            required
                                            value={userForm.password}
                                            onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                                            placeholder="••••••••"
                                        />
                                        <div className="form-text extra-small mt-2">Employee can change this later from their dashboard.</div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Permission Role</label>
                                        <select
                                            className="form-select rounded-3"
                                            required
                                            value={userForm.role}
                                            onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                                        >
                                            <option value="Viewer">Viewer</option>
                                            <option value="Admin">Admin</option>
                                            <option value="HR">HR Manager</option>
                                            <option value="Accountant">Accountant</option>
                                        </select>
                                        <div className="form-text extra-small mt-2">Roles define module-level access permissions.</div>
                                    </div>
                                </div>
                                <div className="modal-footer border-0 p-4 pt-0">
                                    <button type="submit" className="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow-sm">Enable System Access</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </Layout>
    );
};

export default EmployeeForm;
