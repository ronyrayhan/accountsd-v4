import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/axios';

const HRDashboard = () => {
    const [stats, setStats] = useState({
        total_employees: 0,
        on_probation: 0,
        present_today: 0,
        absent_today: 0,
        pending_leaves: 0
    });
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const res = await api.get('/hr/dashboard/stats');
            setStats(res.data);
        } catch (err) {
            console.error('Error fetching HR stats:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    if (loading) return (
        <Layout title="HR Command Center">
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status"></div>
            </div>
        </Layout>
    );

    return (
        <Layout
            title="HR Command Center"
            actions={
                <div className="d-flex gap-2">
                    <Link to="/hr/employees/new" className="btn btn-primary rounded-pill px-4">
                        <i className="fa-solid fa-user-plus me-2"></i> Add Employee
                    </Link>
                </div>
            }
        >
            {/* Quick Stats Grid */}
            <div className="row g-4 mb-4">
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm p-4 h-100 bg-gradient-primary text-white overflow-hidden position-relative">
                        <div className="position-relative z-1">
                            <h6 className="text-white text-opacity-75 fw-bold text-uppercase small mb-2">Total Workforce</h6>
                            <h2 className="fw-bold mb-0 display-5">{stats.total_employees}</h2>
                            <div className="mt-3 small text-white text-opacity-75">
                                <i className="fa-solid fa-users me-1"></i> Active Headcount
                            </div>
                        </div>
                        <i className="fa-solid fa-users position-absolute end-0 bottom-0 opacity-10 m-n3" style={{ fontSize: '8rem' }}></i>
                    </div>
                </div>

                <div className="col-md-3">
                    <div className="card border-0 shadow-sm p-4 h-100">
                        <div className="d-flex justify-content-between mb-3">
                            <div className="stats-icon-box bg-success bg-opacity-10 text-success">
                                <i className="fa-solid fa-user-check"></i>
                            </div>
                            <span className="badge bg-success-subtle text-success rounded-pill align-self-start">Present Now</span>
                        </div>
                        <h6 className="text-muted fw-bold text-uppercase x-small mb-1">Today's Attendance</h6>
                        <h2 className="fw-bold text-dark mb-0">{stats.present_today}</h2>
                        <div className="progress mt-3" style={{ height: '6px' }}>
                            <div
                                className="progress-bar bg-success"
                                role="progressbar"
                                style={{ width: `${(stats.present_today / (stats.total_employees || 1)) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                <div className="col-md-3">
                    <div className="card border-0 shadow-sm p-4 h-100">
                        <div className="d-flex justify-content-between mb-3">
                            <div className="stats-icon-box bg-warning bg-opacity-10 text-warning">
                                <i className="fa-solid fa-umbrella-beach"></i>
                            </div>
                            <span className="badge bg-warning-subtle text-warning rounded-pill align-self-start">Action Required</span>
                        </div>
                        <h6 className="text-muted fw-bold text-uppercase x-small mb-1">Pending Leaves</h6>
                        <h2 className="fw-bold text-dark mb-0">{stats.pending_leaves}</h2>
                        <div className="mt-2">
                            <Link to="/hr/leaves" className="text-decoration-none small fw-bold text-primary">
                                Review Requests <i className="fa-solid fa-arrow-right ms-1 x-small"></i>
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="col-md-3">
                    <div className="card border-0 shadow-sm p-4 h-100">
                        <div className="d-flex justify-content-between mb-3">
                            <div className="stats-icon-box bg-info bg-opacity-10 text-info">
                                <i className="fa-solid fa-graduation-cap"></i>
                            </div>
                            <span className="badge bg-info-subtle text-info rounded-pill align-self-start">Pipeline</span>
                        </div>
                        <h6 className="text-muted fw-bold text-uppercase x-small mb-1">On Probation</h6>
                        <h2 className="fw-bold text-dark mb-0">{stats.on_probation}</h2>
                        <div className="mt-3 small text-muted">
                            <i className="fa-solid fa-clock me-1"></i> Review due soon
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-4">
                {/* Shortcuts & Quick Navigation */}
                <div className="col-lg-8">
                    <div className="row g-3">
                        <div className="col-md-6">
                            <Link to="/hr/employees" className="card border-0 shadow-sm p-4 text-decoration-none hover-lift h-100">
                                <div className="d-flex align-items-center mb-0">
                                    <div className="bg-primary bg-opacity-10 text-primary rounded-4 p-3 me-3">
                                        <i className="fa-solid fa-user-group fs-4"></i>
                                    </div>
                                    <div>
                                        <h5 className="fw-bold mb-1 text-dark">Employee Directory</h5>
                                        <p className="text-muted small mb-0">Manage profiles, history & compensation</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                        <div className="col-md-6">
                            <Link to="/hr/attendance" className="card border-0 shadow-sm p-4 text-decoration-none hover-lift h-100">
                                <div className="d-flex align-items-center mb-0">
                                    <div className="bg-success bg-opacity-10 text-success rounded-4 p-3 me-3">
                                        <i className="fa-solid fa-id-card fs-4"></i>
                                    </div>
                                    <div>
                                        <h5 className="fw-bold mb-1 text-dark">Attendance Hub</h5>
                                        <p className="text-muted small mb-0">Track RFID logs, shifts & reports</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                        <div className="col-md-6">
                            <Link to="/hr/leaves" className="card border-0 shadow-sm p-4 text-decoration-none hover-lift h-100">
                                <div className="d-flex align-items-center mb-0">
                                    <div className="bg-warning bg-opacity-10 text-warning rounded-4 p-3 me-3">
                                        <i className="fa-solid fa-calendar-alt fs-4"></i>
                                    </div>
                                    <div>
                                        <h5 className="fw-bold mb-1 text-dark">Leave Center</h5>
                                        <p className="text-muted small mb-0">Handle requests & balances</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                        <div className="col-md-6">
                            <Link to="/hr/shifts" className="card border-0 shadow-sm p-4 text-decoration-none hover-lift h-100">
                                <div className="d-flex align-items-center mb-0">
                                    <div className="rounded-4 p-3 me-3" style={{ backgroundColor: '#D8E2DC', color: '#1B4332' }}>
                                        <i className="fa-solid fa-clock-rotate-left fs-4"></i>
                                    </div>
                                    <div>
                                        <h5 className="fw-bold mb-1 text-dark">Shift Setup</h5>
                                        <p className="text-muted small mb-0">Manage working hours & shifts</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                        <div className="col-md-6">
                            <Link to="/payroll" className="card border-0 shadow-sm p-4 text-decoration-none hover-lift h-100">
                                <div className="d-flex align-items-center mb-0">
                                    <div className="rounded-4 p-3 me-3" style={{ backgroundColor: '#D8E2DC', color: '#1B4332' }}>
                                        <i className="fa-solid fa-file-invoice-dollar fs-4"></i>
                                    </div>
                                    <div>
                                        <h5 className="fw-bold mb-1 text-dark">Payroll Access</h5>
                                        <p className="text-muted small mb-0">Run payroll & salary processing</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                        <div className="col-md-12">
                            <Link to="/hr/simulator" className="card border-0 shadow-sm p-3 text-decoration-none hover-lift h-100 bg-light">
                                <div className="d-flex align-items-center justify-content-center mb-0 text-muted">
                                    <i className="fa-solid fa-microchip me-2"></i>
                                    <span className="fw-bold small text-uppercase ls-1">Hardware Simulator</span>
                                </div>
                            </Link>
                        </div>
                    </div>

                    {/* Live Punch Feed Placeholder */}
                    <div className="card border-0 shadow-sm rounded-4 mt-4">
                        <div className="card-header bg-white border-0 p-4 pb-0">
                            <h5 className="fw-bold mb-0">Recent Punch Activity</h5>
                        </div>
                        <div className="card-body p-4 pt-2">
                            <div className="text-center py-5 text-muted">
                                <i className="fa-solid fa-clock-rotate-left fs-1 opacity-25 mb-3 d-block"></i>
                                <div>Live activity stream will appear here as employees tap their cards.</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Side Pane */}
                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                        <div className="card-header bg-white border-0 p-4 pb-0">
                            <h5 className="fw-bold mb-0">HR Insights</h5>
                        </div>
                        <div className="card-body p-4">
                            <div className="mb-4">
                                <h6 className="text-muted fw-bold text-uppercase x-small mb-3">Upcoming Anniversaries</h6>
                                {stats.anniversaries && stats.anniversaries.length > 0 ? (
                                    stats.anniversaries.map(ann => (
                                        <div key={ann._id} className="d-flex align-items-center mb-3">
                                            <div className="bg-light rounded-circle p-2 me-3 fw-bold small text-primary" style={{ width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {ann.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="fw-bold small">{ann.name}</div>
                                                <div className="x-small text-muted">
                                                    {ann.years} Year{ann.years !== 1 ? 's' : ''} • {new Date(ann.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-3 text-muted x-small opacity-75">
                                        <i className="fa-solid fa-calendar-xmark mb-2"></i>
                                        <div>No upcoming anniversaries</div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-3 border-top">
                                <h6 className="text-muted fw-bold text-uppercase x-small mb-3">Department Headcount</h6>
                                {stats.departments && stats.departments.length > 0 ? (
                                    stats.departments.map((dept, idx) => (
                                        <div key={idx} className="mb-2">
                                            <div className="d-flex justify-content-between small mb-1">
                                                <span>{dept.name}</span>
                                                <span className="fw-bold">{dept.count}</span>
                                            </div>
                                            <div className="progress" style={{ height: '4px' }}>
                                                <div
                                                    className={`progress-bar ${idx % 2 === 0 ? 'bg-primary' : 'bg-info'}`}
                                                    style={{ width: `${dept.percentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-3 text-muted x-small opacity-75">
                                        No department data available
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout >
    );
};

export default HRDashboard;
