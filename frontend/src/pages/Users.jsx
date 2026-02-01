import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const Users = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [accountPermissions, setAccountPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('users');
    const [processing, setProcessing] = useState(false);

    // Form state for new user
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        role: 'Viewer'
    });
    const [errorMsg, setErrorMsg] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    const modules = ['Dashboard', 'Ledger', 'Statements', 'Accounting', 'Reports', 'Settings', 'Users', 'Billing', 'Payroll'];
    const roles = ['Accountant', 'Viewer']; // Admin has all by default

    const fetchData = async () => {
        try {
            const [uRes, pRes, aRes, apRes] = await Promise.all([
                api.get('/admin/users'),
                api.get('/admin/permissions'),
                api.get('/accounts'),
                api.get('/admin/account-permissions')
            ]);
            setUsers(uRes.data);
            setPermissions(pRes.data);
            setAccounts(aRes.data);
            setAccountPermissions(apRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setProcessing(true);
        setErrorMsg(null);
        setSuccessMsg(null);
        try {
            await api.post('/admin/users', newUser);
            setNewUser({ username: '', password: '', role: 'Viewer' });
            await fetchData();
            setSuccessMsg('User account created successfully.');
        } catch (err) {
            // Extract specific validation message or general error
            const detail = err.response?.data?.detail;
            const validationErrors = err.response?.data?.errors;

            if (validationErrors && Array.isArray(validationErrors)) {
                setErrorMsg(validationErrors.map(e => e.msg).join(', '));
            } else if (detail) {
                setErrorMsg(detail);
            } else {
                setErrorMsg('An unexpected error occurred. Please try again.');
            }
        } finally {
            setProcessing(false);
        }
    };

    const toggleStatus = async (id) => {
        setProcessing(true);
        setErrorMsg(null);
        try {
            await api.post(`/admin/users/${id}/status`);
            await fetchData();
        } catch (err) {
            setErrorMsg(err.response?.data?.detail || 'Failed to update status');
        } finally {
            setProcessing(false);
        }
    };

    const togglePermission = async (role, module, currentVal) => {
        const newVal = !currentVal;
        setPermissions(prev => {
            const index = prev.findIndex(p => p.role === role && p.module === module);
            if (index !== -1) {
                const updated = [...prev];
                updated[index] = { ...updated[index], can_access: newVal };
                return updated;
            } else {
                return [...prev, { role, module, can_access: newVal }];
            }
        });

        try {
            await api.post('/admin/permissions', {
                permissions: [{ role, module, can_access: newVal }]
            });
        } catch (err) {
            alert('Failed to update permission');
            fetchData();
        }
    };

    const toggleAccountPermission = async (role, accountId, currentVal) => {
        const newVal = !currentVal;
        setAccountPermissions(prev => {
            const index = prev.findIndex(p => p.role === role && p.account_id === accountId);
            if (index !== -1) {
                const updated = [...prev];
                updated[index] = { ...updated[index], can_access: newVal };
                return updated;
            } else {
                return [...prev, { role, account_id: accountId, can_access: newVal }];
            }
        });

        try {
            await api.post('/admin/account-permissions', {
                permissions: [{ role, account_id: accountId, can_access: newVal }]
            });
        } catch (err) {
            alert('Failed to update account permission');
            fetchData();
        }
    };

    const getPermission = (role, module) => {
        const p = permissions.find(p => p.role === role && p.module === module);
        return p ? (p.can_access === true || p.can_access === 1) : false;
    };

    const getAccountPermission = (role, accountId) => {
        const p = accountPermissions.find(p => p.role === role && p.account_id === accountId);
        // Default to TRUE if not set, to maintain existing behavior for newly created roles/accounts
        // But for strict lockdown, default to FALSE. Let's default to FALSE for the new system.
        return p ? (p.can_access === true || p.can_access === 1) : false;
    };

    if (loading) return (
        <Layout title="User Management">
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status"></div>
            </div>
        </Layout>
    );

    return (
        <Layout title="System Administration">
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white p-0 border-0">
                    <ul className="nav nav-tabs nav-fill">
                        <li className="nav-item">
                            <button
                                className={`nav-link border-0 py-3 fw-bold ${activeTab === 'users' ? 'active text-primary border-bottom' : 'text-muted'}`}
                                onClick={() => setActiveTab('users')}
                            >
                                <i className="fa-solid fa-users me-2"></i> User Management
                            </button>
                        </li>
                        {user?.role === 'Admin' && (
                            <>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link border-0 py-3 fw-bold ${activeTab === 'permissions' ? 'active text-primary border-bottom' : 'text-muted'}`}
                                        onClick={() => setActiveTab('permissions')}
                                    >
                                        <i className="fa-solid fa-shield-halved me-2"></i> Module Permissions
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link border-0 py-3 fw-bold ${activeTab === 'account-access' ? 'active text-primary border-bottom' : 'text-muted'}`}
                                        onClick={() => setActiveTab('account-access')}
                                    >
                                        <i className="fa-solid fa-building-columns me-2"></i> Account Access
                                    </button>
                                </li>
                            </>
                        )}
                    </ul>
                </div>

                <div className="card-body p-4 position-relative">
                    {processing && (
                        <div className="position-absolute top-0 start-0 w-100 h-100 bg-white bg-opacity-50 d-flex justify-content-center align-items-center" style={{ zIndex: 10, borderRadius: 'inherit' }}>
                            <div className="spinner-border text-primary" role="status"></div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="row g-4">
                            <div className="col-lg-4">
                                <div className="p-4 bg-light rounded-4">
                                    <h5 className="fw-bold mb-4">Create New User</h5>

                                    {errorMsg && (
                                        <div className="alert alert-danger py-2 px-3 border-0 rounded-3 mb-4 d-flex align-items-center gap-2">
                                            <i className="fa-solid fa-triangle-exclamation"></i>
                                            <small className="fw-bold">{errorMsg}</small>
                                        </div>
                                    )}

                                    {successMsg && (
                                        <div className="alert alert-success py-2 px-3 border-0 rounded-3 mb-4 d-flex align-items-center gap-2">
                                            <i className="fa-solid fa-circle-check"></i>
                                            <small className="fw-bold">{successMsg}</small>
                                        </div>
                                    )}

                                    <form onSubmit={handleCreateUser}>
                                        <div className="mb-3">
                                            <label className="form-label small fw-bold">Username</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                required
                                                value={newUser.username}
                                                onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                            />
                                        </div>
                                        <div className="mb-3">
                                            <label className="form-label small fw-bold">Password</label>
                                            <input
                                                type="password"
                                                className="form-control"
                                                required
                                                value={newUser.password}
                                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                            />
                                        </div>
                                        <div className="mb-4">
                                            <label className="form-label small fw-bold">Primary Role</label>
                                            <select
                                                className="form-select"
                                                value={newUser.role}
                                                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                            >
                                                <option value="Viewer">Viewer (Read Only)</option>
                                                <option value="Accountant">Accountant (Data Entry)</option>
                                                <option value="Admin">System Admin (Full Access)</option>
                                            </select>
                                        </div>
                                        <button className="btn btn-primary w-100 py-2 fw-bold" disabled={processing}>
                                            {processing ? 'Processing...' : 'Add User Account'}
                                        </button>
                                    </form>
                                </div>
                            </div>
                            <div className="col-lg-8">
                                <div className="table-responsive">
                                    <table className="table align-middle">
                                        <thead>
                                            <tr>
                                                <th>User</th>
                                                <th>Access Role</th>
                                                <th>Status</th>
                                                <th className="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map(u => (
                                                <tr key={u.id}>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: 32, height: 32 }}>
                                                                {u.username[0].toUpperCase()}
                                                            </div>
                                                            <div className="fw-bold">{u.username}</div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${u.role === 'Admin' ? 'bg-dark' : u.role === 'Accountant' ? 'bg-primary' : 'bg-secondary'}`}>
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${u.is_active ? 'bg-success' : 'bg-danger'}`}>
                                                            {u.is_active ? 'Active' : 'Deactivated'}
                                                        </span>
                                                    </td>
                                                    <td className="text-end">
                                                        {u.role !== 'Admin' && (
                                                            <button
                                                                className={`btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                                                                onClick={() => toggleStatus(u.id)}
                                                                disabled={processing}
                                                            >
                                                                {u.is_active ? 'Deactivate' : 'Activate'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'permissions' && (
                        <div>
                            <div className="alert alert-info py-2 d-flex align-items-center gap-2 mb-4">
                                <i className="fa-solid fa-circle-info"></i>
                                <small>Administrators have full access to all modules regardless of these settings.</small>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-bordered align-middle text-center">
                                    <thead className="bg-light">
                                        <tr>
                                            <th className="text-start ps-4">Module Name</th>
                                            {roles.map(r => <th key={r}>{r}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {modules.map(mod => (
                                            <tr key={mod}>
                                                <td className="text-start ps-4 fw-bold">{mod}</td>
                                                {roles.map(role => (
                                                    <td key={`${role}-${mod}`}>
                                                        <div className="form-check form-switch d-flex justify-content-center p-0">
                                                            <input
                                                                className="form-check-input"
                                                                type="checkbox"
                                                                checked={getPermission(role, mod)}
                                                                onChange={() => togglePermission(role, mod, getPermission(role, mod))}
                                                                style={{ width: '2.5em', height: '1.25em', cursor: 'pointer' }}
                                                            />
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'account-access' && (
                        <div>
                            <div className="alert alert-warning py-2 d-flex align-items-center gap-2 mb-4">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                                <small>Toggle which account can be viewed/edited by each role. Admins always see everything.</small>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-bordered align-middle text-center">
                                    <thead className="bg-light">
                                        <tr>
                                            <th className="text-start ps-4">Account Name (Code)</th>
                                            {roles.map(r => <th key={r}>{r}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {accounts.map(acc => (
                                            <tr key={acc.id}>
                                                <td className="text-start ps-4 fw-bold">
                                                    {acc.name} <span className="text-muted small fw-normal ms-2">({acc.code})</span>
                                                </td>
                                                {roles.map(role => (
                                                    <td key={`${role}-${acc.id}`}>
                                                        <div className="form-check form-switch d-flex justify-content-center p-0">
                                                            <input
                                                                className="form-check-input"
                                                                type="checkbox"
                                                                checked={getAccountPermission(role, acc.id)}
                                                                onChange={() => toggleAccountPermission(role, acc.id, getAccountPermission(role, acc.id))}
                                                                style={{ width: '2.5em', height: '1.25em', cursor: 'pointer' }}
                                                            />
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default Users;
