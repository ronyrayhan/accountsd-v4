import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

export const ViewAttachmentModal = ({ item, onClose }) => {
    const [blobUrl, setBlobUrl] = useState(null);
    const [isPdf, setIsPdf] = useState(false);

    useEffect(() => {
        if (!item) return;
        const attachment = item.attachments?.[0];
        if (!attachment) return;

        const fetchFile = async () => {
            try {
                const response = await api.get(`/files/${attachment.filename}`, {
                    responseType: 'blob'
                });
                const contentType = response.headers['content-type'];
                const url = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));
                setBlobUrl(url);
                setIsPdf(attachment.filename.toLowerCase().endsWith('.pdf'));
            } catch (err) {
                console.error('Error fetching file:', err);
            }
        };

        fetchFile();

        return () => {
            if (blobUrl) window.URL.revokeObjectURL(blobUrl);
        };
    }, [item]);

    if (!item) return null;
    const attachment = item.attachments?.[0];
    if (!attachment) return null;

    // Logic to unify Bill vs Transaction data display
    const isBill = !!item.company_name;
    const displayName = isBill ? item.company_name : (item.account?.name || 'Unknown');
    const displayCode = isBill ? `#${item.id}` : (item.account?.code || `#${item.id}`);
    const date = new Date(item.date || item.invoice_date || item.due_date);

    return (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 1055, backdropFilter: 'blur(8px)' }} tabIndex="-1">
            <div className="modal-dialog modal-xl modal-dialog-centered">
                <div className="modal-content border-0 shadow-lg overflow-hidden" style={{ borderRadius: '24px' }}>
                    <div className="row g-0" style={{ minHeight: '80vh' }}>
                        {/* Left Side: Dynamic Details Pane */}
                        <div className="col-lg-4 bg-white p-5 border-end d-flex flex-column">
                            <div className="p-4 rounded-4" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <h4 className="fw-bold mb-4 text-dark" style={{ letterSpacing: '-0.5px' }}>Document Details</h4>

                                <div className="mb-4">
                                    <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>System Ref</label>
                                    <div className="h5 fw-bold text-primary mb-0">{item.serial_number || item.trx_id || `#${item.id}`}</div>
                                </div>

                                <div className="mb-4">
                                    <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Account/Payee</label>
                                    <div className="fw-bold text-dark">{displayName}</div>
                                </div>

                                <div className="mb-4">
                                    <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Code</label>
                                    <div className="fw-bold text-dark">{displayCode}</div>
                                </div>

                                <div className="mb-4">
                                    <div className="row g-3">
                                        <div className="col-6">
                                            <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Date</label>
                                            <div className="fw-bold text-dark">{date.toLocaleDateString()}</div>
                                        </div>
                                        <div className="col-6">
                                            <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Time</label>
                                            <div className="fw-bold text-dark">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Description</label>
                                    <div className="text-muted small" style={{ lineHeight: '1.5' }}>{item.description}</div>
                                </div>

                                <div className="mt-5 pt-3 border-top">
                                    <label className="text-muted small fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem' }}>Total Amount</label>
                                    <div className="h3 fw-bold text-dark mb-0">
                                        {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-primary fs-5">{item.currency}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-auto text-center">
                                <span className="badge bg-light text-muted border px-3 py-2 rounded-pill x-small">
                                    Secure Verification: {new Date().toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        {/* Right Side: Attachment Preview Pane */}
                        <div className="col-lg-8 bg-light d-flex flex-column" style={{ backgroundColor: '#f1f5f9' }}>
                            <div className="modal-header border-0 bg-white px-4 py-3 shadow-sm d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="bg-primary bg-opacity-10 p-2 rounded-circle text-primary d-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }}>
                                        <i className="fa-solid fa-file-shield"></i>
                                    </div>
                                    <div>
                                        <div className="fw-bold text-dark small">Protected Attachment: {attachment.filename}</div>
                                        <div className="text-muted x-small">End-to-End Encrypted Preview</div>
                                    </div>
                                </div>
                                <button type="button" className="btn-close shadow-none" onClick={onClose}></button>
                            </div>

                            <div className="flex-fill d-flex justify-content-center align-items-center p-4">
                                {!blobUrl ? (
                                    <div className="text-center">
                                        <div className="spinner-border text-primary mb-2"></div>
                                        <div className="text-muted small fw-bold">Authorizing...</div>
                                    </div>
                                ) : isPdf ? (
                                    <div className="w-100 h-100 bg-white rounded-4 shadow-sm overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                                        <iframe src={blobUrl} className="w-100 h-100" style={{ border: 'none' }} title="Document Viewer"></iframe>
                                    </div>
                                ) : (
                                    <div className="p-2 bg-white rounded-4 shadow-sm border">
                                        <img src={blobUrl} alt="Attachment" className="img-fluid rounded-3" style={{ maxHeight: '65vh', maxWidth: '100%', objectFit: 'contain' }} />
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer border-0 bg-white px-4 py-3 gap-2 shadow-sm mt-auto">
                                {blobUrl && (
                                    <a href={blobUrl} download={attachment.filename} className="btn btn-primary px-4 py-2 fw-bold shadow-sm rounded-3">
                                        <i className="fa-solid fa-download me-2"></i> Download Securely
                                    </a>
                                )}
                                <button type="button" className="btn btn-outline-secondary px-4 py-2 fw-bold rounded-3" onClick={onClose}>Close Preview</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
