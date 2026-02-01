import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/axios';
import { ViewAttachmentModal } from '../components/Modals';

const AccountStatement = () => {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedAttachment, setSelectedAttachment] = useState(null);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        currency: 'all' // 'all', 'BDT', 'USD'
    });
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });

    const [downloading, setDownloading] = useState(false);

    const fetchStatement = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const res = await api.get(`/transactions/account/${id}?${params.toString()}`);
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatement();
    }, [id]);

    const handleDownload = async () => {
        if (downloading) return;
        setDownloading(true);
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const res = await api.get(`/transactions/account/${id}/download?${params.toString()}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Statement_${data?.account?.code || 'Account'}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert('Error downloading statement');
        } finally {
            setDownloading(false);
        }
    };

    if (loading && !data) return (
        <Layout title="Account Statement">
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status"></div>
            </div>
        </Layout>
    );

    if (!data) return (
        <Layout title="Account Statement">
            <div className="alert alert-danger">Account not found</div>
        </Layout>
    );

    const { account, statement } = data;

    // Filter and sort statement
    const filteredStatement = statement.filter(txn => {
        if (filters.currency === 'all') return true;
        return txn.currency === filters.currency;
    });

    const sortedStatement = [...filteredStatement].sort((a, b) => {
        let valA, valB;

        if (sortConfig.key === 'trx_id') {
            valA = a.trx_id || '';
            valB = b.trx_id || '';
        } else if (sortConfig.key === 'date') {
            valA = new Date(a.date).getTime();
            valB = new Date(b.date).getTime();
        } else if (sortConfig.key === 'amount') {
            valA = a.amount || 0;
            valB = b.amount || 0;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <i className="fa-solid fa-sort text-muted ms-1 small opacity-50"></i>;
        return sortConfig.direction === 'asc'
            ? <i className="fa-solid fa-sort-up text-primary ms-1 small"></i>
            : <i className="fa-solid fa-sort-down text-primary ms-1 small"></i>;
    };

    return (
        <Layout
            title={`Statement: ${account.name}`}
            actions={
                <div className="d-flex gap-2">
                    <button className="btn btn-outline-primary" onClick={handleDownload} disabled={downloading}>
                        {downloading ? (
                            <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Downloading...</>
                        ) : (
                            <><i className="fa-solid fa-download me-1"></i> Download Excel</>
                        )}
                    </button>
                    <Link to="/" className="btn btn-outline-dark">
                        <i className="fa-solid fa-arrow-left me-1"></i> Dashboard
                    </Link>
                </div>
            }
        >
            {/* Summary & Filters */}
            <div className="row g-4 mb-4">
                <div className="col-lg-8">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body p-4">
                            <h6 className="text-muted small fw-bold text-uppercase mb-3">Filter Details</h6>
                            <div className="row g-3 align-items-end mb-3">
                                <div className="col-md-4">
                                    <label className="form-label small fw-bold">Start Date</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={filters.startDate}
                                        onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                                    />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label small fw-bold">End Date</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={filters.endDate}
                                        onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                                    />
                                </div>
                                <div className="col-md-4">
                                    <button className="btn btn-dark w-100" onClick={fetchStatement}>
                                        <i className="fa-solid fa-filter me-1"></i> Apply Filter
                                    </button>
                                </div>
                            </div>

                            {/* Currency Filter Tabs */}
                            <div className="border-top pt-3">
                                <label className="form-label small fw-bold mb-2">Currency Filter</label>
                                <div className="btn-group w-100" role="group">
                                    <button
                                        className={`btn ${filters.currency === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setFilters({ ...filters, currency: 'all' })}
                                    >
                                        <i className="fa-solid fa-globe me-1"></i> All
                                    </button>
                                    <button
                                        className={`btn ${filters.currency === 'BDT' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setFilters({ ...filters, currency: 'BDT' })}
                                    >
                                        <i className="fa-solid fa-bangladeshi-taka-sign me-1"></i> BDT
                                    </button>
                                    <button
                                        className={`btn ${filters.currency === 'USD' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setFilters({ ...filters, currency: 'USD' })}
                                    >
                                        <i className="fa-solid fa-dollar-sign me-1"></i> USD
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm h-100 bg-primary bg-opacity-10">
                        <div className="card-body p-4 d-flex flex-column justify-content-center">
                            <div className="text-primary small fw-bold text-uppercase mb-1">Current Balance</div>
                            <div className="h3 fw-bold text-primary mb-0">
                                {Number(account.current_balance_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })} BDT
                            </div>
                            <div className="text-muted small mt-1">
                                ${Number(account.current_balance_usd).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                    <table className="table align-middle mb-0">
                        <thead>
                            <tr>
                                <th className="cursor-pointer" onClick={() => handleSort('trx_id')}>
                                    TRX ID {getSortIcon('trx_id')}
                                </th>
                                <th className="cursor-pointer" onClick={() => handleSort('date')}>
                                    Date {getSortIcon('date')}
                                </th>
                                <th>Description</th>
                                <th className="text-end cursor-pointer" onClick={() => handleSort('amount')}>
                                    Debit {getSortIcon('amount')}
                                </th>
                                <th className="text-end cursor-pointer" onClick={() => handleSort('amount')}>
                                    Credit {getSortIcon('amount')}
                                </th>
                                <th className="text-end">Balance (BDT)</th>
                                <th className="text-end">Balance (USD)</th>
                                <th className="text-center">Doc</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="text-muted">-</td>
                                <td className="text-muted">Opening</td>
                                <td className="text-muted italic">Period Beginning Balance</td>
                                <td className="text-end">-</td>
                                <td className="text-end">-</td>
                                <td className="text-end fw-bold text-dark">
                                    {(data.periodOpeningBdt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="text-end fw-bold text-dark">
                                    ${(data.periodOpeningUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="text-center">-</td>
                            </tr>
                            {sortedStatement.map((txn) => (
                                <tr key={txn.id}>
                                    <td>
                                        <span className="badge bg-primary-light text-primary border px-2 py-1 fw-bold" style={{ fontSize: '0.7rem' }}>{txn.trx_id || 'N/A'}</span>
                                    </td>
                                    <td className="text-nowrap">{new Date(txn.date).toLocaleDateString()}</td>
                                    <td>
                                        <div className="fw-bold">{txn.description}</div>
                                        {txn.currency !== 'BDT' && (
                                            <div className="small text-muted">
                                                {txn.amount} {txn.currency} @ {txn.conversion_rate}
                                            </div>
                                        )}
                                    </td>
                                    <td className="text-end text-danger fw-medium">
                                        {txn.type === 'Debit' ? txn.converted_amount_bdt || txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                    </td>
                                    <td className="text-end text-success fw-medium">
                                        {txn.type === 'Credit' ? txn.converted_amount_bdt || txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                    </td>
                                    <td className="text-end fw-bold text-main">
                                        {txn.runningBdt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="text-end fw-bold text-main">
                                        ${txn.runningUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="text-center">
                                        {txn.attachments?.length > 0 && (
                                            <button
                                                className="btn btn-sm btn-primary rounded-circle shadow-sm"
                                                onClick={() => setSelectedAttachment(txn)}
                                                title="View Attachment"
                                            >
                                                <i className="fa-solid fa-paperclip"></i>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedAttachment && (
                <ViewAttachmentModal
                    item={selectedAttachment}
                    onClose={() => setSelectedAttachment(null)}
                />
            )}
        </Layout>
    );
};

export default AccountStatement;
