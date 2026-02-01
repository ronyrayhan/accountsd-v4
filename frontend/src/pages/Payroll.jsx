import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const Payroll = () => {
    const [employees, setEmployees] = useState([]);
    const [increments, setIncrements] = useState([]);
    const [payrollRecords, setPayrollRecords] = useState([]);
    const [selectedArchiveMonth, setSelectedArchiveMonth] = useState(new Date().toISOString().substr(0, 7));
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('monthly');

    // Modals state
    const [showEmpModal, setShowEmpModal] = useState(false);
    const [showIncModal, setShowIncModal] = useState(false);
    const [showEditRecordModal, setShowEditRecordModal] = useState(false);
    const [viewingPayslip, setViewingPayslip] = useState(null);
    const [editRecordForm, setEditRecordForm] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);

    // Form states
    const [empForm, setEmpForm] = useState({
        emp_id: '', name: '', department: '', designation: '',
        joining_date: '', employment_type: 'Full-time', base_salary: 0, status: 'Active'
    });
    const [incForm, setIncForm] = useState({
        employee_id: '', increment_type: 'Annual', amount: 0,
        effective_date: '', approved_date: new Date().toISOString().split('T')[0], remarks: ''
    });

    // Payroll Run Inputs
    const [salaryMonth, setSalaryMonth] = useState(new Date().toISOString().substr(0, 7));
    const [computedPayroll, setComputedPayroll] = useState([]);
    const [inputValues, setInputValues] = useState({}); // Stores Transport, Other, Bonus, Days per employee

    const fetchData = async () => {
        setLoading(true);
        try {
            const [empRes, incRes, recordRes] = await Promise.all([
                api.get('/payroll/employees'),
                api.get('/payroll/increments'),
                api.get('/payroll/records')
            ]);
            setEmployees(empRes.data);
            setIncrements(incRes.data);
            setPayrollRecords(recordRes.data);
        } catch (err) {
            console.error('Error loading payroll data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getDaysInMonth = (monthStr) => {
        const [year, month] = monthStr.split('-').map(Number);
        return new Date(year, month, 0).getDate();
    };

    const runCalculation = async () => {
        setLoading(true);
        try {
            const results = [];
            const newInputValues = { ...inputValues };
            const daysInMonth = getDaysInMonth(salaryMonth);

            for (const emp of employees.filter(e => e.status !== 'Exit')) {
                const res = await api.get(`/payroll/calculate?employee_id=${emp.id}&month=${salaryMonth}`);
                results.push({ ...res.data, employee: emp });

                if (!newInputValues[emp.id]) {
                    newInputValues[emp.id] = {
                        transport: 0, other: 0, bonus: 0, days: daysInMonth, advance: 0, remarks: ''
                    };
                } else {
                    // Update days if month changed
                    newInputValues[emp.id].days = daysInMonth;
                }
            }
            setComputedPayroll(results);
            setInputValues(newInputValues);
        } catch (err) {
            console.error('Calculation error', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (empId, field, value) => {
        setInputValues(prev => ({
            ...prev,
            [empId]: { ...prev[empId], [field]: value }
        }));
    };

    const calculateTotal = (row) => {
        const inputs = inputValues[row.employee_id] || { transport: 0, other: 0, bonus: 0, advance: 0 };
        return Number(row.base_salary) + Number(row.total_increments) + Number(inputs.transport) + Number(inputs.other) + Number(inputs.bonus) - Number(inputs.advance);
    };

    const exportToExcel = () => {
        const data = computedPayroll.map((row, idx) => {
            const iv = inputValues[row.employee_id] || {};
            return {
                "Sl.": idx + 1,
                "Employee Name": row.employee?.name,
                "Basic Salary": Number(row.base_salary),
                "Transport": Number(iv.transport || 0),
                "Other Allowance": Number(iv.other || 0),
                "Bonus": Number(iv.bonus || 0),
                "Current Increment": Number(row.total_increments),
                "Working Days": iv.days,
                "Advance Salary": Number(iv.advance || 0),
                "Net Payable": calculateTotal(row),
                "Remarks": iv.remarks
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Salary Sheet");
        XLSX.writeFile(workbook, `Salary_Sheet_${salaryMonth}.xlsx`);
    };

    // Helper to convert number to words (Simple version)
    const numberToWords = (num) => {
        if (num === 0) return 'Zero Taka Only';

        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
            'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        const convert = (n) => {
            if (n < 20) return ones[n];
            if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
            if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
            if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
            if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
            return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
        };

        const amount = Math.floor(num);
        return convert(amount).trim() + ' Taka Only';
    };

    const handleUpdateRecord = async (e) => {
        e.preventDefault();
        try {
            // Recalculate net salary before saving
            const base = Number(editRecordForm.base_salary_snapshot) || 0;
            const inc = Number(editRecordForm.total_increments_snapshot) || 0;
            const transport = Number(editRecordForm.transport_allowance) || 0;
            const other = Number(editRecordForm.other_allowance) || 0;
            const bonus = Number(editRecordForm.bonus) || 0;
            const advance = Number(editRecordForm.advance_salary) || 0;

            const net = (base + inc + transport + other + bonus) - advance;

            await api.put(`/payroll/records/${editRecordForm.id}`, {
                ...editRecordForm,
                net_salary: net
            });
            setShowEditRecordModal(false);
            fetchData();
            setErrorMsg(null);
            alert('Record updated successfully');
        } catch (err) {
            setErrorMsg(err.response?.data?.detail || 'Failed to update record');
        }
    };

    const exportArchiveToExcel = async () => {
        const filtered = payrollRecords.filter(r => r.month === selectedArchiveMonth);
        if (filtered.length === 0) return alert('No data to export');

        const monthName = new Date(selectedArchiveMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
        const nextMonth = new Date(new Date(selectedArchiveMonth).setMonth(new Date(selectedArchiveMonth).getMonth() + 1)).toLocaleString('default', { month: 'long', year: 'numeric' });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Salary Sheet');

        // Set column widths
        worksheet.columns = [
            { width: 5 },  // Sl.
            { width: 25 }, // Name
            { width: 12 }, // Basic
            { width: 10 }, // Transport
            { width: 10 }, // Other
            { width: 10 }, // Bonus
            { width: 12 }, // Increment
            { width: 10 }, // Working Day
            { width: 12 }, // Advance Salary
            { width: 15 }, // Total Gross
            { width: 20 }  // Remarks
        ];

        // 1. Company Name
        worksheet.mergeCells('A1:K1');
        const companyCell = worksheet.getCell('A1');
        companyCell.value = 'Axiler Limited';
        companyCell.font = { name: 'Times New Roman', size: 14, bold: true };
        companyCell.alignment = { vertical: 'middle', horizontal: 'center' };

        // 2. Salary Sheet Title
        worksheet.mergeCells('A2:K2');
        const titleCell = worksheet.getCell('A2');
        titleCell.value = 'Salary Sheet';
        titleCell.font = { name: 'Times New Roman', size: 12, bold: true, underline: true };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        // 3. Month & Disbursement Info
        worksheet.mergeCells('A3:K3');
        const monthCell = worksheet.getCell('A3');
        monthCell.value = `For The Month Of ${monthName} Will be disbursed in ${nextMonth}`;
        monthCell.font = { name: 'Times New Roman', size: 10, bold: true };
        monthCell.alignment = { vertical: 'middle', horizontal: 'center' };
        monthCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
        monthCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        // 4. Headers Row 1
        const headerRow1 = ['Sl.', 'Name', 'Basic', 'Allowance', '', 'Bonus', 'Increment', 'Working Day', 'Advance Salary', 'Total Gross Salary (BDT)', 'Remarks'];
        worksheet.addRow(headerRow1);
        const hr1 = worksheet.getRow(4);
        hr1.font = { bold: true, size: 9 };
        hr1.alignment = { vertical: 'middle', horizontal: 'center' };

        // Header Row 2
        const headerRow2 = ['', '', '', 'Transport', 'Other', '', '', '', '', '', ''];
        worksheet.addRow(headerRow2);
        const hr2 = worksheet.getRow(5);
        hr2.font = { bold: true, size: 9 };
        hr2.alignment = { vertical: 'middle', horizontal: 'center' };

        // Merging Headers
        worksheet.mergeCells('A4:A5'); // Sl.
        worksheet.mergeCells('B4:B5'); // Name
        worksheet.mergeCells('C4:C5'); // Basic
        worksheet.mergeCells('D4:E4'); // Allowance group
        worksheet.mergeCells('F4:F5'); // Bonus
        worksheet.mergeCells('G4:G5'); // Increment
        worksheet.mergeCells('H4:H5'); // Working Day
        worksheet.mergeCells('I4:I5'); // Advance
        worksheet.mergeCells('J4:J5'); // Total Gross
        worksheet.mergeCells('K4:K5'); // Remarks

        // Apply borders to headers
        for (let r = 4; r <= 5; r++) {
            worksheet.getRow(r).eachCell((cell) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            });
        }

        // 5. Data Rows
        filtered.forEach((rec, idx) => {
            const dataRow = [
                idx + 1,
                rec.Employee?.name,
                Number(rec.base_salary_snapshot),
                Number(rec.transport_allowance || 0) || '',
                Number(rec.other_allowance || 0) || '',
                Number(rec.bonus || 0) || '',
                Number(rec.total_increments_snapshot || 0) || '',
                rec.paid_days,
                Number(rec.advance_salary || 0) || '',
                Number(rec.net_salary),
                rec.remarks
            ];
            const row = worksheet.addRow(dataRow);
            row.alignment = { vertical: 'middle' };
            row.eachCell((cell, colNumber) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                if (colNumber !== 2 && colNumber !== 11) {
                    cell.alignment = { horizontal: 'center' };
                }
                if (colNumber === 10) cell.font = { bold: true };
            });
        });

        // 6. Grand Total Row
        const grandTotal = filtered.reduce((acc, curr) => acc + Number(curr.net_salary), 0);
        worksheet.mergeCells(`A${worksheet.lastRow.number + 1}:I${worksheet.lastRow.number + 1}`);
        const lastRow = worksheet.lastRow;
        lastRow.getCell(1).value = 'Grand Total (BDT)';
        lastRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        lastRow.getCell(1).font = { bold: true };
        lastRow.getCell(10).value = grandTotal;
        lastRow.getCell(10).font = { bold: true };
        lastRow.getCell(10).alignment = { horizontal: 'center' };
        lastRow.eachCell((cell) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // 7. In Words
        worksheet.addRow([]);
        worksheet.mergeCells(`A${worksheet.lastRow.number + 1}:K${worksheet.lastRow.number + 1}`);
        const wordsRow = worksheet.lastRow;
        wordsRow.getCell(1).value = `In Words: ${numberToWords(grandTotal)}`;
        wordsRow.getCell(1).font = { name: 'Times New Roman', italic: true, bold: true };

        // Write to buffer and save
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Salary_Sheet_${selectedArchiveMonth}.xlsx`);
    };

    const handleSaveEmployee = async (e) => {
        e.preventDefault();
        try {
            if (empForm.id) {
                await api.put(`/payroll/employees/${empForm.id}`, empForm);
            } else {
                await api.post('/payroll/employees', empForm);
            }
            setShowEmpModal(false);
            setErrorMsg(null);
            fetchData();
        } catch (err) {
            setErrorMsg(err.response?.data?.detail || 'Failed to save employee');
        }
    };

    const handleSaveIncrement = async (e) => {
        e.preventDefault();
        try {
            if (incForm.id) {
                await api.put(`/payroll/increments/${incForm.id}`, incForm);
            } else {
                await api.post('/payroll/increments', incForm);
            }
            setShowIncModal(false);
            setErrorMsg(null);
            fetchData();
        } catch (err) {
            setErrorMsg(err.response?.data?.detail || 'Failed to save increment');
        }
    };

    const handleSavePayroll = async () => {
        if (!window.confirm(`Are you sure you want to finalize payroll for ${salaryMonth}?`)) return;

        try {
            setLoading(true);
            const promises = computedPayroll.map(row => {
                const iv = inputValues[row.employee_id] || {};
                const net = calculateTotal(row);
                const base = Number(row.base_salary) || 0;
                const inc = Number(row.total_increments) || 0;
                const safeNet = isNaN(net) ? (base + inc) : net;

                return api.post('/payroll/records', {
                    employee_id: row.employee_id,
                    month: salaryMonth,
                    paid_days: Number(iv.days) || 0,
                    working_days: Number(getDaysInMonth(salaryMonth)) || 30,
                    base_salary_snapshot: base,
                    total_increments_snapshot: inc,
                    transport_allowance: Number(iv.transport) || 0,
                    other_allowance: Number(iv.other) || 0,
                    bonus: Number(iv.bonus) || 0,
                    advance_salary: Number(iv.advance) || 0,
                    gross_salary: base + inc,
                    net_salary: safeNet,
                    remarks: iv.remarks || '',
                    status: 'Paid'
                });
            });
            await Promise.all(promises);
            alert('Monthly Payroll finalized and locked successfully!');
            fetchData();
            setActiveTab('records');
        } catch (err) {
            console.error('Error saving payroll', err);
            const msg = err.response?.data?.detail || err.response?.data?.errors?.join(', ') || 'Failed to save records';
            alert(`Error: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title="Payroll Strategy Center">
            <div className="card border-0 shadow-sm mb-4 no-print">
                <div className="card-body p-2 d-flex gap-2">
                    <button className={`btn flex-grow-1 ${activeTab === 'employees' ? 'btn-primary' : 'btn-light'}`} onClick={() => setActiveTab('employees')}>
                        <i className="fa-solid fa-users me-2"></i> Employees
                    </button>
                    <button className={`btn flex-grow-1 ${activeTab === 'monthly' ? 'btn-primary' : 'btn-light'}`} onClick={() => setActiveTab('monthly')}>
                        <i className="fa-solid fa-file-invoice-dollar me-2"></i> Salary Sheet
                    </button>
                    <button className={`btn flex-grow-1 ${activeTab === 'records' ? 'btn-primary' : 'btn-light'}`} onClick={() => setActiveTab('records')}>
                        <i className="fa-solid fa-box-archive me-2"></i> Finalized Records
                    </button>

                    <button className={`btn flex-grow-1 ${activeTab === 'increments' ? 'btn-primary' : 'btn-light'}`} onClick={() => setActiveTab('increments')}>
                        <i className="fa-solid fa-arrow-trend-up me-2"></i> Increments
                    </button>
                    <button className={`btn flex-grow-1 ${activeTab === 'reminders' ? 'btn-primary' : 'btn-light'}`} onClick={() => setActiveTab('reminders')}>
                        <i className="fa-solid fa-bell me-2"></i> Reminders
                    </button>
                </div>
            </div>

            {activeTab === 'monthly' && (
                <div className="no-print">
                    <div className="card border-0 shadow-lg mb-4 bg-primary text-white overflow-hidden">
                        <div className="card-body p-4 position-relative">
                            <div className="row align-items-center g-3">
                                <div className="col-md-4">
                                    <h4 className="fw-bold mb-1">Generate Monthly Payout</h4>
                                    <p className="small opacity-75 mb-0">Select month and review employee calculated figures.</p>
                                </div>
                                <div className="col-md-3">
                                    <input type="month" className="form-control form-control-lg border-0 shadow-sm" style={{ backgroundColor: 'rgba(255,255,255,0.9)' }} value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)} />
                                </div>
                                <div className="col-md-5 d-flex gap-2">
                                    <button className="btn btn-light btn-lg flex-grow-1 fw-bold text-primary shadow-sm" onClick={runCalculation}>
                                        <i className="fa-solid fa-bolt me-2"></i> Compute Sheet
                                    </button>
                                    {computedPayroll.length > 0 && (
                                        <button className="btn btn-warning btn-lg fw-bold shadow-sm" onClick={exportToExcel}>
                                            <i className="fa-solid fa-file-excel me-2"></i> Export Excel
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {computedPayroll.length > 0 && (
                        <div className="card border-0 shadow-sm overflow-hidden">
                            <div className="table-responsive">
                                <table className="table table-bordered align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                                    <thead className="bg-light text-center">
                                        <tr>
                                            <th>Sl</th>
                                            <th>Name</th>
                                            <th>Basic (Current)</th>
                                            <th style={{ width: '100px' }}>Transport</th>
                                            <th style={{ width: '100px' }}>Other Alw.</th>
                                            <th style={{ width: '100px' }}>Bonus</th>
                                            <th className="bg-success-subtle">Monthly Inc.</th>
                                            <th style={{ width: '70px' }}>Days</th>
                                            <th style={{ width: '100px' }} className="bg-warning-subtle">Advance</th>
                                            <th className="bg-primary text-white">Net Total</th>
                                            <th>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {computedPayroll.map((row, idx) => {
                                            const iv = inputValues[row.employee_id] || {};
                                            return (
                                                <tr key={row.employee_id}>
                                                    <td className="text-center">{idx + 1}</td>
                                                    <td className="fw-bold">{row.employee?.name}</td>
                                                    <td className="text-end fw-bold">{Number(row.base_salary).toLocaleString()}</td>
                                                    <td><input type="number" className="form-control form-control-sm border-0 bg-light text-end" value={iv.transport} onChange={e => handleInputChange(row.employee_id, 'transport', e.target.value)} /></td>
                                                    <td><input type="number" className="form-control form-control-sm border-0 bg-light text-end" value={iv.other} onChange={e => handleInputChange(row.employee_id, 'other', e.target.value)} /></td>
                                                    <td><input type="number" className="form-control form-control-sm border-0 bg-light text-end" value={iv.bonus} onChange={e => handleInputChange(row.employee_id, 'bonus', e.target.value)} /></td>
                                                    <td className="text-end text-success fw-bold">+{Number(row.total_increments).toLocaleString()}</td>
                                                    <td><input type="number" className="form-control form-control-sm border-0 bg-light text-center" value={iv.days} onChange={e => handleInputChange(row.employee_id, 'days', e.target.value)} /></td>
                                                    <td><input type="number" className="form-control form-control-sm border-0 bg-warning-subtle text-end" value={iv.advance} onChange={e => handleInputChange(row.employee_id, 'advance', e.target.value)} /></td>
                                                    <td className="text-end fw-bold text-primary bg-primary-subtle fs-6">{calculateTotal(row).toLocaleString()}</td>
                                                    <td><input type="text" className="form-control form-control-sm border-0 bg-light" value={iv.remarks} onChange={e => handleInputChange(row.employee_id, 'remarks', e.target.value)} /></td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="card-footer bg-white border-0 p-4 text-end">
                                <button className="btn btn-success btn-lg px-5 fw-bold shadow-sm" onClick={handleSavePayroll}>
                                    <i className="fa-solid fa-cloud-arrow-up me-2"></i> Finalize & Lock Monthly Payroll
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* PRINT VIEW (Same as your Excel sheet) */}
            <div id="salary-sheet-print" className="d-none d-print-block bg-white p-4" style={{ color: '#000', fontFamily: 'serif' }}>
                <div className="text-center mb-4">
                    <h3 className="fw-bold m-0" style={{ fontSize: '1.4rem' }}>Axiler Limited</h3>
                    <div className="text-uppercase fw-bold border-bottom d-inline-block px-4 mb-2 pb-1" style={{ fontSize: '1rem' }}>Salary Sheet</div>
                    <div className="d-flex justify-content-between px-2 small mt-2">
                        <span className="fw-bold">For The Month Of: {new Date(salaryMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                        <span className="fw-bold">Will be Disbursed in: {new Date(new Date(salaryMonth).setMonth(new Date(salaryMonth).getMonth() + 1)).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    </div>
                </div>

                <table className="table table-bordered border-dark w-100 mb-3" style={{ fontSize: '0.75rem' }}>
                    <thead className="text-center align-middle">
                        <tr style={{ backgroundColor: '#f2f2f2' }}>
                            <th style={{ width: '40px' }}>Sl.</th>
                            <th style={{ width: '180px' }}>Employee Name</th>
                            <th>Basic Salary</th>
                            <th>Transport</th>
                            <th>Other Alw.</th>
                            <th>Bonus</th>
                            <th>Increment</th>
                            <th>Days</th>
                            <th>Advance</th>
                            <th>Total Gross Payable</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {computedPayroll.map((row, idx) => {
                            const iv = inputValues[row.employee_id] || {};
                            return (
                                <tr key={row.employee_id}>
                                    <td className="text-center">{idx + 1}</td>
                                    <td className="ps-2 fw-bold">{row.employee?.name}</td>
                                    <td className="text-center">{Number(row.base_salary).toFixed(2)}</td>
                                    <td className="text-center">{Number(iv.transport || 0).toFixed(2)}</td>
                                    <td className="text-center">{Number(iv.other || 0).toFixed(2)}</td>
                                    <td className="text-center">{Number(iv.bonus || 0).toFixed(2)}</td>
                                    <td className="text-center text-success fw-bold">{Number(row.total_increments).toFixed(2)}</td>
                                    <td className="text-center">{iv.days}</td>
                                    <td className="text-center">{Number(iv.advance || 0).toFixed(2)}</td>
                                    <td className="text-center fw-bold text-primary">{calculateTotal(row).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td className="ps-2 small">{iv.remarks}</td>
                                </tr>
                            )
                        })}
                        <tr className="fw-bold" style={{ backgroundColor: '#f2f2f2' }}>
                            <td colSpan="9" className="text-center py-2">Grand Total (BDT)</td>
                            <td className="text-center py-2 text-primary fs-6">{computedPayroll.reduce((acc, row) => acc + calculateTotal(row), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-4 pt-2">
                    <span className="fw-bold">In Words: {numberToWords(computedPayroll.reduce((acc, row) => acc + calculateTotal(row), 0))}</span>
                </div>

                <div className="d-flex justify-content-between mt-5 pt-5">
                    <div className="border-top border-dark text-center pt-1" style={{ width: '150px' }}>Prepared By</div>
                    <div className="border-top border-dark text-center pt-1" style={{ width: '150px' }}>Checked By</div>
                    <div className="border-top border-dark text-center pt-1" style={{ width: '150px' }}>Approved By</div>
                </div>
            </div>

            {activeTab === 'employees' && (
                <div className="card border-0 shadow-sm no-print">
                    <div className="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                        <h5 className="mb-0 fw-bold">Active Workforce</h5>
                        <button className="btn btn-dark btn-sm" onClick={() => { setEmpForm({ emp_id: '', name: '', department: '', designation: '', joining_date: '', employment_type: 'Full-time', base_salary: 0, status: 'Active' }); setShowEmpModal(true); }}>
                            <i className="fa-solid fa-plus me-1"></i> Add Employee
                        </button>
                    </div>
                    <div className="table-responsive">
                        <table className="table align-middle">
                            <thead className="bg-light">
                                <tr>
                                    <th className="ps-4">EMP ID</th>
                                    <th>Name</th>
                                    <th>Dept / Designation</th>
                                    <th className="text-end pe-4">Base Salary</th>
                                    <th className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map(e => (
                                    <tr key={e.id}>
                                        <td className="ps-4 fw-bold text-primary">{e.emp_id}</td>
                                        <td className="fw-bold">{e.name}</td>
                                        <td>{e.department} <br /> <small className="text-muted">{e.designation}</small></td>
                                        <td className="text-end pe-4 fw-bold">{Number(e.base_salary).toLocaleString()}</td>
                                        <td className="text-center">
                                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => { setEmpForm(e); setShowEmpModal(true); }}><i className="fa-solid fa-pen"></i></button>
                                            <button className="btn btn-sm btn-outline-success" onClick={() => { setIncForm({ ...incForm, employee_id: e.id }); setShowIncModal(true); }}><i className="fa-solid fa-arrow-up"></i></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'increments' && (
                <div className="card border-0 shadow-sm no-print">
                    <div className="card-header bg-white border-0 py-3">
                        <h5 className="mb-0 fw-bold">Increment History</h5>
                    </div>
                    <div className="table-responsive">
                        <table className="table align-middle">
                            <thead className="bg-light">
                                <tr>
                                    <th className="ps-4">Employee</th>
                                    <th>Effective Date</th>
                                    <th className="text-end">Amount</th>
                                    <th className="ps-4">Remarks</th>
                                    <th className="text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {increments.map(inc => (
                                    <tr key={inc.id}>
                                        <td className="ps-4">
                                            <div className="fw-bold">{inc.Employee?.name}</div>
                                            <small className="text-muted">{inc.Employee?.emp_id}</small>
                                        </td>
                                        <td>{inc.effective_date}</td>
                                        <td className="text-end fw-bold text-success">+{Number(inc.amount).toLocaleString()}</td>
                                        <td className="ps-4 small text-muted">{inc.remarks}</td>
                                        <td className="text-center">
                                            <button className="btn btn-sm btn-light text-primary me-2" onClick={() => { setIncForm(inc); setShowIncModal(true); }}><i className="fa-solid fa-pen"></i></button>
                                            <button className="btn btn-sm btn-light text-danger" onClick={async () => { if (window.confirm('Delete this increment record?')) { await api.delete(`/payroll/increments/${inc.id}`); fetchData(); } }}><i className="fa-solid fa-trash"></i></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'records' && (
                <div className="no-print">
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-body d-flex align-items-center gap-3 p-4">
                            <div className="flex-grow-1">
                                <label className="form-label small fw-bold">Select Archive Month</label>
                                <select className="form-select shadow-none" value={selectedArchiveMonth} onChange={e => setSelectedArchiveMonth(e.target.value)}>
                                    {[...new Set(payrollRecords.map(r => r.month))].sort().reverse().map(m => (
                                        <option key={m} value={m}>{new Date(m).toLocaleString('default', { month: 'long', year: 'numeric' })}</option>
                                    ))}
                                </select>
                            </div>
                            <button className="btn btn-outline-success fw-bold mt-4" onClick={exportArchiveToExcel}>
                                <i className="fa-solid fa-file-excel me-2"></i> Export Archive to Excel
                            </button>
                        </div>
                    </div>

                    <div id="salary-sheet-archive" className="bg-white p-4" style={{ color: '#000', fontFamily: "'Times New Roman', serif" }}>
                        <div className="text-center mb-0">
                            <h4 className="fw-bold m-0" style={{ fontSize: '1.2rem', textDecoration: 'underline' }}>Axiler Limited</h4>
                            <div className="fw-bold mb-3" style={{ fontSize: '1rem', textDecoration: 'underline' }}>Salary Sheet</div>
                        </div>

                        <table className="table table-bordered border-dark w-100 mb-0" style={{ fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr className="text-center fw-bold align-middle">
                                    <th colSpan="11" className="py-2" style={{ backgroundColor: '#f9f9f9', fontSize: '0.85rem' }}>
                                        For The Month Of {new Date(selectedArchiveMonth).toLocaleString('default', { month: 'long', year: 'numeric' })} Will be disbursed in {new Date(new Date(selectedArchiveMonth).setMonth(new Date(selectedArchiveMonth).getMonth() + 1)).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                    </th>
                                </tr>
                                <tr className="text-center align-middle">
                                    <th rowSpan="2" style={{ width: '30px' }}>Sl.</th>
                                    <th rowSpan="2" style={{ width: '150px' }}>Name</th>
                                    <th rowSpan="2" style={{ width: '80px' }}>Basic</th>
                                    <th colSpan="2">Allowance</th>
                                    <th rowSpan="2" style={{ width: '60px' }}>Bonus</th>
                                    <th rowSpan="2" style={{ width: '80px' }}>Increment</th>
                                    <th rowSpan="2" style={{ width: '60px' }}>Working Days</th>
                                    <th rowSpan="2" style={{ width: '80px' }}>Advance Salary</th>
                                    <th rowSpan="2" style={{ width: '100px' }}>Total Gross Salary (BDT)</th>
                                    <th rowSpan="2">Remarks</th>
                                </tr>
                                <tr className="text-center">
                                    <th style={{ width: '70px' }}>Transport</th>
                                    <th style={{ width: '70px' }}>Other</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payrollRecords.filter(r => r.month === selectedArchiveMonth).length === 0 && (
                                    <tr><td colSpan="11" className="text-center py-4">No records for this month.</td></tr>
                                )}
                                {payrollRecords.filter(r => r.month === selectedArchiveMonth).map((rec, idx) => (
                                    <tr key={rec.id}>
                                        <td className="text-center">{idx + 1}</td>
                                        <td className="ps-2">{rec.Employee?.name}</td>
                                        <td className="text-center">{Number(rec.base_salary_snapshot).toFixed(0)}</td>
                                        <td className="text-center">{Number(rec.transport_allowance || 0) || ''}</td>
                                        <td className="text-center">{Number(rec.other_allowance || 0) || ''}</td>
                                        <td className="text-center">{Number(rec.bonus || 0) || ''}</td>
                                        <td className="text-center">{Number(rec.total_increments_snapshot || 0) || ''}</td>
                                        <td className="text-center">{rec.paid_days}</td>
                                        <td className="text-center">{Number(rec.advance_salary || 0) || ''}</td>
                                        <td className="text-center fw-bold">{Number(rec.net_salary).toFixed(0)}</td>
                                        <td className="ps-2 small d-flex justify-content-between align-items-center">
                                            <span>{rec.remarks}</span>
                                            <div className="btn-group">
                                                <button className="btn btn-link btn-sm text-primary p-0 me-2" onClick={() => { setEditRecordForm(rec); setShowEditRecordModal(true); }}>
                                                    <i className="fa-solid fa-pen"></i>
                                                </button>
                                                <button className="btn btn-link btn-sm text-danger p-0" onClick={async () => { if (window.confirm('Delete this record?')) { await api.delete(`/payroll/records/${rec.id}`); fetchData(); } }}>
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                <tr className="fw-bold">
                                    <td colSpan="2" style={{ borderRight: 'none' }}>Grand Total (BDT)</td>
                                    <td colSpan="7" style={{ borderLeft: 'none', borderRight: 'none' }}></td>
                                    <td className="text-center" style={{ textDecoration: 'underline double' }}>
                                        {payrollRecords.filter(r => r.month === selectedArchiveMonth).reduce((acc, curr) => acc + Number(curr.net_salary), 0).toLocaleString()}
                                    </td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="mt-4 small fw-bold">
                            In Words: {numberToWords(payrollRecords.filter(r => r.month === selectedArchiveMonth).reduce((acc, curr) => acc + Number(curr.net_salary), 0))}
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'reminders' && (
                <div className="no-print">
                    <div className="row g-4">
                        <div className="col-md-6">
                            <div className="card border-0 shadow-sm">
                                <div className="card-header bg-warning-subtle border-0 py-3">
                                    <h6 className="mb-0 fw-bold text-warning-emphasis">Upcoming Increments (Next 60 Days)</h6>
                                </div>
                                <div className="list-group list-group-flush">
                                    {increments.filter(inc => {
                                        const eff = new Date(inc.effective_date);
                                        const now = new Date();
                                        const diff = (eff - now) / (1000 * 60 * 60 * 24);
                                        return diff > 0 && diff <= 60;
                                    }).map(inc => (
                                        <div key={inc.id} className="list-group-item d-flex justify-content-between align-items-center">
                                            <div>
                                                <div className="fw-bold">{inc.Employee?.name}</div>
                                                <small className="text-muted">Effective: {inc.effective_date}</small>
                                            </div>
                                            <span className="badge bg-warning text-dark">+{Number(inc.amount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                    {increments.filter(inc => {
                                        const eff = new Date(inc.effective_date);
                                        const now = new Date();
                                        const diff = (eff - now) / (1000 * 60 * 60 * 24);
                                        return diff > 0 && diff <= 60;
                                    }).length === 0 && <div className="p-4 text-center text-muted">No upcoming increments</div>}
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="card border-0 shadow-sm">
                                <div className="card-header bg-success-subtle border-0 py-3">
                                    <h6 className="mb-0 fw-bold text-success-emphasis">Recently Applied (Past 30 Days)</h6>
                                </div>
                                <div className="list-group list-group-flush">
                                    {increments.filter(inc => {
                                        const eff = new Date(inc.effective_date);
                                        const now = new Date();
                                        const diff = (now - eff) / (1000 * 60 * 60 * 24);
                                        return diff >= 0 && diff <= 30;
                                    }).map(inc => (
                                        <div key={inc.id} className="list-group-item d-flex justify-content-between align-items-center">
                                            <div>
                                                <div className="fw-bold">{inc.Employee?.name}</div>
                                                <small className="text-muted">Applied: {inc.effective_date}</small>
                                            </div>
                                            <span className="badge bg-success">+{Number(inc.amount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                    {increments.filter(inc => {
                                        const eff = new Date(inc.effective_date);
                                        const now = new Date();
                                        const diff = (now - eff) / (1000 * 60 * 60 * 24);
                                        return diff >= 0 && diff <= 30;
                                    }).length === 0 && <div className="p-4 text-center text-muted">No recently applied increments</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showEmpModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <form className="modal-content border-0 shadow-lg rounded-4" onSubmit={handleSaveEmployee}>
                            <div className="modal-header border-0 p-4 pb-0">
                                <h5 className="fw-bold m-0">{empForm.id ? 'Modify Employee' : 'Strategic New Hire'}</h5>
                                <button type="button" className="btn-close" onClick={() => { setShowEmpModal(false); setErrorMsg(null); }}></button>
                            </div>
                            <div className="modal-body p-4">
                                {errorMsg && (
                                    <div className="alert alert-danger py-2 px-3 border-0 small fw-bold mb-3 d-flex align-items-center gap-2">
                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                        {errorMsg}
                                    </div>
                                )}
                                <div className="row g-3">
                                    <div className="col-12"><label className="form-label small fw-bold">Full Name</label><input type="text" className="form-control shadow-none" value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} required /></div>
                                    <div className="col-6"><label className="form-label small fw-bold">Emp ID</label><input type="text" className="form-control shadow-none" value={empForm.emp_id} onChange={e => setEmpForm({ ...empForm, emp_id: e.target.value })} required /></div>
                                    <div className="col-6"><label className="form-label small fw-bold">Joining Date</label><input type="date" className="form-control shadow-none" value={empForm.joining_date} onChange={e => setEmpForm({ ...empForm, joining_date: e.target.value })} required /></div>
                                    <div className="col-12"><label className="form-label small fw-bold">Base Salary (Starting)</label><input type="number" className="form-control shadow-none" value={empForm.base_salary} onChange={e => setEmpForm({ ...empForm, base_salary: e.target.value })} required /></div>
                                    <div className="col-6"><label className="form-label small fw-bold">Department</label><input type="text" className="form-control shadow-none" value={empForm.department} onChange={e => setEmpForm({ ...empForm, department: e.target.value })} /></div>
                                    <div className="col-6"><label className="form-label small fw-bold">Designation</label><input type="text" className="form-control shadow-none" value={empForm.designation} onChange={e => setEmpForm({ ...empForm, designation: e.target.value })} /></div>
                                </div>
                            </div>
                            <div className="modal-footer border-0 p-4">
                                <button type="submit" className="btn btn-primary w-100 py-2 fw-bold">Commit Information</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showIncModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <form className="modal-content border-0 shadow-lg rounded-4" onSubmit={handleSaveIncrement}>
                            <div className="modal-header border-0 p-4 pb-0">
                                <h5 className="fw-bold m-0">Apply Salary Correction</h5>
                                <button type="button" className="btn-close" onClick={() => setShowIncModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="row g-3">
                                    <div className="col-12"><label className="form-label small fw-bold">Effective Date</label><input type="date" className="form-control shadow-none" value={incForm.effective_date} onChange={e => setIncForm({ ...incForm, effective_date: e.target.value })} required /></div>
                                    <div className="col-12"><label className="form-label small fw-bold">Increment Amount</label><input type="number" className="form-control shadow-none" value={incForm.amount} onChange={e => setIncForm({ ...incForm, amount: e.target.value })} required /></div>
                                    <div className="col-12"><label className="form-label small fw-bold">Business Justification / Remarks</label><textarea className="form-control shadow-none" rows="3" value={incForm.remarks} onChange={e => setIncForm({ ...incForm, remarks: e.target.value })}></textarea></div>
                                </div>
                            </div>
                            <div className="modal-footer border-0 p-4">
                                <button type="submit" className="btn btn-success w-100 py-2 fw-bold">Apply Future Increment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showEditRecordModal && editRecordForm && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <form className="modal-content border-0 shadow-lg rounded-4" onSubmit={handleUpdateRecord}>
                            <div className="modal-header border-0 p-4 pb-0">
                                <h5 className="fw-bold m-0">Correct Archived Record - {editRecordForm.Employee?.name}</h5>
                                <button type="button" className="btn-close" onClick={() => setShowEditRecordModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="row g-3">
                                    <div className="col-md-4"><label className="form-label small fw-bold">Base Snapshot</label><input type="number" className="form-control" value={editRecordForm.base_salary_snapshot} onChange={e => setEditRecordForm({ ...editRecordForm, base_salary_snapshot: e.target.value })} /></div>
                                    <div className="col-md-4"><label className="form-label small fw-bold">Inc. Snapshot</label><input type="number" className="form-control" value={editRecordForm.total_increments_snapshot} onChange={e => setEditRecordForm({ ...editRecordForm, total_increments_snapshot: e.target.value })} /></div>
                                    <div className="col-md-4"><label className="form-label small fw-bold">Working Days</label><input type="number" className="form-control" value={editRecordForm.paid_days} onChange={e => setEditRecordForm({ ...editRecordForm, paid_days: e.target.value })} /></div>
                                    <div className="col-md-3"><label className="form-label small fw-bold">Transport</label><input type="number" className="form-control" value={editRecordForm.transport_allowance} onChange={e => setEditRecordForm({ ...editRecordForm, transport_allowance: e.target.value })} /></div>
                                    <div className="col-md-3"><label className="form-label small fw-bold">Other</label><input type="number" className="form-control" value={editRecordForm.other_allowance} onChange={e => setEditRecordForm({ ...editRecordForm, other_allowance: e.target.value })} /></div>
                                    <div className="col-md-3"><label className="form-label small fw-bold">Bonus</label><input type="number" className="form-control" value={editRecordForm.bonus} onChange={e => setEditRecordForm({ ...editRecordForm, bonus: e.target.value })} /></div>
                                    <div className="col-md-3"><label className="form-label small fw-bold">Advance</label><input type="number" className="form-control" value={editRecordForm.advance_salary} onChange={e => setEditRecordForm({ ...editRecordForm, advance_salary: e.target.value })} /></div>
                                    <div className="col-12"><label className="form-label small fw-bold">Remarks</label><textarea className="form-control" value={editRecordForm.remarks} onChange={e => setEditRecordForm({ ...editRecordForm, remarks: e.target.value })}></textarea></div>
                                </div>
                                <div className="mt-3 p-3 bg-light rounded small">
                                    <strong>Note:</strong> Saving will automatically recalculate the <strong>Net Total</strong> for this archive entry.
                                </div>
                            </div>
                            <div className="modal-footer border-0 p-4">
                                <button type="submit" className="btn btn-primary w-100 py-2 fw-bold">Update & Recalculate Archive</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    .main-content { margin: 0 !important; padding: 0 !important; }
                }
            `}</style>
        </Layout>
    );
};

export default Payroll;
