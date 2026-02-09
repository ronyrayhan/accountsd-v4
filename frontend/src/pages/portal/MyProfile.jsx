import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const MyProfile = () => {
    const { user } = useAuth();
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/portal/profile');
                setEmployee(res.data);
            } catch (err) {
                console.error('Error fetching profile:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>;

    // Fallback: use user object which has populated employee info from login
    const emp = employee || user?.employee_id;

    if (!emp) return (
        <Layout title="My Profile">
            <div className="text-center py-5 text-muted">Profile not found.</div>
        </Layout>
    );

    return (
        <Layout title="My Profile Information">
            <div className="row g-4">
                {/* Header Card */}
                <div className="col-12">
                    <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden p-4 p-md-5">
                        <div className="row align-items-center">
                            <div className="col-auto">
                                <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold display-4 shadow-sm" style={{ width: 100, height: 100 }}>
                                    {emp.personal_info?.full_name?.charAt(0) || user.username.charAt(0)}
                                </div>
                            </div>
                            <div className="col">
                                <h2 className="fw-bold mb-1">{emp.personal_info?.full_name || 'Valued Employee'}</h2>
                                <div className="text-muted mb-3">
                                    {emp.employment_info?.current_designation} <span className="mx-2">|</span> {emp.employment_info?.current_department}
                                </div>
                                <div className="d-flex gap-3">
                                    <span className="badge bg-success-subtle text-success rounded-pill px-3 py-1 font-monospace">{emp.employee_id}</span>
                                    <span className="badge bg-light text-muted border rounded-pill px-3 py-1">Joined {new Date(emp.employment_info?.joining_date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Personal Info */}
                <div className="col-lg-7">
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                        <h5 className="fw-bold mb-4">Personal Details</h5>
                        <div className="row g-4">
                            <div className="col-md-6">
                                <div className="mb-3">
                                    <label className="text-muted x-small fw-bold text-uppercase mb-1">Email Address</label>
                                    <div className="fw-bold">{emp.personal_info?.email || 'N/A'}</div>
                                </div>
                                <div className="mb-3">
                                    <label className="text-muted x-small fw-bold text-uppercase mb-1">Phone Number</label>
                                    <div className="fw-bold">{emp.personal_info?.phone || 'N/A'}</div>
                                </div>
                                <div className="mb-3">
                                    <label className="text-muted x-small fw-bold text-uppercase mb-1">Date of Birth</label>
                                    <div className="fw-bold">{emp.personal_info?.date_of_birth ? new Date(emp.personal_info.date_of_birth).toLocaleDateString() : 'N/A'}</div>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="mb-3">
                                    <label className="text-muted x-small fw-bold text-uppercase mb-1">Gender / Blood</label>
                                    <div className="fw-bold">{emp.personal_info?.gender || 'N/A'} / {emp.personal_info?.blood_group || 'N/A'}</div>
                                </div>
                                <div className="mb-3">
                                    <label className="text-muted x-small fw-bold text-uppercase mb-1">Emergency Contact</label>
                                    <div className="fw-bold">{emp.personal_info?.emergency_contact || 'N/A'}</div>
                                </div>
                            </div>
                            <div className="col-12">
                                <div className="mt-2 pt-3 border-top">
                                    <label className="text-muted x-small fw-bold text-uppercase mb-1">Permanent Address</label>
                                    <div className="small">{emp.personal_info?.permanent_address || 'N/A'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Employment & Stats */}
                <div className="col-lg-5">
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
                        <h5 className="fw-bold mb-4">Account Information</h5>
                        <div className="d-flex align-items-center mb-3">
                            <div className="bg-light rounded-circle p-2 me-3">
                                <i className="fa-solid fa-user text-primary"></i>
                            </div>
                            <div>
                                <div className="x-small text-muted">Portal Username</div>
                                <div className="fw-bold">{user.username}</div>
                            </div>
                        </div>
                        <div className="d-flex align-items-center mb-3">
                            <div className="bg-light rounded-circle p-2 me-3">
                                <i className="fa-solid fa-shield-halved text-success"></i>
                            </div>
                            <div>
                                <div className="x-small text-muted">Access Role</div>
                                <div className="fw-bold">{user.role}</div>
                            </div>
                        </div>
                        <div className="d-flex align-items-center">
                            <div className="bg-light rounded-circle p-2 me-3">
                                <i className="fa-solid fa-id-card text-info"></i>
                            </div>
                            <div>
                                <div className="x-small text-muted">RFID Card</div>
                                <div className="fw-bold">{emp.rfid_card_number || 'No Card Linked'}</div>
                            </div>
                        </div>
                    </div>

                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-primary text-white">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 className="opacity-75 mb-1 font-monospace">EMPLOYEE STATUS</h6>
                                <h4 className="fw-bold mb-0">{emp.employment_info?.status?.toUpperCase()}</h4>
                            </div>
                            <i className="fa-solid fa-check-double display-6 opacity-25"></i>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default MyProfile;
