import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api, { viewFile } from '../api/axios';

const AssetTracking = () => {
    const [assets, setAssets] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [categories, setCategories] = useState([]);
    const [globalHistory, setGlobalHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' or 'history'
    const [errorMsg, setErrorMsg] = useState(null);

    const [showAssetModal, setShowAssetModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(null);

    const [assetForm, setAssetForm] = useState({
        name: '', category: '', serial_number: '', status: 'Available',
        specs: '', room_number: '', is_fixed: false, purchase_date: '', purchase_value: '', purchased_from: ''
    });
    const [newCatName, setNewCatName] = useState('');
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(null);
    const [assignNote, setAssignNote] = useState('');
    const [assignRoom, setAssignRoom] = useState('');

    // History Filters
    const [historyFilter, setHistoryFilter] = useState({
        action: '',
        search: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [assetRes, empRes, catRes, historyRes] = await Promise.all([
                api.get('/assets'),
                api.get('/payroll/employees'),
                api.get('/assets/categories'),
                api.get('/assets/history')
            ]);
            setAssets(assetRes.data);
            setEmployees(empRes.data);
            setCategories(catRes.data);
            setGlobalHistory(historyRes.data);

            // Set default category for form if none selected and categories exist
            if (!assetForm.category && catRes.data.length > 0) {
                setAssetForm(prev => ({ ...prev, category: catRes.data[0].name }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveAsset = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            Object.keys(assetForm).forEach(key => {
                const val = assetForm[key];
                if (val !== null && val !== undefined) {
                    // Fix: If assigning object (like populated assigned_to), only send ID
                    if (typeof val === 'object' && val._id) {
                        formData.append(key, val._id);
                    } else if (typeof val !== 'object' || val instanceof Date || val instanceof File) {
                        formData.append(key, val);
                    }
                }
            });
            if (invoiceFile) {
                formData.append('invoice', invoiceFile);
            }

            if (assetForm.id || assetForm._id) {
                const id = assetForm.id || assetForm._id;
                await api.put(`/assets/${id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await api.post('/assets', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            setShowAssetModal(false);
            setInvoiceFile(null);
            setErrorMsg(null);
            fetchData();
            setAssetForm({
                name: '', category: categories[0]?.name || '', serial_number: '', status: 'Available',
                specs: '', room_number: '', is_fixed: false, purchase_date: '', purchase_value: '', purchased_from: ''
            });
        } catch (err) {
            setErrorMsg(err.response?.data?.detail || 'Save failed. Please check your inputs or file type.');
        }
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        try {
            setErrorMsg(null);
            await api.post('/assets/categories', { name: newCatName });
            setNewCatName('');
            const res = await api.get('/assets/categories');
            setCategories(res.data);
        } catch (err) { setErrorMsg(err.response?.data?.detail || 'Failed to add category'); }
    };

    const handleDeleteCategory = async (id) => {
        if (!window.confirm('Delete this category?')) return;
        try {
            await api.delete(`/assets/categories/${id}`);
            const res = await api.get('/assets/categories');
            setCategories(res.data);
        } catch (err) { alert('Failed to delete category'); }
    }

    const handleAssign = async (employeeId) => {
        try {
            setErrorMsg(null);
            const asset = showAssignModal;
            await api.post(`/assets/${asset.id || asset._id}/assign`, {
                employee_id: employeeId || null,
                room_number: assignRoom || null,
                notes: assignNote
            });
            setShowAssignModal(null);
            setAssignNote('');
            setAssignRoom('');
            fetchData();
        } catch (err) { setErrorMsg(err.response?.data?.detail || 'Operation failed'); }
    };

    const handleReturn = async (asset) => {
        if (!window.confirm(`Are you sure you want to return ${asset.name} to stock?`)) return;
        try {
            const notes = prompt("Enter return notes (optional):", "Returned to stock");
            await api.post(`/assets/${asset.id || asset._id}/return`, { notes });
            fetchData();
        } catch (err) { alert('Return failed'); }
    }

    const handleDeleteAsset = async (asset) => {
        if (!window.confirm(`PERMANENT DELETE: Are you sure you want to remove ${asset.name}? History will be preserved but the item will be gone.`)) return;
        try {
            await api.delete(`/assets/${asset.id || asset._id}`);
            fetchData();
        } catch (err) { alert('Delete failed'); }
    }

    // Prepare asset for editing
    const startEdit = (asset) => {
        const editDoc = { ...asset };
        // Convert all nulls to empty strings to avoid React warnings
        Object.keys(editDoc).forEach(key => {
            if (editDoc[key] === null) editDoc[key] = '';
        });
        // Special handling for date
        if (editDoc.purchase_date) editDoc.purchase_date = editDoc.purchase_date.split('T')[0];

        setAssetForm(editDoc);
        setShowAssetModal(true);
    };

    const totalPurchaseValue = assets.reduce((sum, a) => sum + Number(a.purchase_value || 0), 0);
    const stockCount = assets.filter(a => a.status === 'Available').length;
    const inUseCount = assets.filter(a => a.status === 'In Use').length;

    const stockByCategory = {};
    categories.forEach(cat => {
        stockByCategory[cat.name] = assets.filter(a => a.category === cat.name && a.status === 'Available').length;
    });

    const filteredHistory = globalHistory.filter(h => {
        const matchesAction = !historyFilter.action || h.action === historyFilter.action;
        const matchesSearch = !historyFilter.search ||
            h.asset_id?.name?.toLowerCase().includes(historyFilter.search.toLowerCase()) ||
            h.asset_id?.serial_number?.toLowerCase().includes(historyFilter.search.toLowerCase()) ||
            h.employee_id?.name?.toLowerCase().includes(historyFilter.search.toLowerCase());
        return matchesAction && matchesSearch;
    });

    return (
        <Layout title="Asset Lifecycle Manager">
            <div className="row g-4 mb-4">
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 bg-primary text-white p-4 h-100 position-relative overflow-hidden">
                        <div className="position-relative z-1">
                            <h6 className="text-uppercase x-small ls-2 opacity-75 mb-1">Total Fixed Assets</h6>
                            <h2 className="fw-extrabold mb-0">{totalPurchaseValue.toLocaleString()} <small className="fs-6">BDT</small></h2>
                        </div>
                        <i className="fa-solid fa-coins position-absolute end-0 bottom-0 mb-n3 me-n2 opacity-25" style={{ fontSize: '5rem' }}></i>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4 h-100 border-start border-success border-5">
                        <h6 className="text-uppercase x-small ls-2 text-muted mb-1">In Stock / Available</h6>
                        <h2 className="fw-extrabold mb-0 text-success">{stockCount}</h2>
                        <div className="progress mt-2" style={{ height: '4px' }}>
                            <div className="progress-bar bg-success" style={{ width: `${(assets.length > 0 ? (stockCount / assets.length) * 100 : 0)}%` }}></div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4 h-100 border-start border-info border-5">
                        <h6 className="text-uppercase x-small ls-2 text-muted mb-1">Issued / In Use</h6>
                        <h2 className="fw-extrabold mb-0 text-info">{inUseCount}</h2>
                        <div className="progress mt-2" style={{ height: '4px' }}>
                            <div className="progress-bar bg-info" style={{ width: `${(assets.length > 0 ? (inUseCount / assets.length) * 100 : 0)}%` }}></div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="d-flex flex-column gap-2 h-100">
                        <button className="btn btn-dark w-100 flex-grow-1 rounded-4 shadow-sm fw-bold d-flex align-items-center justify-content-center gap-2" onClick={() => setShowAssetModal(true)}>
                            <i className="fa-solid fa-plus-circle"></i> Register Asset
                        </button>
                        <button className="btn btn-outline-secondary w-100 flex-grow-1 rounded-4 shadow-sm fw-bold d-flex align-items-center justify-content-center gap-2" onClick={() => setShowCategoryModal(true)}>
                            <i className="fa-solid fa-tags"></i> Manage Categories
                        </button>
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm rounded-4 mb-4 p-4">
                <h6 className="text-muted small fw-extrabold text-uppercase ls-1 mb-3">Available In Stock by Category</h6>
                <div className="d-flex flex-wrap gap-3">
                    {categories.map(cat => (
                        <div key={cat._id || cat.id} className="bg-light rounded-pill px-4 py-2 d-flex align-items-center border border-light-subtle shadow-sm">
                            <i className="fa-solid fa-folder-open text-primary me-2 small"></i>
                            <span className="fw-bold text-dark me-2 small">{cat.name}:</span>
                            <span className="badge bg-primary rounded-pill fw-bold" style={{ fontSize: '0.75rem' }}>{stockByCategory[cat.name] || 0}</span>
                        </div>
                    ))}
                    {categories.length === 0 && <div className="text-muted small italic">No categories defined yet.</div>}
                </div>
            </div>

            <ul className="nav nav-pills mb-4 bg-white p-2 rounded-4 shadow-sm d-inline-flex border">
                <li className="nav-item">
                    <button className={`nav-link px-4 rounded-3 fw-bold ${activeTab === 'inventory' ? 'active' : 'text-dark'}`} onClick={() => setActiveTab('inventory')}>
                        <i className="fa-solid fa-boxes-stacked me-2"></i> Inventory List
                    </button>
                </li>
                <li className="nav-item ms-2">
                    <button className={`nav-link px-4 rounded-3 fw-bold ${activeTab === 'history' ? 'active' : 'text-dark'}`} onClick={() => setActiveTab('history')}>
                        <i className="fa-solid fa-timeline me-2"></i> Overall History
                    </button>
                </li>
            </ul>

            {activeTab === 'inventory' ? (
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                    <div className="card-header bg-white border-bottom p-4 d-flex justify-content-between align-items-center">
                        <h5 className="fw-bold mb-0">Device Repository</h5>
                    </div>
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th className="ps-4">Item Name</th>
                                    <th>Category</th>
                                    <th>Purchase Info</th>
                                    <th>Location / User</th>
                                    <th>Status</th>
                                    <th className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assets.map(asset => (
                                    <tr key={asset._id || asset.id}>
                                        <td className="ps-4 py-3">
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="fw-bold text-dark">{asset.name}</div>
                                                {asset.is_fixed && <span className="badge bg-warning-subtle text-warning border-warning border-opacity-25 x-small" style={{ fontSize: '10px' }}>FIXED</span>}
                                            </div>
                                            <div className="x-small text-muted fw-mono">SN: {asset.serial_number || 'N/A'}</div>
                                        </td>
                                        <td><span className="badge bg-light text-dark border">{asset.category}</span></td>
                                        <td>
                                            <div className="small fw-semibold">{Number(asset.purchase_value || 0).toLocaleString()} BDT</div>
                                            <div className="x-small text-muted italic">via {asset.purchased_from || 'Unknown'}</div>
                                            {asset.invoice_image && (
                                                <button onClick={() => viewFile(asset.invoice_image.replace('/uploads/', ''))} className="btn btn-link p-0 x-small text-primary text-decoration-none border-0">
                                                    <i className="fa-solid fa-file-invoice me-1"></i> View Invoice
                                                </button>
                                            )}
                                        </td>
                                        <td>
                                            {asset.assigned_to ? (
                                                <div>
                                                    <div className="small fw-bold text-primary"><i className="fa-solid fa-user me-1"></i> {asset.assigned_to.name}</div>
                                                    <div className="x-small text-muted">{asset.assigned_to.designation}</div>
                                                </div>
                                            ) : (
                                                <div className="small text-muted">
                                                    <i className="fa-solid fa-map-location-dot me-1"></i> {asset.room_number || 'Warehouse'}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge rounded-pill ${asset.status === 'Available' ? 'bg-success' : asset.status === 'In Use' ? 'bg-primary' : 'bg-warning text-dark'}`}>
                                                {asset.status}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            <div className="d-flex justify-content-center gap-2">
                                                <button className="btn btn-sm btn-outline-info rounded-circle" onClick={() => setShowHistoryModal(asset)} title="History"><i className="fa-solid fa-clock-rotate-left"></i></button>

                                                {asset.status === 'In Use' ? (
                                                    <button className="btn btn-sm btn-outline-warning rounded-circle" onClick={() => handleReturn(asset)} title="Return to Stock"><i className="fa-solid fa-rotate-left"></i></button>
                                                ) : (
                                                    <button className="btn btn-sm btn-outline-primary rounded-circle" onClick={() => { setShowAssignModal(asset); setAssignRoom(asset.room_number || ''); }} title="Assign"><i className="fa-solid fa-hand-holding-hand"></i></button>
                                                )}

                                                <button className="btn btn-sm btn-outline-primary rounded-circle" onClick={() => { setShowAssignModal(asset); setAssignRoom(asset.room_number || ''); }} title="Transfer/Relocate"><i className="fa-solid fa-right-left"></i></button>

                                                <button className="btn btn-sm btn-outline-secondary rounded-circle" onClick={() => startEdit(asset)} title="Edit Details"><i className="fa-solid fa-pen"></i></button>

                                                <button className="btn btn-sm btn-outline-danger rounded-circle" onClick={() => handleDeleteAsset(asset)} title="Delete Asset"><i className="fa-solid fa-trash-can"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                    <div className="card-header bg-white border-bottom p-4">
                        <div className="row g-3">
                            <div className="col-md-4">
                                <h5 className="fw-bold mb-0">Global Audit Log</h5>
                            </div>
                            <div className="col-md-3">
                                <select className="form-select form-select-sm rounded-pill bg-light border-0" value={historyFilter.action} onChange={e => setHistoryFilter({ ...historyFilter, action: e.target.value })}>
                                    <option value="">All Actions</option>
                                    <option value="Assigned">Assigned</option>
                                    <option value="Returned">Returned</option>
                                    <option value="Transferred">Transferred</option>
                                    <option value="Relocated">Relocated</option>
                                    <option value="Modified">Modified</option>
                                </select>
                            </div>
                            <div className="col-md-5">
                                <input type="text" className="form-control form-control-sm rounded-pill bg-light border-0" placeholder="Search by asset or person..." value={historyFilter.search} onChange={e => setHistoryFilter({ ...historyFilter, search: e.target.value })} />
                            </div>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th className="ps-4">Asset</th>
                                    <th>Action</th>
                                    <th>Involved Party</th>
                                    <th>Date</th>
                                    <th>Performed By</th>
                                    <th className="pe-4">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredHistory.map((h, i) => (
                                    <tr key={i}>
                                        <td className="ps-4">
                                            <div className="fw-bold small">{h.asset_name || h.asset_id?.name || 'Deleted Asset'}</div>
                                            <div className="x-small text-muted">{h.asset_id?.serial_number}</div>
                                        </td>
                                        <td>
                                            <span className={`badge rounded-pill ${h.action === 'Assigned' ? 'bg-primary' :
                                                h.action === 'Returned' ? 'bg-success' :
                                                    h.action === 'Transferred' ? 'bg-info' :
                                                        h.action === 'Relocated' ? 'bg-info' :
                                                            h.action === 'Deleted' ? 'bg-danger' : 'bg-secondary'
                                                }`}>
                                                {h.action}
                                            </span>
                                        </td>
                                        <td className="small fw-semibold">{h.employee_id?.name || 'SYSTEM / STOCK'}</td>
                                        <td className="small">{new Date(h.date).toLocaleString()}</td>
                                        <td className="small text-muted">{h.performed_by}</td>
                                        <td className="small pe-4 italic text-muted" style={{ maxWidth: '250px' }}>{h.notes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showCategoryModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4">
                            <div className="modal-header border-0 p-4">
                                <h5 className="fw-bold m-0">Asset Categories</h5>
                                <button type="button" className="btn-close" onClick={() => { setShowCategoryModal(false); setErrorMsg(null); }}></button>
                            </div>
                            <div className="modal-body p-4 pt-0">
                                {errorMsg && (
                                    <div className="alert alert-danger py-2 px-3 border-0 small fw-bold mb-3 d-flex align-items-center gap-2">
                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                        {errorMsg}
                                    </div>
                                )}
                                <form className="d-flex gap-2 mb-4" onSubmit={handleSaveCategory}>
                                    <input type="text" className="form-control bg-light border-0" placeholder="New Category Name" value={newCatName} onChange={e => setNewCatName(e.target.value)} required />
                                    <button className="btn btn-primary px-4 fw-bold">Add</button>
                                </form>
                                <div className="list-group list-group-flush border-top">
                                    {categories.map(c => (
                                        <div key={c._id || c.id} className="list-group-item d-flex justify-content-between align-items-center py-3 bg-transparent border-bottom px-0">
                                            <span className="fw-semibold text-dark">{c.name}</span>
                                            <button className="btn btn-sm btn-outline-danger border-0 rounded-circle" onClick={() => handleDeleteCategory(c._id || c.id)}><i className="fa-solid fa-trash"></i></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAssetModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <form className="modal-content border-0 shadow-lg rounded-4" onSubmit={handleSaveAsset}>
                            <div className="modal-header border-0 p-4 pb-0">
                                <h5 className="fw-bold m-0">{(assetForm.id || assetForm._id) ? 'Modify Record' : 'Register New Asset'}</h5>
                                <button type="button" className="btn-close" onClick={() => { setShowAssetModal(false); setErrorMsg(null); setAssetForm({ name: '', category: categories[0]?.name || '', serial_number: '', status: 'Available', specs: '', room_number: '', is_fixed: false, purchase_date: '', purchase_value: '', purchased_from: '' }); }}></button>
                            </div>
                            <div className="modal-body p-4">
                                {errorMsg && (
                                    <div className="alert alert-danger py-2 px-3 border-0 small fw-bold mb-3 d-flex align-items-center gap-2">
                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                        {errorMsg}
                                    </div>
                                )}
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-muted text-uppercase ls-1">Asset Name</label>
                                        <input type="text" className="form-control border-light shadow-sm bg-light" value={assetForm.name || ''} onChange={e => setAssetForm({ ...assetForm, name: e.target.value })} required />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label small fw-bold text-muted text-uppercase ls-1">Serial Number</label>
                                        <input type="text" className="form-control border-light shadow-sm bg-light" value={assetForm.serial_number || ''} onChange={e => setAssetForm({ ...assetForm, serial_number: e.target.value })} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label small fw-bold text-muted text-uppercase ls-1">Category</label>
                                        <select className="form-select border-light shadow-sm bg-light" value={assetForm.category || ''} onChange={e => setAssetForm({ ...assetForm, category: e.target.value })} required>
                                            <option value="">-- Select --</option>
                                            {categories.map(c => <option key={c._id || c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted text-uppercase ls-1">Purchase Date</label>
                                        <input type="date" className="form-control border-light shadow-sm bg-light" value={assetForm.purchase_date || ''} onChange={e => setAssetForm({ ...assetForm, purchase_date: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted text-uppercase ls-1">Purchase Value (BDT)</label>
                                        <input type="number" className="form-control border-light shadow-sm bg-light" value={assetForm.purchase_value || ''} onChange={e => setAssetForm({ ...assetForm, purchase_value: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted text-uppercase ls-1">Vendor</label>
                                        <input type="text" className="form-control border-light shadow-sm bg-light" value={assetForm.purchased_from || ''} onChange={e => setAssetForm({ ...assetForm, purchased_from: e.target.value })} placeholder="e.g. Star Tech" />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-muted text-uppercase ls-1">Room / Location</label>
                                        <input type="text" className="form-control border-light shadow-sm bg-light" value={assetForm.room_number || ''} onChange={e => setAssetForm({ ...assetForm, room_number: e.target.value })} placeholder="e.g. Room 402" />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-muted text-uppercase ls-1">Status</label>
                                        <select className="form-select border-light shadow-sm bg-light" value={assetForm.status || ''} onChange={e => setAssetForm({ ...assetForm, status: e.target.value })}>
                                            <option value="Available">Available</option>
                                            <option value="In Use">In Use</option>
                                            <option value="Repair">Repair</option>
                                            <option value="Retired">Retired</option>
                                        </select>
                                    </div>
                                    <div className="col-12">
                                        <div className="form-check form-switch p-3 bg-light rounded-3 border">
                                            <input className="form-check-input ms-0 me-2" type="checkbox" id="isFixedAsset" checked={assetForm.is_fixed || false} onChange={e => setAssetForm({ ...assetForm, is_fixed: e.target.checked })} />
                                            <label className="form-check-label small fw-bold text-uppercase ls-1 text-primary" htmlFor="isFixedAsset">
                                                <i className="fa-solid fa-anchor me-1"></i> Fixed Asset (Tied to Room/Location)
                                            </label>
                                            <div className="x-small text-muted ms-4 mt-1">Check this for items like ACs, Furniture, or heavy machinery that stays in a room.</div>
                                        </div>
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label small fw-bold text-muted text-uppercase ls-1">Specs & Details</label>
                                        <textarea className="form-control border-light shadow-sm bg-light" rows="3" value={assetForm.specs || ''} onChange={e => setAssetForm({ ...assetForm, specs: e.target.value })}></textarea>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer border-0 p-4 pt-0">
                                <button type="submit" className="btn btn-primary w-100 py-2 rounded-3 fw-bold shadow-sm">Save Asset</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAssignModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4">
                            <div className="modal-body p-4">
                                <div className="text-center mb-4">
                                    <h5 className="fw-bold">Relocation / Assignment</h5>
                                </div>
                                {errorMsg && (
                                    <div className="alert alert-danger py-2 px-3 border-0 small fw-bold mb-3 d-flex align-items-center gap-2">
                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                        {errorMsg}
                                    </div>
                                )}
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted">Assign to Employee</label>
                                    <select className="form-select border-light bg-light" onChange={e => handleAssign(e.target.value)}>
                                        <option value="">-- Choose Person --</option>
                                        {employees.map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="text-center my-3"><span className="badge bg-light text-muted">OR MOVEMENT</span></div>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted">Room Name</label>
                                    <div className="input-group">
                                        <input type="text" className="form-control border-light bg-light" value={assignRoom} onChange={e => setAssignRoom(e.target.value)} />
                                        <button className="btn btn-dark" onClick={() => handleAssign('')}>Update Location</button>
                                    </div>
                                </div>
                                <textarea className="form-control border-light bg-light mb-3" placeholder="Notes..." value={assignNote} onChange={e => setAssignNote(e.target.value)}></textarea>
                                <button className="btn btn-light w-100 fw-bold border" onClick={() => setShowAssignModal(null)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showHistoryModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            <div className="modal-header bg-dark text-white p-4">
                                <h5 className="fw-bold m-0">History: {showHistoryModal.name}</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowHistoryModal(null)}></button>
                            </div>
                            <div className="modal-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="bg-light">
                                            <tr>
                                                <th className="ps-4">Action</th>
                                                <th>Party</th>
                                                <th>Performed By</th>
                                                <th>Date</th>
                                                <th className="pe-4">Notes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(showHistoryModal.history || []).map((h, i) => (
                                                <tr key={i}>
                                                    <td className="ps-4">
                                                        <span className={`badge rounded-pill ${h.action === 'Assigned' ? 'bg-primary' :
                                                            h.action === 'Returned' ? 'bg-success' :
                                                                h.action === 'Transferred' ? 'bg-info' :
                                                                    h.action === 'Relocated' ? 'bg-info' :
                                                                        h.action === 'Deleted' ? 'bg-danger' : 'bg-secondary'
                                                            }`}>
                                                            {h.action}
                                                        </span>
                                                    </td>
                                                    <td>{h.employee_id?.name || 'STOCK'}</td>
                                                    <td>{h.performed_by}</td>
                                                    <td>{new Date(h.date).toLocaleDateString()}</td>
                                                    <td className="pe-4 italic text-muted small">{h.notes}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default AssetTracking;
