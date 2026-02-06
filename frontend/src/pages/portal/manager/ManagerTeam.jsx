import React, { useState, useEffect } from 'react';
import Layout from '../../../components/Layout';
import api from '../../../api/axios';

const ManagerTeam = () => {
    const [subordinates, setSubordinates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSub, setSelectedSub] = useState(null);
    const [balances, setBalances] = useState([]);
    const [fetchingBalances, setFetchingBalances] = useState(false);

    const fetchData = async () => {
        try {
            const res = await api.get('/portal/manager/subordinates');
            setSubordinates(res.data);
        } catch (err) {
            console.error('Error fetching team:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchBalances = async (subId) => {
        setFetchingBalances(true);
        try {
            const res = await api.get(`/portal/manager/subordinate-balance/${subId}`);
            setBalances(res.data);
        } catch (err) {
            console.error('Error fetching balance:', err);
        } finally {
            setFetchingBalances(false);
        }
    };

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <Layout title="Approver Center | My Team">
            <div className="row g-4">
                <div className="col-lg-5">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                        <div className="card-header bg-white border-0 p-4">
                            <h5 className="fw-bold mb-0">Direct Reports <span className="badge bg-secondary-subtle text-secondary rounded-pill ms-2">{subordinates.length}</span></h5>
                        </div>
                        <div className="card-body p-0">
                            <div className="list-group list-group-flush">
                                {subordinates.map(sub => (
                                    <button
                                        key={sub._id}
                                        className={`list-group-item list-group-item-action border-0 p-4 d-flex align-items-center gap-3 transition-all ${selectedSub?._id === sub._id ? 'bg-primary-subtle' : ''}`}
                                        onClick={() => {
                                            setSelectedSub(sub);
                                            fetchBalances(sub._id);
                                        }}
                                    >
                                        <div className="avatar-circle-sm bg-primary text-white d-flex align-items-center justify-content-center fw-bold rounded-circle" style={{ width: 40, height: 40 }}>
                                            {sub.personal_info?.full_name?.charAt(0)}
                                        </div>
                                        <div className="flex-grow-1 text-start">
                                            <div className="fw-bold">{sub.personal_info?.full_name}</div>
                                            <div className="x-small text-muted">{sub.employment_info?.current_designation}</div>
                                        </div>
                                        <i className="fa-solid fa-chevron-right x-small text-muted"></i>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-7">
                    {selectedSub ? (
                        <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
                            <div className="bg-primary p-5 text-white">
                                <h4 className="fw-bold mb-1">{selectedSub.personal_info?.full_name}</h4>
                                <p className="opacity-75 mb-0"><i className="fa-solid fa-building me-2 small"></i>{selectedSub.employment_info?.current_department}</p>
                                <div className="mt-4 d-flex gap-3">
                                    <div className="badge bg-white bg-opacity-25 rounded-pill px-3 py-2 border-0 fw-normal">
                                        ID: {selectedSub.employee_id}
                                    </div>
                                    <div className="badge bg-white bg-opacity-25 rounded-pill px-3 py-2 border-0 fw-normal">
                                        {selectedSub.employment_info?.employment_type}
                                    </div>
                                </div>
                            </div>
                            <div className="card-body p-4 p-lg-5">
                                <h6 className="fw-bold text-muted text-uppercase x-small mb-4">Leave Balances</h6>
                                {fetchingBalances ? (
                                    <div className="text-center py-5"><div className="spinner-border spinner-border-sm text-primary"></div></div>
                                ) : (
                                    <div className="row g-3">
                                        {/* Adapt to the actual balance schema returned by /hr/employees/:id/leave-balance */}
                                        {/* If it uses dynamic balances array like LeaveBalance model */}
                                        {balances.balances ? (
                                            balances.balances.map(b => (
                                                <div className="col-md-6" key={b._id}>
                                                    <div className="p-4 rounded-4 bg-light border-0">
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <span className="fw-bold small">{b.leave_type?.name || 'Leave'}</span>
                                                            <span className="badge bg-white text-dark border-0 rounded-pill shadow-xs x-small px-3">
                                                                {b.total - b.used - b.pending} Avail
                                                            </span>
                                                        </div>
                                                        <div className="progress rounded-pill bg-white" style={{ height: 6 }}>
                                                            <div className="progress-bar" style={{ width: `${(b.used / b.total) * 100}%` }}></div>
                                                        </div>
                                                        <div className="mt-2 x-small text-muted">
                                                            Used: {b.used} <span className="mx-1">|</span> Pending: {b.pending} <span className="mx-1">|</span> Total: {b.total}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-12 text-center text-muted py-4">No specific balance data found.</div>
                                        )}
                                    </div>
                                )}

                                <hr className="my-5 opacity-10" />

                                <h6 className="fw-bold text-muted text-uppercase x-small mb-4">Contact Information</h6>
                                <div className="row g-4">
                                    <div className="col-sm-6">
                                        <div className="x-small text-muted mb-1">Email</div>
                                        <div className="fw-bold small">{selectedSub.personal_info?.email || 'N/A'}</div>
                                    </div>
                                    <div className="col-sm-6">
                                        <div className="x-small text-muted mb-1">Phone</div>
                                        <div className="fw-bold small">{selectedSub.personal_info?.phone || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card border-0 shadow-sm rounded-4 h-100 bg-light d-flex align-items-center justify-content-center py-5 p-lg-5 text-center">
                            <div className="py-5">
                                <i className="fa-solid fa-user-check fs-1 text-muted opacity-25 mb-4"></i>
                                <h5 className="fw-bold text-muted">Select a teammate</h5>
                                <p className="small text-muted px-4">Click on an employee to view their detailed profile and leave balances.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default ManagerTeam;
