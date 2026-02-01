import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Settings Data
    const [settings, setSettings] = useState({
        usd_bdt_rate: '110',
        company_name: 'Acme Corp',
        site_brand: 'AccountsD'
    });

    // Users & Permissions Data
    const [users, setUsers] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [accountPermissions, setAccountPermissions] = useState([]);
    const [individualPermissions, setIndividualPermissions] = useState({ modulePermissions: [], accountPermissions: [] });
    const [selectedUserId, setSelectedUserId] = useState('');
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Viewer' });

    const modules = ['Dashboard', 'Ledger', 'Statements', 'Accounting', 'Reports', 'Settings', 'Users', 'Billing', 'Payroll', 'HR', 'Assets', 'Summaries'];
    const roles = ['Accountant', 'Viewer'];

    const fetchData = async () => {
        setLoading(true);
        try {
            const [sRes, uRes, pRes, aRes, apRes, indRes] = await Promise.all([
                api.get('/settings'),
                api.get('/admin/users'),
                api.get('/admin/permissions'),
                api.get('/accounts'),
                api.get('/admin/account-permissions'),
                api.get('/admin/individual-permissions')
            ]);
            setSettings(prev => ({ ...prev, ...sRes.data }));
            setUsers(uRes.data);
            setPermissions(pRes.data);
            setAccounts(aRes.data);
            setAccountPermissions(apRes.data);
            setIndividualPermissions(indRes.data);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchIndividual = async () => {
        try {
            const res = await api.get('/admin/individual-permissions');
            setIndividualPermissions(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveSetting = async (key, value) => {
        setSaving(true);
        try {
            await api.post('/settings', { key, value });
            setSettings(prev => ({ ...prev, [key]: value }));
        } catch (err) {
            alert('Update failed');
        } finally {
            setSaving(false);
        }
    };

    // --- User Management Logic ---
    const handleCreateUser = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/admin/users', newUser);
            setNewUser({ username: '', password: '', role: 'Viewer' });
            await fetchData();
            alert('User created successfully');
        } catch (err) {
            alert('Failed to create user');
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (id) => {
        setSaving(true);
        try {
            await api.post(`/admin/users/${id}/status`);
            await fetchData();
        } catch (err) {
            alert('Status update failed');
        } finally {
            setSaving(false);
        }
    };

    const togglePermission = async (role, module, currentVal) => {
        const newVal = !currentVal;
        try {
            await api.post('/admin/permissions', { permissions: [{ role, module, can_access: newVal }] });
            fetchData();
        } catch (err) {
            alert('Permission update failed');
        }
    };

    const getPermission = (role, module) => {
        const p = permissions.find(p => p.role === role && p.module === module);
        return p ? (p.can_access === true || p.can_access === 1) : false;
    };

    const toggleAccountPermission = async (role, accountId, currentVal) => {
        const newVal = !currentVal;
        try {
            await api.post('/admin/account-permissions', { permissions: [{ role, account_id: accountId, can_access: newVal }] });
            fetchData();
        } catch (err) {
            alert('Update failed');
        }
    };

    const getAccountPermission = (role, accountId) => {
        const p = accountPermissions.find(p => p.role === role && p.account_id === accountId);
        return p ? (p.can_access === true || p.can_access === 1) : false;
    };

    const toggleIndividualPermission = async (userId, type, target, currentVal) => {
        const newVal = !currentVal;
        try {
            await api.post('/admin/individual-permissions', { userId, type, target, canAccess: newVal });
            fetchIndividual();
        } catch (err) { alert('Individual update failed'); }
    };

    const getIndModulePerm = (userId, module) => {
        const p = individualPermissions.modulePermissions.find(p => p.user_id === userId && p.module === module);
        if (p) return p.can_access;
        // Fallback to role if not explicitly set
        const u = users.find(u => u.id === userId);
        if (!u) return false;
        return getPermission(u.role, module);
    };

    const getIndAccountPerm = (userId, accountId) => {
        const p = individualPermissions.accountPermissions.find(p => p.user_id === userId && p.account_id === accountId);
        if (p) return p.can_access;
        // Fallback to role
        const u = users.find(u => u.id === userId);
        if (!u) return false;
        return getAccountPermission(u.role, accountId);
    };

    const isOverridden = (userId, type, target) => {
        if (type === 'module') return individualPermissions.modulePermissions.some(p => p.user_id === userId && p.module === target);
        return individualPermissions.accountPermissions.some(p => p.user_id === userId && p.account_id === target);
    };


    const SidebarItem = ({ id, icon, label, subtext }) => (
        <div
            className={`p-3 mb-2 rounded-4 cursor-pointer transition-all d-flex align-items-center ${activeTab === id ? 'bg-primary text-white shadow' : 'bg-light hover-bg-dark text-muted border border-transparent'}`}
            onClick={() => setActiveTab(id)}
        >
            <div className={`rounded-circle p-2 me-3 d-flex align-items-center justify-content-center ${activeTab === id ? 'bg-white bg-opacity-20' : 'bg-white shadow-sm text-primary'}`} style={{ width: 40, height: 40 }}>
                <i className={`${icon} fs-6`}></i>
            </div>
            <div>
                <div className={`fw-bold small ${activeTab === id ? 'text-white' : 'text-dark'}`}>{label}</div>
                <div className={`x-small opacity-75 ${activeTab === id ? 'text-white' : ''}`}>{subtext}</div>
            </div>
        </div>
    );

    if (loading) return (
        <Layout title="Settings">
            <div className="d-flex justify-content-center align-items-center vh-100"><div className="spinner-border text-primary"></div></div>
        </Layout>
    );

    return (
        <Layout title="Control Panel">
            <div className="row g-4">
                {/* Setting Categories Sidebar */}
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm p-3 bg-white rounded-4">
                        <h6 className="text-muted fw-bold x-small ls-1 mb-3 text-uppercase px-2">Configuration Categories</h6>
                        <SidebarItem id="general" icon="fa-solid fa-sliders" label="General" subtext="Company & site appearance" />
                        <SidebarItem id="users" icon="fa-solid fa-users-gear" label="Team Management" subtext="Control user accounts" />
                        <SidebarItem id="permissions" icon="fa-solid fa-shield-halved" label="Module Access" subtext="Define role permissions" />
                        <SidebarItem id="accounts" icon="fa-solid fa-building-columns" label="Account Security" subtext="Bank-level accessibility" />
                        <SidebarItem id="individual" icon="fa-solid fa-user-shield" label="Individual Access" subtext="Precision user overrides" />
                        <SidebarItem id="finances" icon="fa-solid fa-comments-dollar" label="Finances" subtext="Rates & currency logic" />
                    </div>
                </div>

                {/* Categories Content Pane */}
                <div className="col-md-9">
                    <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white min-vh-75">
                        <div className="card-header bg-white border-bottom-light p-4">
                            <h5 className="fw-extrabold mb-0 text-dark text-capitalize">
                                {activeTab.replace('-', ' ')} Settings
                            </h5>
                        </div>
                        <div className="card-body p-4">

                            {/* General Tab */}
                            {activeTab === 'general' && (
                                <div className="max-w-600">
                                    <div className="mb-4">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Organization Name</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg border-light-subtle rounded-3 fs-6"
                                            value={settings.company_name}
                                            placeholder="e.g. Acme Global Ltd"
                                            onChange={e => setSettings({ ...settings, company_name: e.target.value })}
                                        />
                                        <small className="text-muted">This name appears on reports and invoices.</small>
                                    </div>
                                    <div className="mb-4">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Platform Brand Title</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg border-light-subtle rounded-3 fs-6"
                                            value={settings.site_brand}
                                            placeholder="AccountsD"
                                            onChange={e => setSettings({ ...settings, site_brand: e.target.value })}
                                        />
                                        <small className="text-muted">Changes the name in the sidebar and browser tab.</small>
                                    </div>
                                    <button
                                        className="btn btn-primary px-4 py-2 fw-bold shadow-sm"
                                        onClick={async () => {
                                            await handleSaveSetting('company_name', settings.company_name);
                                            await handleSaveSetting('site_brand', settings.site_brand);
                                            alert('General settings saved successfully');
                                        }}
                                        disabled={saving}
                                    >
                                        {saving ? 'Saving...' : 'Save General Settings'}
                                    </button>
                                </div>
                            )}

                            {/* Users Tab */}
                            {activeTab === 'users' && (
                                <div className="row g-4">
                                    <div className="col-lg-5">
                                        <div className="p-4 bg-light rounded-4">
                                            <h6 className="fw-bold mb-4">Provision New Identity</h6>
                                            <form onSubmit={handleCreateUser}>
                                                <div className="mb-3">
                                                    <label className="form-label x-small fw-bold text-muted">USERNAME</label>
                                                    <input type="text" className="form-control" required value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                                                </div>
                                                <div className="mb-3">
                                                    <label className="form-label x-small fw-bold text-muted">INITIAL PASSWORD</label>
                                                    <input type="password" className="form-control" required value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                                </div>
                                                <div className="mb-4">
                                                    <label className="form-label x-small fw-bold text-muted">ACCESS LEVEL</label>
                                                    <select className="form-select" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                                        <option value="Viewer">Viewer (Read Only)</option>
                                                        <option value="Accountant">Accountant (Entry)</option>
                                                        <option value="Admin">Administrator (Root)</option>
                                                    </select>
                                                </div>
                                                <button className="btn btn-primary w-100 fw-bold shadow-sm" disabled={saving}>Create User Account</button>
                                            </form>
                                        </div>
                                    </div>
                                    <div className="col-lg-7">
                                        <div className="table-responsive">
                                            <table className="table align-middle">
                                                <thead className="x-small text-muted fw-bold">
                                                    <tr><th>IDENTITY</th><th>ROLE</th><th>STATUS</th><th className="text-end">ACTIONS</th></tr>
                                                </thead>
                                                <tbody>
                                                    {users.map(u => (
                                                        <tr key={u.id}>
                                                            <td><div className="fw-bold">{u.username}</div></td>
                                                            <td><span className={`badge ${u.role === 'Admin' ? 'bg-dark' : 'bg-primary'}`}>{u.role}</span></td>
                                                            <td><span className={`badge ${u.is_active ? 'bg-success' : 'bg-danger'}`}>{u.is_active ? 'Online' : 'Paused'}</span></td>
                                                            <td className="text-end">
                                                                {u.role !== 'Admin' && <button className={`btn btn-sm btn-light`} onClick={() => toggleStatus(u.id)}>{u.is_active ? 'Suspend' : 'Resume'}</button>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Permissions Tab */}
                            {activeTab === 'permissions' && (
                                <div className="table-responsive">
                                    <table className="table border align-middle text-center overflow-hidden rounded-3">
                                        <thead className="bg-light bg-opacity-50">
                                            <tr><th className="text-start ps-4">MODULES</th>{roles.map(r => <th key={r}>{r}</th>)}</tr>
                                        </thead>
                                        <tbody>
                                            {modules.map(mod => (
                                                <tr key={mod}>
                                                    <td className="text-start ps-4 fw-bold small">{mod}</td>
                                                    {roles.map(role => (
                                                        <td key={`${role}-${mod}`}>
                                                            <div className="form-check form-switch d-flex justify-content-center ms-3">
                                                                <input className="form-check-input cursor-pointer" type="checkbox" checked={getPermission(role, mod)} onChange={() => togglePermission(role, mod, getPermission(role, mod))} />
                                                            </div>
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Account Access Tab */}
                            {activeTab === 'accounts' && (
                                <div className="table-responsive">
                                    <table className="table border align-middle text-center rounded-3">
                                        <thead className="bg-light py-4">
                                            <tr><th className="text-start ps-4">VAULT ENTITY</th>{roles.map(r => <th key={r}>{r}</th>)}</tr>
                                        </thead>
                                        <tbody>
                                            {accounts.map(acc => (
                                                <tr key={acc.id}>
                                                    <td className="text-start ps-4 fw-medium small">
                                                        {acc.name} <span className="text-muted small">({acc.code})</span>
                                                    </td>
                                                    {roles.map(role => (
                                                        <td key={`${role}-${acc.id}`}>
                                                            <div className="form-check form-switch d-flex justify-content-center ms-3">
                                                                <input className="form-check-input cursor-pointer" type="checkbox" checked={getAccountPermission(role, acc.id)} onChange={() => toggleAccountPermission(role, acc.id, getAccountPermission(role, acc.id))} />
                                                            </div>
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Individual Access Tab */}
                            {activeTab === 'individual' && (
                                <div>
                                    <div className="mb-4 bg-light p-4 rounded-4 shadow-sm border border-primary border-opacity-10">
                                        <label className="form-label fw-bold text-dark small mb-3">SELECT TARGET USER FOR OVERRIDES</label>
                                        <select
                                            className="form-select form-select-lg border-0 shadow-sm"
                                            value={selectedUserId}
                                            onChange={e => setSelectedUserId(e.target.value)}
                                        >
                                            <option value="">-- Select a User --</option>
                                            {users.filter(u => u.role !== 'Admin').map(u => (
                                                <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                                            ))}
                                        </select>
                                        {!selectedUserId && <div className="mt-3 text-muted x-small"><i className="fa-solid fa-circle-info me-1"></i> Selection required to manage individual granularity.</div>}
                                    </div>

                                    {selectedUserId && (
                                        <div className="row g-4">
                                            <div className="col-12">
                                                <div className="alert alert-warning py-2 x-small mb-4 d-flex align-items-center gap-2">
                                                    <i className="fa-solid fa-bolt text-warning"></i>
                                                    <div>Settings here <strong>override</strong> global role permissions for this user specifically. A <span className="text-primary fw-bold">blue dot</span> indicates an active override.</div>
                                                </div>
                                            </div>

                                            <div className="col-lg-6">
                                                <h6 className="fw-bold mb-3 text-muted x-small ls-1">MODULE OVERRIDES</h6>
                                                <div className="table-responsive border rounded-3 overflow-hidden">
                                                    <table className="table table-sm align-middle mb-0">
                                                        <thead className="bg-light"><tr><th className="ps-3 py-2 small">Module</th><th className="text-center py-2 small">Access</th></tr></thead>
                                                        <tbody>
                                                            {modules.map(mod => (
                                                                <tr key={mod}>
                                                                    <td className="ps-3 py-2 small fw-medium">
                                                                        {mod}
                                                                        {isOverridden(selectedUserId, 'module', mod) && <span className="ms-2 badge rounded-pill bg-primary" style={{ width: 6, height: 6, padding: 0 }} title="Overridden"> </span>}
                                                                    </td>
                                                                    <td className="text-center py-2">
                                                                        <div className="form-check form-switch d-inline-block">
                                                                            <input
                                                                                className="form-check-input"
                                                                                type="checkbox"
                                                                                checked={getIndModulePerm(selectedUserId, mod)}
                                                                                onChange={() => toggleIndividualPermission(selectedUserId, 'module', mod, getIndModulePerm(selectedUserId, mod))}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div className="col-lg-6">
                                                <h6 className="fw-bold mb-3 text-muted x-small ls-1">ACCOUNT OVERRIDES</h6>
                                                <div className="table-responsive border rounded-3 overflow-hidden">
                                                    <table className="table table-sm align-middle mb-0">
                                                        <thead className="bg-light"><tr><th className="ps-3 py-2 small">Account</th><th className="text-center py-2 small">Access</th></tr></thead>
                                                        <tbody>
                                                            {accounts.map(acc => (
                                                                <tr key={acc.id}>
                                                                    <td className="ps-3 py-2 small fw-medium">
                                                                        {acc.name}
                                                                        {isOverridden(selectedUserId, 'account', acc.id) && <span className="ms-2 badge rounded-pill bg-primary" style={{ width: 6, height: 6, padding: 0 }} title="Overridden"> </span>}
                                                                    </td>
                                                                    <td className="text-center py-2">
                                                                        <div className="form-check form-switch d-inline-block">
                                                                            <input
                                                                                className="form-check-input"
                                                                                type="checkbox"
                                                                                checked={getIndAccountPerm(selectedUserId, acc.id)}
                                                                                onChange={() => toggleIndividualPermission(selectedUserId, 'account', acc.id, getIndAccountPerm(selectedUserId, acc.id))}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Finances Tab */}
                            {activeTab === 'finances' && (
                                <div className="max-w-600">
                                    <div className="mb-4">
                                        <label className="form-label x-small fw-bold text-muted text-uppercase">Default Market Exchange Rate (USD → BDT)</label>
                                        <div className="input-group input-group-lg">
                                            <span className="input-group-text bg-light border-light-subtle">$1.00 =</span>
                                            <input
                                                type="number"
                                                className="form-control border-light-subtle fw-bold"
                                                value={settings.usd_bdt_rate}
                                                onChange={e => setSettings({ ...settings, usd_bdt_rate: e.target.value })}
                                            />
                                            <span className="input-group-text bg-light border-light-subtle">BDT</span>
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-primary px-4 py-2 fw-bold shadow-sm"
                                        onClick={async () => {
                                            await handleSaveSetting('usd_bdt_rate', settings.usd_bdt_rate);
                                            alert('Financial settings saved successfully');
                                        }}
                                        disabled={saving}
                                    >
                                        {saving ? 'Saving...' : 'Save Financial Settings'}
                                    </button>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Settings;
