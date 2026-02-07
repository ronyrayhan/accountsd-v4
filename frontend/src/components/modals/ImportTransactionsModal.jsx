import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

export const ImportTransactionsModal = ({ onImported }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);

    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/transactions/template', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'transaction_template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Download error detail:', err);
            alert('Error downloading template: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handlePreview = async (e) => {
        e.preventDefault();
        if (!file) return;

        setLoading(true);
        setValidationErrors([]);
        const data = new FormData();
        data.append('file', file);

        try {
            const res = await api.post('/transactions/preview', data);
            setPreviewData(res.data);
        } catch (err) {
            if (err.response?.data?.errors) {
                setValidationErrors(err.response.data.errors);
            } else {
                alert(err.response?.data?.detail || 'Error previewing data');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFinalSubmit = async () => {
        setLoading(true);
        const data = new FormData();
        data.append('file', file);

        try {
            await api.post('/transactions/import', data);
            alert('Import successful!');
            onImported();
            document.querySelector('#importModal .btn-close')?.click();
            resetModal();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error importing transactions');
        } finally {
            setLoading(false);
        }
    };

    const resetModal = () => {
        setFile(null);
        setPreviewData(null);
        setValidationErrors([]);
        setLoading(false);
    };

    return (
        <div className="modal fade" id="importModal" tabIndex="-1">
            <div className="modal-dialog modal-lg">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">Bulk Import Transactions</h5>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" onClick={resetModal}></button>
                    </div>
                    <div className="modal-body p-4">
                        {!previewData ? (
                            <>
                                <div className="alert alert-info py-3 border-0 bg-primary bg-opacity-10 text-primary mb-4">
                                    <i className="fa-solid fa-circle-info me-2"></i>
                                    Download our official Excel template to ensure data compatibility.
                                </div>

                                {validationErrors.length > 0 && (
                                    <div className="alert alert-danger mb-4">
                                        <div className="d-flex align-items-center gap-2 mb-2">
                                            <i className="fa-solid fa-triangle-exclamation"></i>
                                            <div className="fw-bold">Validation Failed</div>
                                        </div>
                                        <ul className="mb-0 small ps-3">
                                            {validationErrors.map((error, idx) => (
                                                <li key={idx}>{error}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="mb-4">
                                    <button className="btn btn-outline-primary w-100 py-3 d-flex align-items-center justify-content-center gap-2" onClick={handleDownloadTemplate}>
                                        <i className="fa-solid fa-file-excel fs-5"></i>
                                        Download template.xlsx
                                    </button>
                                </div>

                                <form onSubmit={handlePreview}>
                                    <div className="mb-4">
                                        <label className="form-label text-muted small fw-bold text-uppercase ls-1">Select Excel File</label>
                                        <input type="file" className="form-control py-2" onChange={e => setFile(e.target.files[0])} accept=".xlsx" required />
                                    </div>

                                    <button type="submit" className="btn btn-primary w-100 py-3" disabled={loading}>
                                        {loading ? (
                                            <><span className="spinner-border spinner-border-sm me-2"></span>Analyzing File...</>
                                        ) : (
                                            <><i className="fa-solid fa-magnifying-glass me-2"></i>Preview Import Impact</>
                                        )}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div>
                                <h6 className="fw-bold mb-3 text-uppercase small text-muted">Import Impact Summary</h6>
                                <div className="table-responsive rounded-3 border mb-4">
                                    <table className="table table-sm align-middle mb-0">
                                        <thead className="bg-light">
                                            <tr>
                                                <th className="ps-3 py-2">Account</th>
                                                <th className="py-2 text-center">Entries</th>
                                                <th className="py-2 text-end">Current (BDT/USD)</th>
                                                <th className="py-2 text-end">Net Change</th>
                                                <th className="pe-3 py-2 text-end text-primary">Target Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.map(item => (
                                                <tr key={item.code}>
                                                    <td className="ps-3 py-3">
                                                        <div className="fw-bold">{item.name}</div>
                                                        <div className="small text-muted">{item.code}</div>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="badge bg-secondary bg-opacity-10 text-dark border">{item.count}</span>
                                                    </td>
                                                    <td className="text-end small">
                                                        <div>{item.currentBdt.toLocaleString()} BDT</div>
                                                        <div>${item.currentUsd.toLocaleString()} USD</div>
                                                    </td>
                                                    <td className={`text-end small fw-bold ${item.netBdt < 0 || item.netUsd < 0 ? 'text-danger' : 'text-success'}`}>
                                                        <div>{item.netBdt > 0 ? '+' : ''}{item.netBdt.toLocaleString()}</div>
                                                        <div>{item.netUsd > 0 ? '+' : ''}${item.netUsd.toLocaleString()}</div>
                                                    </td>
                                                    <td className="pe-3 text-end fw-bold text-primary">
                                                        <div>{item.projectedBdt.toLocaleString()} BDT</div>
                                                        <div>${item.projectedUsd.toLocaleString()} USD</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="d-flex gap-3">
                                    <button className="btn btn-outline-dark flex-grow-1 py-3" onClick={() => setPreviewData(null)} disabled={loading}>
                                        Cancel & Reselect
                                    </button>
                                    <button className="btn btn-primary flex-grow-1 py-3" onClick={handleFinalSubmit} disabled={loading}>
                                        {loading ? (
                                            <><span className="spinner-border spinner-border-sm me-2"></span>Processing...</>
                                        ) : (
                                            <><i className="fa-solid fa-check-double me-2"></i>Confirm & Write to Database</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
