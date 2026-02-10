import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { getFileURL } from '../../utils/urlHelper';

const OnboardingStepper = ({ onComplete }) => {
    const [status, setStatus] = useState('Pending');
    const [materials, setMaterials] = useState([]);
    const [progress, setProgress] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [signature, setSignature] = useState('');
    const [uploading, setUploading] = useState(false);

    const fetchData = async () => {
        try {
            const res = await api.get('/portal/onboarding/status');
            setStatus(res.data.status);
            setMaterials(res.data.materials);
            setProgress(res.data.progress);

            // Determine current step based on progress
            const mandatory = res.data.materials.filter(m => m.is_mandatory);
            let firstIncompleteIndex = mandatory.findIndex(m =>
                !res.data.progress.find(p => p.content_id === m._id && (p.status === 'Completed' || p.status === 'Acknowledged'))
            );

            if (firstIncompleteIndex === -1) {
                // All mandatory done, check if user is marked as completed
                if (res.data.status === 'Completed') onComplete();
                setCurrentStep(mandatory.length); // Final step
            } else {
                setCurrentStep(firstIncompleteIndex);
            }
        } catch (err) {
            console.error('Error fetching onboarding status:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAction = async (material, actionStatus) => {
        try {
            await api.post('/portal/onboarding/update', {
                content_id: material._id,
                status: actionStatus,
                digital_signature: actionStatus === 'Acknowledged' ? signature : null
            });
            fetchData();
        } catch (err) {
            alert('Progress update failed');
        }
    };

    const handleUpload = async (e, content_id = null) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        if (content_id) formData.append('content_id', content_id);
        setUploading(true);

        try {
            await api.post('/portal/onboarding/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            alert('File uploaded successfully');
        } catch (err) {
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>;

    const steps = [
        ...materials.sort((a, b) => a.order - b.order),
        { title: 'Finish', type: 'Finish', description: 'Review and complete your onboarding.' }
    ];

    const currentMaterial = steps[currentStep];

    return (
        <div className="onboarding-container p-3">
            <style>{`
                .stepper-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 2rem;
                    position: relative;
                }
                .stepper-header::before {
                    content: '';
                    position: absolute;
                    top: 15px; left: 0; right: 0;
                    height: 2px; background: var(--border);
                    z-index: 0;
                }
                .step-dot {
                    width: 32px; height: 32px;
                    border-radius: 50%;
                    background: var(--card-bg);
                    border: 2px solid var(--border);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 1; font-weight: 700; font-size: 0.8rem;
                    transition: all 0.3s;
                }
                .step-dot.active { background: var(--primary); border-color: var(--primary); color: white; box-shadow: 0 0 15px var(--primary-glow); }
                .step-dot.completed { background: var(--success); border-color: var(--success); color: white; }
                
                .onboarding-card {
                    background: var(--card-bg);
                    border: 1px solid var(--border);
                    border-radius: 20px;
                    padding: 2rem;
                    animation: fadeIn 0.5s ease;
                }
                .signature-box {
                    background: rgba(255,255,255,0.05);
                    border: 1px dashed var(--border);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-top: 1.5rem;
                }
                .signature-input {
                    background: transparent;
                    border: none;
                    border-bottom: 2px solid var(--primary);
                    color: white;
                    font-family: 'Outfit', sans-serif;
                    font-size: 1.25rem;
                    width: 100%;
                    outline: none;
                    padding: 0.5rem 0;
                    font-style: italic;
                }
            `}</style>

            <div className="stepper-header mb-4">
                {steps.map((s, idx) => (
                    <div key={idx} className={`step-dot ${idx === currentStep ? 'active' : idx < currentStep ? 'completed' : ''}`}>
                        {idx < currentStep ? <i className="fa-solid fa-check"></i> : idx + 1}
                    </div>
                ))}
            </div>

            <div className="onboarding-card shadow-lg">
                <span className="badge bg-primary-light text-primary mb-3 px-3 py-2 rounded-pill fw-bold">
                    STEP {currentStep + 1}: {currentMaterial?.type?.toUpperCase()}
                </span>
                <h3 className="fw-bold mb-2">{currentMaterial?.title}</h3>
                <p className="text-muted mb-4">{currentMaterial?.description}</p>

                {currentMaterial?.custom_html && (
                    <div className="custom-onboarding-content mb-4 p-4 rounded-4 bg-white text-dark shadow-sm border border-primary border-opacity-25">
                        <h6 className="x-small text-primary fw-bold text-uppercase mb-3"><i className="fa-solid fa-wand-magic-sparkles me-2"></i> Custom Overview</h6>
                        <div dangerouslySetInnerHTML={{ __html: currentMaterial.custom_html }} />
                    </div>
                )}

                {currentMaterial?.type === 'Policy' && (
                    <div className="mb-4">
                        <div className="bg-light bg-opacity-10 p-4 rounded-4 mb-3">
                            <h6 className="fw-bold mb-3 d-flex align-items-center">
                                <i className="fa-solid fa-file-pdf text-danger me-2"></i> Document Preview
                            </h6>
                            {currentMaterial.file_path ? (
                                <div className="border rounded-4 overflow-hidden shadow-sm" style={{ height: '500px' }}>
                                    <iframe
                                        src={`${getFileURL(currentMaterial.file_path)}#toolbar=0`}
                                        width="100%"
                                        height="100%"
                                        title="Policy Document"
                                        style={{ border: 'none' }}
                                    ></iframe>
                                </div>
                            ) : (
                                <div className="p-5 text-center text-muted">
                                    <i className="fa-solid fa-file-circle-exclamation display-4 mb-2"></i>
                                    <div>No document linked to this policy.</div>
                                </div>
                            )}
                            <div className="mt-3 text-end">
                                <a href={`${getFileURL(currentMaterial.file_path)}`} target="_blank" rel="noopener noreferrer" className="x-small text-decoration-none">
                                    <i className="fa-solid fa-up-right-from-square me-1"></i> Open in New Tab
                                </a>
                            </div>
                        </div>

                        <div className="signature-box">
                            <label className="x-small text-muted fw-bold text-uppercase mb-2 d-block">Digital Signature</label>
                            <p className="x-small text-muted-opacity-50 mb-3">Please type your full name exactly as it appears on your ID to acknowledge this policy.</p>
                            <input
                                type="text"
                                className="signature-input"
                                placeholder="Type your full name..."
                                value={signature}
                                onChange={(e) => setSignature(e.target.value)}
                            />
                            <div className="mt-3 x-small text-muted">
                                <i className="fa-solid fa-info-circle me-1"></i> By signing, you acknowledge and agree to the terms. IP: 192.168.1.1 (Logged)
                            </div>
                        </div>
                    </div>
                )}

                {currentMaterial?.type === 'Software' && (
                    <div className="mb-4">
                        <div className="bg-light bg-opacity-10 p-4 rounded-4 mb-3 border border-primary border-opacity-25">
                            <h6 className="fw-bold mb-3 d-flex align-items-center">
                                <i className="fa-solid fa-laptop-code text-primary me-2"></i> Required Software Installation
                            </h6>
                            <p className="small text-muted mb-4">Please download and install the following applications on your workstation as part of your setup.</p>

                            <div className="row g-3">
                                {currentMaterial.software_urls?.map((sw, idx) => (
                                    <div key={idx} className="col-md-6">
                                        <a
                                            href={sw.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="d-flex align-items-center p-3 rounded-4 bg-white text-decoration-none border shadow-sm transition-all hover-translate-y"
                                        >
                                            <div className="bg-primary-light text-primary rounded-circle p-2 me-3">
                                                <i className="fa-solid fa-download"></i>
                                            </div>
                                            <div className="overflow-hidden">
                                                <div className="fw-bold text-dark text-truncate">{sw.label || 'Download Link'}</div>
                                                <div className="extra-small text-muted text-truncate">{sw.url}</div>
                                            </div>
                                        </a>
                                    </div>
                                ))}
                                {(!currentMaterial.software_urls || currentMaterial.software_urls.length === 0) && (
                                    <div className="col-12 text-center py-4 text-muted small">No installation links provided for this step.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {currentMaterial?.type === 'Training' && (
                    <div className="mb-4">
                        <div className="bg-light bg-opacity-10 p-4 rounded-4 mb-3">
                            <h6 className="fw-bold mb-3 d-flex align-items-center text-info">
                                <i className="fa-solid fa-graduation-cap me-2"></i> Training Materials
                            </h6>

                            {/* Main URL (Video or Resource) */}
                            {currentMaterial.url && (
                                <div className="ratio ratio-16x9 bg-black rounded-4 overflow-hidden mb-4 shadow-lg">
                                    <iframe src={currentMaterial.url} title="Training Video" allowFullScreen></iframe>
                                </div>
                            )}

                            {/* Additional Resources */}
                            <div className="row g-2 mb-4">
                                {currentMaterial.training_resources?.map((res, idx) => (
                                    <div key={idx} className="col-md-6">
                                        <a
                                            href={res.resource_type === 'file' ? `${getFileURL(res.value)}` : res.value}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-light w-100 text-start p-3 rounded-3 border-0 shadow-sm d-flex align-items-center"
                                        >
                                            <i className={`fa-solid ${res.resource_type === 'file' ? 'fa-file-pdf text-danger' : 'fa-link text-primary'} fs-4 me-3`}></i>
                                            <div className="overflow-hidden">
                                                <div className="fw-bold small text-dark d-block text-truncate">{res.label || 'Resource'}</div>
                                                <div className="extra-small text-muted text-truncate">{res.resource_type === 'file' ? 'View Document' : 'Open Link'}</div>
                                            </div>
                                        </a>
                                    </div>
                                ))}
                            </div>

                            <div className="signature-box mt-4 border-info border-opacity-50">
                                <label className="x-small text-muted fw-bold text-uppercase mb-2 d-block">Training Confirmation</label>
                                <p className="x-small text-muted mb-3 fw-medium">
                                    <i className="fa-solid fa-certificate me-1 text-info"></i>
                                    I confirm that I have completed the training and confirm that all of the information and files I have provided are correct.
                                </p>
                                <input
                                    type="text"
                                    className="signature-input border-info"
                                    placeholder="Type your full name to confirm..."
                                    value={signature}
                                    onChange={(e) => setSignature(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {currentMaterial?.type === 'Document' && (
                    <div className="mb-4">
                        <div className="bg-light bg-opacity-10 p-4 rounded-4 border border-dashed border-primary">
                            <div className="text-center mb-4">
                                <i className="fa-solid fa-cloud-arrow-up fs-1 text-primary mb-3"></i>
                                <h5 className="fw-bold">{currentMaterial.form_fields?.length > 0 ? 'Information Collection' : 'Upload Required'}</h5>
                                <p className="small text-muted">{currentMaterial.description || 'Please provide the requested information below.'}</p>
                            </div>

                            {progress.find(p => p.content_id === currentMaterial._id && (p.status === 'Completed' || p.form_data)) ? (
                                <div className="p-3 bg-success bg-opacity-10 rounded-3 text-success small fw-bold mb-4 text-center">
                                    <i className="fa-solid fa-circle-check me-2"></i> Information Submitted Successfully
                                </div>
                            ) : (
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.target);
                                    formData.append('content_id', currentMaterial._id);
                                    setUploading(true);
                                    try {
                                        await api.post('/portal/onboarding/submit-form', formData, {
                                            headers: { 'Content-Type': 'multipart/form-data' }
                                        });
                                        alert('Information submitted');
                                        fetchData();
                                    } catch (err) {
                                        alert('Submission failed: ' + (err.response?.data?.message || err.message));
                                    } finally {
                                        setUploading(false);
                                    }
                                }}>
                                    <div className="row g-3">
                                        {(currentMaterial.form_fields || []).map((field, idx) => (
                                            <div key={idx} className={field.field_type === 'file' ? 'col-12' : 'col-md-6'}>
                                                <label className="form-label x-small fw-bold text-uppercase text-muted">{field.label} {field.required && <span className="text-danger">*</span>}</label>

                                                {field.field_type === 'select' ? (
                                                    <select className="form-select bg-dark border-secondary text-white shadow-none" name={field.label} required={field.required}>
                                                        <option value="">Select Option</option>
                                                        {field.options.map((opt, oIdx) => <option key={oIdx} value={opt}>{opt}</option>)}
                                                    </select>
                                                ) : field.field_type === 'file' ? (
                                                    <div className="p-3 bg-dark bg-opacity-50 rounded-3 border border-secondary text-center">
                                                        <input type="file" className="form-control form-control-sm bg-transparent border-0 text-white" name={field.label} required={field.required} />
                                                        <div className="extra-small text-muted mt-1">Upload JPEG, PNG or PDF</div>
                                                    </div>
                                                ) : (
                                                    <input
                                                        type={field.field_type}
                                                        className="form-control bg-dark border-secondary text-white shadow-none"
                                                        name={field.label}
                                                        required={field.required}
                                                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {!currentMaterial.form_fields || currentMaterial.form_fields.length === 0 ? (
                                        <div className="mt-3 text-center">
                                            <input type="file" className="form-control form-control-sm bg-transparent border-secondary mb-2" onChange={(e) => handleUpload(e, currentMaterial._id)} disabled={uploading} />
                                            {uploading && <div className="x-small text-primary fw-bold">Uploading...</div>}
                                        </div>
                                    ) : (
                                        <div className="mt-4 text-center">
                                            <button type="submit" className="btn btn-primary rounded-pill px-5 fw-bold" disabled={uploading}>
                                                {uploading ? 'SUBMITTING...' : 'SUBMIT INFORMATION'}
                                            </button>
                                        </div>
                                    )}
                                </form>
                            )}
                        </div>
                    </div>
                )}

                {currentMaterial?.type === 'Finish' && (
                    <div className="text-center py-4">
                        <div className="mb-4">
                            <i className="fa-solid fa-circle-check text-success display-1"></i>
                        </div>
                        <h4 className="fw-bold">Almost There!</h4>
                        <p className="text-muted">Once you click finish, your account will be activated and you'll gain access to the full portal features.</p>

                        <div className="bg-info bg-opacity-10 p-4 rounded-4 text-start mb-4">
                            <h6 className="fw-bold small mb-2">Completion Summary</h6>
                            <p className="extra-small text-muted mb-0">You have completed all mandatory onboarding steps. Our HR team will review your submissions and signatures shortly.</p>
                        </div>
                    </div>
                )}

                <div className="d-flex justify-content-between mt-4">
                    <button
                        className="btn btn-link text-muted text-decoration-none"
                        onClick={() => {
                            setSignature('');
                            setCurrentStep(Math.max(0, currentStep - 1));
                        }}
                        disabled={currentStep === 0}
                    >
                        Previous
                    </button>

                    {currentMaterial?.type === 'Finish' ? (
                        <button className="btn btn-success fw-bold rounded-pill px-5 py-3 shadow" onClick={onComplete}>
                            COMPLETE ONBOARDING <i className="fa-solid fa-flag-checkered ms-2"></i>
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary fw-bold rounded-pill px-5 py-3 shadow"
                            disabled={
                                (currentMaterial?.type === 'Policy' && !signature) ||
                                (currentMaterial?.type === 'Training' && !signature) ||
                                (currentMaterial?.type === 'Document' && !progress.find(p => p.content_id === currentMaterial._id && (p.status === 'Completed' || p.form_data))) ||
                                uploading
                            }
                            onClick={async () => {
                                const actionStatus = (currentMaterial.type === 'Policy' || currentMaterial.type === 'Training') ? 'Acknowledged' : 'Completed';
                                await handleAction(currentMaterial, actionStatus);
                                setSignature(''); // Reset for next step
                            }}
                        >
                            Mark as Done <i className="fa-solid fa-arrow-right ms-2"></i>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OnboardingStepper;
