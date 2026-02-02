import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/axios';

const EmployeeList = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/hr/employees?search=${search}&department=${filterDept}&status=${filterStatus}`);
            setEmployees(res.data);
        } catch (err) {
            console.error('Error fetching employees:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            fetchEmployees();
        }, 300);
        return () => clearTimeout(delayDebounce);
    }, [search, filterDept, filterStatus]);

    return (
        <Layout
            title="Employee Directory"
            actions={
                <Link to="/hr/employees/new" className="btn btn-primary rounded-pill px-4">
                    <i className="fa-solid fa-user-plus me-2"></i> Add Employee
                </Link>
            }
        >
            {/* Filters Row */}
            <div className="card border-0 shadow-sm mb-4 rounded-4">
                <div className="card-body p-3">
                    <div className="row g-2 align-items-center">
                        <div className="col-md-5">
                            <div className="input-group input-group-sm bg-light rounded-pill border-0 px-3 py-1">
                                <span className="input-group-text bg-transparent border-0 text-muted">
                                    <i className="fa-solid fa-magnifying-glass"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control bg-transparent border-0 shadow-none ps-0"
                                    placeholder="Search by name, ID or RFID card..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <select
                                className="form-select form-select-sm border-0 bg-light rounded-pill px-3"
                                value={filterDept}
                                onChange={e => setFilterDept(e.target.value)}
                            >
                                <option value="">All Departments</option>
                                <option value="Engineering">Engineering</option>
                                <option value="Marketing">Marketing</option>
                                <option value="HR">HR</option>
                                <option value="Sales">Sales</option>
                                <option value="Finance">Finance</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <select
                                className="form-select form-select-sm border-0 bg-light rounded-pill px-3"
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                            >
                                <option value="">All Status</option>
                                <option value="Active">Active</option>
                                <option value="Probation">Probation</option>
                                <option value="On Leave">On Leave</option>
                                <option value="Resigned">Resigned</option>
                            </select>
                        </div>
                        <div className="col-md-2 d-flex justify-content-end">
                            <button className="btn btn-light btn-sm rounded-circle p-2" onClick={fetchEmployees} title="Refresh">
                                <i className="fa-solid fa-rotate"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Employee Table */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="bg-light">
                            <tr>
                                <th className="ps-4 py-3 text-muted x-small ls-1 fw-bold">EMPLOYEE</th>
                                <th className="text-muted x-small ls-1 fw-bold">DESIGNATION</th>
                                <th className="text-muted x-small ls-1 fw-bold">DEPARTMENT</th>
                                <th className="text-muted x-small ls-1 fw-bold">JOINING DATE</th>
                                <th className="text-muted x-small ls-1 fw-bold">TENURE</th>
                                <th className="text-muted x-small ls-1 fw-bold">STATUS</th>
                                <th className="text-end pe-4 text-muted x-small ls-1 fw-bold">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className="border-top-0">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-5">
                                        <div className="spinner-border spinner-border-sm text-primary me-2"></div> Loading directory...
                                    </td>
                                </tr>
                            ) : employees.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-5 text-muted">No employees found matching filters.</td>
                                </tr>
                            ) : (
                                employees.map(emp => (
                                    <tr key={emp._id}>
                                        <td className="ps-4 py-3">
                                            <div className="d-flex align-items-center">
                                                <div className="bg-primary bg-opacity-10 text-primary rounded-circle p-2 me-3 fw-bold small flex-shrink-0" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {emp.personal_info.full_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="fw-bold mb-0 text-bright">{emp.personal_info.full_name}</div>
                                                    <div className="x-small text-muted d-flex align-items-center">
                                                        <span>{emp.employee_id}</span>
                                                        {emp.rfid_card_number ? (
                                                            <span className="ms-2 badge bg-primary-subtle text-primary border border-primary-subtle font-monospace" style={{ fontSize: '0.65rem' }}>
                                                                <i className="fa-solid fa-id-card me-1"></i> {emp.rfid_card_number}
                                                            </span>
                                                        ) : (
                                                            <span className="ms-2 opacity-50">• No RFID</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><div className="small fw-medium">{emp.employment_info?.current_designation}</div></td>
                                        <td><div className="small bg-light-subtle d-inline-block px-2 py-1 rounded-pill">{emp.employment_info?.current_department}</div></td>
                                        <td><div className="small text-muted">{new Date(emp.employment_info?.joining_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</div></td>
                                        <td><div className="small fw-bold">{emp.tenure_years} <span className="fw-normal text-muted">Yrs</span></div></td>
                                        <td>
                                            <span className={`badge rounded-pill px-3 py-1 ${emp.employment_info?.status === 'Active' ? 'bg-success-subtle text-success border-success-subtle' :
                                                emp.employment_info?.status === 'Probation' ? 'bg-info-subtle text-info border-info-subtle' :
                                                    emp.employment_info?.status === 'On Leave' ? 'bg-warning-subtle text-warning border-warning-subtle' :
                                                        'bg-danger-subtle text-danger border-danger-subtle'
                                                } border`}>
                                                {emp.employment_info?.status}
                                            </span>
                                        </td>
                                        <td className="text-end pe-4">
                                            <div className="dropdown">
                                                <button className="btn btn-sm btn-light rounded-circle shadow-none" data-bs-toggle="dropdown">
                                                    <i className="fa-solid fa-ellipsis-vertical text-muted"></i>
                                                </button>
                                                <ul className="dropdown-menu dropdown-menu-end border-0 shadow rounded-3">
                                                    <li><Link className="dropdown-item py-2 small" to={`/hr/employees/${emp._id}`}><i className="fa-solid fa-eye me-2 opacity-50"></i> View Profile</Link></li>
                                                    <li><Link className="dropdown-item py-2 small" to={`/hr/employees/${emp._id}/edit`}><i className="fa-solid fa-pen-to-square me-2 opacity-50"></i> Edit Details</Link></li>
                                                    <li><hr className="dropdown-divider mx-2" /></li>
                                                    <li><button className="dropdown-item py-2 small text-danger"><i className="fa-solid fa-user-xmark me-2 opacity-50"></i> Terminate</button></li>
                                                </ul>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default EmployeeList;
