import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { getFileURL } from '../../utils/urlHelper';

const OnboardingManagement = () => {
    const [materials, setMaterials] = useState([]);
    const [progress, setProgress] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('materials');
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [viewingForm, setViewingForm] = useState(null);
    const [formData, setFormData] = useState({
        type: 'Policy',
        title: '',
        description: '',
        url: '',
        custom_html: '',
        is_mandatory: true,
        order: 0
    });
    const [formFields, setFormFields] = useState([]);
    const [softwareUrls, setSoftwareUrls] = useState([]);
    const [trainingResources, setTrainingResources] = useState([]);
    const [file, setFile] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [matRes, progRes] = await Promise.all([
                api.get('/onboarding/content'),
                api.get('/onboarding/progress')
            ]);
            setMaterials(matRes.data);
            setProgress(progRes.data);
        } catch (err) {
            console.error('Error fetching onboarding data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const resetForm = () => {
        setEditingItem(null);
        setFormData({ type: 'Policy', title: '', description: '', url: '', custom_html: '', is_mandatory: true, order: 0 });
        setFormFields([]);
        setSoftwareUrls([]);
        setTrainingResources([]);
        setFile(null);
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setFormData({
            type: item.type,
            title: item.title || '',
            description: item.description || '',
            url: item.url || '',
            custom_html: item.custom_html || '',
            is_mandatory: item.is_mandatory,
            order: item.order || 0
        });
        setFormFields(item.form_fields || []);
        setSoftwareUrls(item.software_urls || []);
        setTrainingResources(item.training_resources || []);
        setShowModal(true);
    };

    const addField = () => {
        setFormFields([...formFields, { label: '', field_type: 'text', required: false, options: [] }]);
    };
    const removeField = (index) => setFormFields(formFields.filter((_, i) => i !== index));
    const updateField = (index, updates) => {
        const newArr = [...formFields];
        newArr[index] = { ...newArr[index], ...updates };
        setFormFields(newArr);
    };

    const addSoftwareUrl = () => setSoftwareUrls([...softwareUrls, { label: '', url: '' }]);
    const removeSoftwareUrl = (index) => setSoftwareUrls(softwareUrls.filter((_, i) => i !== index));
    const updateSoftwareUrl = (index, updates) => {
        const newArr = [...softwareUrls];
        newArr[index] = { ...newArr[index], ...updates };
        setSoftwareUrls(newArr);
    };

    const addTrainingResource = (type) => setTrainingResources([...trainingResources, { resource_type: type, label: '', value: '' }]);
    const removeTrainingResource = (index) => setTrainingResources(trainingResources.filter((_, i) => i !== index));
    const updateTrainingResource = (index, updates) => {
        const newArr = [...trainingResources];
        newArr[index] = { ...newArr[index], ...updates };
        setTrainingResources(newArr);
    };

    const handleSave = async (e) => {
        e.preventDefault();

        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => data.append(key, formData[key]));
            data.append('form_fields', JSON.stringify(formFields));
            data.append('software_urls', JSON.stringify(softwareUrls));
            data.append('training_resources', JSON.stringify(trainingResources));

            if (file) data.append('file', file);

            if (editingItem) {
                await api.put(`/onboarding/content/${editingItem._id}`, data);
            } else {
                await api.post('/onboarding/content', data);
            }

            setShowModal(false);
            resetForm();
            fetchData();
        } catch (err) {
            alert('Error saving material: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this material?')) return;
        try {
            await api.delete(`/onboarding/content/${id}`);
            fetchData();
        } catch (err) {
            alert('Error deleting: ' + err.message);
        }
    };

    return (
        <Layout title="Onboarding Management">
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div className="card-header bg-white p-0 border-0">
                    <ul className="nav nav-tabs nav-fill border-0">
                        <li className="nav-item">
                            <button
                                className={`nav-link py-3 border-0 rounded-0 fw-bold ${activeTab === 'materials' ? 'active bg-primary text-white' : 'text-muted'}`}
                                onClick={() => setActiveTab('materials')}
                            >
                                <i className="fa-solid fa-book-open me-2"></i> Onboarding Materials
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link py-3 border-0 rounded-0 fw-bold ${activeTab === 'progress' ? 'active bg-primary text-white' : 'text-muted'}`}
                                onClick={() => setActiveTab('progress')}
                            >
                                <i className="fa-solid fa-list-check me-2"></i> Employee Progress
                            </button>
                        </li>
                    </ul>
                </div>

                <div className="card-body p-4">
                    {activeTab === 'materials' ? (
                        <div>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h5 className="fw-bold mb-0">Training & Policy Content</h5>
                                <button className="btn btn-primary rounded-pill px-4" onClick={() => setShowModal(true)}>
                                    <i className="fa-solid fa-plus me-2"></i> Add Material
                                </button>
                            </div>

                            <div className="table-responsive">
                                <table className="table table-hover align-middle">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Order</th>
                                            <th>Type</th>
                                            <th>Title</th>
                                            <th>Mandatory</th>
                                            <th className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {materials.map(mat => (
                                            <tr key={mat._id}>
                                                <td><span className="badge bg-light text-dark border">{mat.order}</span></td>
                                                <td>
                                                    <span className={`badge rounded-pill ${mat.type === 'Policy' ? 'bg-info-subtle text-info' :
                                                        mat.type === 'Training' ? 'bg-success-subtle text-success' :
                                                            mat.type === 'Document' ? 'bg-primary-subtle text-primary' :
                                                                'bg-warning-subtle text-warning'
                                                        }`}>
                                                        {mat.type}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="fw-bold">{mat.title}</div>
                                                    <div className="small text-muted">{mat.description}</div>
                                                </td>
                                                <td>{mat.is_mandatory ? <i className="fa-solid fa-circle-check text-success"></i> : <i className="fa-solid fa-circle-minus text-muted"></i>}</td>
                                                <td className="text-end">
                                                    {mat.file_path && (
                                                        <a href={`${getFileURL(mat.file_path)}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary border-0 h-auto p-2 me-2">
                                                            <i className="fa-solid fa-file-lines"></i>
                                                        </a>
                                                    )}
                                                    <button className="btn btn-sm btn-outline-primary border-0 h-auto p-2 me-2" onClick={() => handleEdit(mat)}>
                                                        <i className="fa-solid fa-pen-to-square"></i>
                                                    </button>
                                                    <button className="btn btn-sm btn-outline-danger border-0 h-auto p-2" onClick={() => handleDelete(mat._id)}>
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h5 className="fw-bold mb-4">Employee Completion Status</h5>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Employee</th>
                                            <th>Material</th>
                                            <th>Status</th>
                                            <th>Date</th>
                                            <th>Signature</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {progress.map(p => (
                                            <tr key={p._id}>
                                                <td>
                                                    <div className="fw-bold">{p.user_id?.username}</div>
                                                    <div className="x-small badge bg-light text-muted">{p.user_id?.onboarding_status}</div>
                                                </td>
                                                <td>
                                                    <div className="small fw-bold">{p.content_id?.title}</div>
                                                    <div className="x-small text-muted">{p.content_id?.type}</div>
                                                </td>
                                                <td>
                                                    <span className={`badge rounded-pill ${p.status === 'Completed' ? 'bg-success' :
                                                        p.status === 'Acknowledged' ? 'bg-info' : 'bg-secondary'
                                                        }`}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td className="small">{new Date(p.updatedAt).toLocaleDateString()}</td>
                                                <td className="small font-monospace text-primary">
                                                    {p.digital_signature ? (
                                                        <span title={`IP: ${p.signature_ip} on ${new Date(p.signature_date).toLocaleString()}`}>
                                                            {p.digital_signature}
                                                        </span>
                                                    ) : p.form_data ? (
                                                        <button className="btn btn-xs btn-outline-info py-0 px-2 rounded-pill x-small" onClick={() => setViewingForm(p)}>
                                                            <i className="fa-solid fa-eye me-1"></i> View Data
                                                        </button>
                                                    ) : p.progress_file_path ? (
                                                        <a href={`${getFileURL(p.progress_file_path)}`} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-outline-primary py-0 px-2 rounded-pill x-small">
                                                            <i className="fa-solid fa-download me-1"></i> Download File
                                                        </a>
                                                    ) : 'N/A'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Simple Modal Implementation */}
            {showModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-lg rounded-4">
                            <div className="modal-header border-0 p-4 pb-0">
                                <h5 className="modal-title fw-bold">{editingItem ? 'Edit Material' : 'Add Onboarding Material'}</h5>
                                <button type="button" className="btn-close" onClick={() => { setShowModal(false); setEditingItem(null); }}></button>
                            </div>
                            <form onSubmit={handleSave}>
                                <div className="modal-body p-4">
                                    <div className="row g-3 mb-3">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold">Type</label>
                                            <select className="form-select" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                                <option>Policy</option>
                                                <option>Training</option>
                                                <option>Software</option>
                                                <option>Document</option>
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold">Title</label>
                                            <input type="text" className="form-control" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-bold">Description</label>
                                        <textarea className="form-control" rows="2" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}></textarea>
                                    </div>

                                    <div className="row g-3 mb-3">
                                        <div className="col-md-6">
                                            {(formData.type === 'Training' || formData.type === 'Software') && (
                                                <>
                                                    <label className="form-label small fw-bold">URL / Link</label>
                                                    <input type="text" className="form-control" placeholder="https://..." value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} />
                                                </>
                                            )}
                                            {formData.type === 'Policy' && (
                                                <>
                                                    <label className="form-label small fw-bold">Policy File (PDF)</label>
                                                    <input type="file" className="form-control" accept=".pdf" onChange={e => setFile(e.target.files[0])} />
                                                    {editingItem?.file_path && <div className="x-small text-muted mt-1">Existing: {editingItem.file_path.split('_').pop()}</div>}
                                                </>
                                            )}
                                        </div>
                                        <div className="col-md-6 d-flex align-items-center">
                                            <div className="flex-grow-1">
                                                <label className="form-label small fw-bold">Display Order</label>
                                                <input type="number" className="form-control" value={formData.order} onChange={e => setFormData({ ...formData, order: e.target.value })} />
                                            </div>
                                            <div className="ms-3 pt-4">
                                                <div className="form-check form-switch">
                                                    <input className="form-check-input" type="checkbox" checked={formData.is_mandatory} onChange={e => setFormData({ ...formData, is_mandatory: e.target.checked })} />
                                                    <label className="form-check-label small fw-bold">Mandatory</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="form-label small fw-bold d-flex justify-content-between">
                                            Custom Sector View (HTML/CSS)
                                            <span className="badge bg-info-subtle text-info fw-normal">Optional</span>
                                        </label>
                                        <textarea
                                            className="form-control font-monospace x-small bg-dark text-info"
                                            rows="4"
                                            placeholder="<div style='color: blue;'>Hello World</div>"
                                            value={formData.custom_html}
                                            onChange={e => setFormData({ ...formData, custom_html: e.target.value })}
                                        ></textarea>
                                    </div>

                                    {/* Software URL Section */}
                                    {formData.type === 'Software' && (
                                        <div className="bg-light p-3 rounded-4 border mb-3">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <h6 className="fw-bold mb-0">Software Installation Links</h6>
                                                <button type="button" className="btn btn-xs btn-primary rounded-pill px-3" onClick={addSoftwareUrl}>
                                                    <i className="fa-solid fa-plus me-1"></i> Add Link
                                                </button>
                                            </div>
                                            {softwareUrls.map((sw, idx) => (
                                                <div key={idx} className="bg-white p-2 rounded-3 mb-2 border shadow-sm d-flex gap-2 align-items-center">
                                                    <input type="text" className="form-control form-control-sm" placeholder="Label (e.g. VS Code)" value={sw.label} onChange={e => updateSoftwareUrl(idx, { label: e.target.value })} />
                                                    <input type="text" className="form-control form-control-sm" placeholder="Download URL" value={sw.url} onChange={e => updateSoftwareUrl(idx, { url: e.target.value })} />
                                                    <button type="button" className="btn btn-sm btn-outline-danger border-0" onClick={() => removeSoftwareUrl(idx)}>
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                </div>
                                            ))}
                                            {softwareUrls.length === 0 && <div className="text-center py-2 text-muted x-small">Click 'Add Link' to provide software download URLs.</div>}
                                        </div>
                                    )}

                                    {/* Training Resource Section */}
                                    {formData.type === 'Training' && (
                                        <div className="bg-light p-3 rounded-4 border mb-3">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <h6 className="fw-bold mb-0">Training Resources</h6>
                                                <div className="d-flex gap-2">
                                                    <button type="button" className="btn btn-xs btn-primary rounded-pill px-3" onClick={() => addTrainingResource('url')}>
                                                        <i className="fa-solid fa-link me-1"></i> Add Link
                                                    </button>
                                                    <button type="button" className="btn btn-xs btn-info rounded-pill px-3" onClick={() => addTrainingResource('file')}>
                                                        <i className="fa-solid fa-file-upload me-1"></i> Add File Path
                                                    </button>
                                                </div>
                                            </div>
                                            {trainingResources.map((res, idx) => (
                                                <div key={idx} className="bg-white p-2 rounded-3 mb-2 border shadow-sm d-flex gap-2 align-items-center">
                                                    <div className="badge bg-light text-muted x-small border">{res.resource_type === 'url' ? 'URL' : 'FILE'}</div>
                                                    <input type="text" className="form-control form-control-sm" placeholder="Label" value={res.label} onChange={e => updateTrainingResource(idx, { label: e.target.value })} />
                                                    <input type="text" className="form-control form-control-sm" placeholder={res.resource_type === 'url' ? "https://..." : "filename in uploads/"} value={res.value} onChange={e => updateTrainingResource(idx, { value: e.target.value })} />
                                                    <button type="button" className="btn btn-sm btn-outline-danger border-0" onClick={() => removeTrainingResource(idx)}>
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="x-small text-muted mt-2">
                                                <i className="fa-solid fa-circle-info me-1"></i> Training resource files should be pre-uploaded or provided via direct URLs.
                                            </div>
                                        </div>
                                    )}

                                    {/* Dynamic Form Builder */}
                                    {(formData.type === 'Document' || formData.type === 'Training') && (
                                        <div className="bg-light p-3 rounded-4 border">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <h6 className="fw-bold mb-0">{formData.type === 'Training' ? 'Completion Verification' : 'Custom Data Collection Form'}</h6>
                                                <button type="button" className="btn btn-xs btn-primary rounded-pill px-3" onClick={addField}>
                                                    <i className="fa-solid fa-plus me-1"></i> Add Field
                                                </button>
                                            </div>

                                            {formFields.length === 0 && (
                                                <div className="text-center py-3 text-muted x-small">No verification fields added. {formData.type === 'Training' ? 'The system will still require a digital signature.' : 'Click Add Field to start.'}</div>
                                            )}

                                            {formFields.map((field, idx) => (
                                                <div key={idx} className="bg-white p-3 rounded-3 mb-2 border shadow-sm">
                                                    <div className="row g-2 align-items-end">
                                                        <div className="col-md-4">
                                                            <label className="extra-small fw-bold text-muted text-uppercase mb-1">Field Label</label>
                                                            <input type="text" className="form-control form-control-sm" placeholder="e.g. NID Number" value={field.label} onChange={e => updateField(idx, { label: e.target.value })} />
                                                        </div>
                                                        <div className="col-md-3">
                                                            <label className="extra-small fw-bold text-muted text-uppercase mb-1">Type</label>
                                                            <select className="form-select form-select-sm" value={field.field_type} onChange={e => updateField(idx, { field_type: e.target.value })}>
                                                                <option value="text">Short Text</option>
                                                                <option value="number">Number</option>
                                                                <option value="date">Date</option>
                                                                <option value="file">File/Image Upload</option>
                                                                <option value="select">Dropdown</option>
                                                            </select>
                                                        </div>
                                                        <div className="col-md-3">
                                                            <div className="form-check form-switch mb-1">
                                                                <input className="form-check-input" type="checkbox" checked={field.required} onChange={e => updateField(idx, { required: e.target.checked })} />
                                                                <label className="extra-small fw-bold text-muted">Required</label>
                                                            </div>
                                                        </div>
                                                        <div className="col-md-2 text-end">
                                                            <button type="button" className="btn btn-sm btn-outline-danger border-0" onClick={() => removeField(idx)}>
                                                                <i className="fa-solid fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {field.field_type === 'select' && (
                                                        <div className="mt-2">
                                                            <label className="extra-small fw-bold text-muted text-uppercase mb-1">Options (comma separated)</label>
                                                            <input type="text" className="form-control form-control-sm" placeholder="Option 1, Option 2, Option 3" value={field.options.join(', ')} onChange={e => updateField(idx, { options: e.target.value.split(',').map(s => s.trim()) })} />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer border-0 p-4 pt-0">
                                    <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => { setShowModal(false); setEditingItem(null); }}>Cancel</button>
                                    <button type="submit" className="btn btn-primary rounded-pill px-4">{editingItem ? 'Update Material' : 'Create Material'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {/* View Submission Details Modal */}
            {viewingForm && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4">
                            <div className="modal-header border-0 p-4 pb-0">
                                <h5 className="modal-title fw-bold">Submission Details</h5>
                                <button type="button" className="btn-close" onClick={() => setViewingForm(null)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="text-center mb-4">
                                    <div className="badge bg-primary-subtle text-primary rounded-pill px-3 py-2 mb-2">
                                        {viewingForm.content_id?.title}
                                    </div>
                                    <h6 className="text-muted small">Submitted by {viewingForm.user_id?.username}</h6>
                                </div>

                                <div className="bg-light rounded-4 p-3 border">
                                    {Object.entries(viewingForm.form_data || {}).map(([key, value], idx) => (
                                        <div key={idx} className={`mb-3 ${idx < Object.entries(viewingForm.form_data).length - 1 ? 'border-bottom pb-2' : ''}`}>
                                            <label className="extra-small fw-bold text-muted text-uppercase d-block mb-1">{key}</label>
                                            {typeof value === 'string' && (value.includes('uploads/') || value.includes('uploads\\')) ? (
                                                <a href={`${getFileURL(value)}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary rounded-pill px-3 mt-1">
                                                    <i className="fa-solid fa-file-image me-2"></i> View Uploaded File
                                                </a>
                                            ) : (
                                                <div className="fw-bold text-dark">{value || 'N/A'}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="modal-footer border-0 p-4 pt-0">
                                <button type="button" className="btn btn-light rounded-pill px-4 w-100" onClick={() => setViewingForm(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default OnboardingManagement;
