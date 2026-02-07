import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const MyProfile = () => {
    const { user, setUser, token } = useAuth();
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [imgError, setImgError] = useState(false);

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

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('profile_picture', file);

        setUploading(true);
        try {
            const res = await api.post('/auth/profile-picture', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Reset error so new image can be attempted
            setImgError(false);
            // Update local user state in context
            setUser({ ...user, profile_picture: res.data.profile_picture });
            alert('Profile picture updated successfully');
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to upload photo');
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>;

    // Fallback: use user object which has populated employee info from login
    const emp = employee || user?.employee_id;

    // Unified experience even without employee data
    return (
        <Layout title="My Profile Information">
            <div className="row g-4">
                {/* Header Card */}
                <div className="col-12">
                    <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden p-4 p-md-5">
                        <div className="row align-items-center">
                            <div className="col-auto position-relative">
                                <div className="rounded-circle overflow-hidden shadow-sm d-flex align-items-center justify-content-center bg-light" style={{ width: 120, height: 120, border: '4px solid white', boxShadow: '0 5px 15px rgba(0,0,0,0.08)' }}>
                                    {user.profile_picture && !imgError ? (
                                        <img
                                            src={`${api.defaults.baseURL}/files/${user.profile_picture}?token=${token}`}
                                            alt="Profile"
                                            className="w-100 h-100 d-block"
                                            style={{ objectFit: 'cover', minWidth: '100%', minHeight: '100%' }}
                                            onError={() => setImgError(true)}
                                        />
                                    ) : (
                                        <div className="w-100 h-100 d-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary fw-bold display-4">
                                            {emp?.personal_info?.full_name?.charAt(0) || user.username.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <label
                                    htmlFor="profile-upload"
                                    className="position-absolute bottom-0 end-0 bg-white shadow-sm rounded-circle d-flex align-items-center justify-content-center border"
                                    style={{ width: 40, height: 40, cursor: 'pointer', zIndex: 10 }}
                                >
                                    {uploading ? (
                                        <span className="spinner-border spinner-border-sm text-primary"></span>
                                    ) : (
                                        <i className="fa-solid fa-camera text-primary"></i>
                                    )}
                                </label>
                                <input
                                    type="file"
                                    id="profile-upload"
                                    className="d-none"
                                    accept="image/*"
                                    onChange={handlePhotoUpload}
                                    disabled={uploading}
                                />
                            </div>
                            <div className="col ms-md-4">
                                <h2 className="fw-bold mb-1 mt-3 mt-md-0">{emp?.personal_info?.full_name || user.username}</h2>
                                <div className="text-muted mb-3 d-flex align-items-center gap-2">
                                    {emp ? (
                                        <>
                                            <span>{emp.employment_info?.current_designation}</span>
                                            <span className="text-opacity-25 opacity-50">|</span>
                                            <span>{emp.employment_info?.current_department}</span>
                                        </>
                                    ) : (
                                        <span>System {user.role}</span>
                                    )}
                                </div>
                                <div className="d-flex gap-3">
                                    <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-1 font-monospace">{user.role}</span>
                                    {emp && <span className="badge bg-light text-muted border rounded-pill px-3 py-1 font-monospace">{emp.employee_id}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Sections */}
                {emp ? (
                    <>
                        <div className="col-lg-7">
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
                                <h5 className="fw-bold mb-4">Personal Details</h5>
                                <div className="row g-4">
                                    <div className="col-md-6">
                                        <div className="mb-3">
                                            <label className="text-muted x-small fw-bold text-uppercase mb-1">Email Address</label>
                                            <div className="fw-bold text-dark">{emp.personal_info?.email || 'N/A'}</div>
                                        </div>
                                        <div className="mb-3">
                                            <label className="text-muted x-small fw-bold text-uppercase mb-1">Phone Number</label>
                                            <div className="fw-bold text-dark">{emp.personal_info?.phone || 'N/A'}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="mb-3">
                                            <label className="text-muted x-small fw-bold text-uppercase mb-1">Employee Status</label>
                                            <div className="fw-bold text-dark">{emp.employment_info?.status || 'Active'}</div>
                                        </div>
                                        <div className="mb-3">
                                            <label className="text-muted x-small fw-bold text-uppercase mb-1">Joined On</label>
                                            <div className="fw-bold text-dark">{emp.employment_info?.joining_date ? new Date(emp.employment_info.joining_date).toLocaleDateString() : 'N/A'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-5">
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
                                <h5 className="fw-bold mb-4">Account Security</h5>
                                <div className="mb-3">
                                    <label className="text-muted x-small fw-bold text-uppercase mb-1 d-block">Username</label>
                                    <span className="fw-bold text-dark">{user.username}</span>
                                </div>
                                <div className="mb-3">
                                    <label className="text-muted x-small fw-bold text-uppercase mb-1 d-block">System Role</label>
                                    <span className="badge bg-info-subtle text-info rounded-pill">{user.role}</span>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="col-12">
                        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                            <h5 className="fw-bold mb-4">Account Information</h5>
                            <p className="text-muted mb-4 small">You are logged in as a system administrator. No linked employee profile was found, but you can still manage your account settings and profile picture here.</p>
                            <div className="row g-4">
                                <div className="col-md-4">
                                    <label className="text-muted x-small fw-bold text-uppercase mb-1 d-block">Username</label>
                                    <div className="fw-bold text-dark">{user.username}</div>
                                </div>
                                <div className="col-md-4">
                                    <label className="text-muted x-small fw-bold text-uppercase mb-1 d-block">Designation</label>
                                    <div className="fw-bold text-dark">System Administrator</div>
                                </div>
                                <div className="col-md-4">
                                    <label className="text-muted x-small fw-bold text-uppercase mb-1 d-block">Security Status</label>
                                    <div className="text-success small fw-bold"><i className="fa-solid fa-shield-check me-1"></i> Account Secured</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default MyProfile;
