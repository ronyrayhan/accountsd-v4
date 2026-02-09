import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import * as XLSX from 'xlsx';

const AttendanceManagement = () => {
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const getLocalDateString = () => {
        const d = new Date();
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };
    const [startDate, setStartDate] = useState(getLocalDateString());
    const [endDate, setEndDate] = useState(getLocalDateString());
    const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, onLeave: 0 });
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [selectedAttendance, setSelectedAttendance] = useState(null);
    const [overrideForm, setOverrideForm] = useState({
        punch_in_time: '',
        punch_out_time: '',
        notes: ''
    });
    const itemsPerPage = 20;

    const formatTimeDuration = (totalMinutes) => {
        if (!totalMinutes || totalMinutes <= 0) return '—';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);

        let parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);

        return parts.length > 0 ? parts.join('') : '0m';
    };

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/hr/attendance?start_date=${startDate}&end_date=${endDate}`);
            setAttendance(res.data);

            // Calculate stats
            const present = res.data.filter(a => a.status === 'Present' || a.status === 'Late').length;
            const absent = res.data.filter(a => a.status === 'Absent').length;
            const late = res.data.filter(a => a.status === 'Late').length;
            const onLeave = res.data.filter(a => a.status === 'On Leave').length;
            setStats({ present, absent, late, onLeave });
        } catch (err) {
            console.error('Error fetching attendance:', err);
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        if (attendance.length === 0) {
            alert('No data to export');
            return;
        }

        // Group data by date
        const groupedByDate = attendance.reduce((acc, a) => {
            const dateStr = new Date(a.date).toLocaleDateString();
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(a);
            return acc;
        }, {});

        const excelData = [];
        let rowNum = 1;

        // Sort dates and process
        Object.keys(groupedByDate)
            .sort((a, b) => new Date(a) - new Date(b))
            .forEach(dateKey => {
                // Add a Date Header Row
                excelData.push({
                    "#": "---",
                    "Date": dateKey,
                    "Employee Name": "DATE GROUP",
                    "Employee ID": "-----------",
                    "Entry Type": "DATE START",
                    "Punch In": "",
                    "Punch Out": "",
                    "Duration": "",
                    "Total Hours": "",
                    "Status": "",
                    "Early In": "",
                    "Late In": "",
                    "Early Out": "",
                    "Late Out": "",
                    "Overtime": ""
                });

                // Group employees under this date
                groupedByDate[dateKey].forEach(a => {
                    const empName = a.employee_id?.personal_info?.full_name || 'N/A';
                    const empId = a.employee_id?.employee_id || 'N/A';

                    // 1. ADD SUMMARY ROW
                    excelData.push({
                        "#": rowNum++,
                        "Date": dateKey,
                        "Employee Name": empName,
                        "Employee ID": empId,
                        "Entry Type": "TOTAL SUMMARY",
                        "Punch In": a.punch_in ? new Date(a.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—',
                        "Punch Out": a.punch_out ? new Date(a.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—',
                        "Duration": `${a.total_hours || 0} hrs`,
                        "Total Hours": a.total_hours || 0,
                        "Status": a.status || 'N/A',
                        "Leave Type": a.leave_type_name || '—',
                        "Early In": formatTimeDuration(a.early_entry),
                        "Late In": formatTimeDuration(a.late_entry),
                        "Early Out": formatTimeDuration(a.early_exit),
                        "Late Out": formatTimeDuration(a.late_exit),
                        "Overtime": a.overtime_hours || 0
                    });

                    // 2. ADD DETAIL SEGMENT ROWS
                    if (a.segments && a.segments.length > 0) {
                        a.segments.forEach((seg, idx) => {
                            excelData.push({
                                "#": "",
                                "Date": dateKey,
                                "Employee Name": empName,
                                "Employee ID": empId,
                                "Entry Type": `Shift Segment #${idx + 1}`,
                                "Punch In": seg.punch_in ? new Date(seg.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—',
                                "Punch Out": seg.punch_out ? new Date(seg.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—',
                                "Duration": `${seg.duration ? seg.duration.toFixed(2) : 0} hrs`,
                                "Total Hours": "",
                                "Status": "",
                                "Early In": "",
                                "Late In": "",
                                "Early Out": "",
                                "Late Out": "",
                                "Overtime": ""
                            });
                        });
                    }
                });

                // Add an empty row between dates for clarity
                excelData.push({});
            });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Detail");
        XLSX.writeFile(workbook, `Attendance_Detailed_${startDate}_to_${endDate}.xlsx`);
    };

    useEffect(() => {
        fetchAttendance();
    }, [startDate, endDate]);

    const toggleRow = (id) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const openOverrideModal = (record) => {
        setSelectedAttendance(record);
        // Initialize form with existing times if present
        // Handle local date properly
        const punchIn = record.punch_in ? new Date(record.punch_in) : null;
        const punchOut = record.punch_out ? new Date(record.punch_out) : null;

        const inTime = punchIn ? punchIn.toTimeString().slice(0, 5) : '09:00';
        const outTime = punchOut ? punchOut.toTimeString().slice(0, 5) : '18:00';

        setOverrideForm({
            punch_in_time: inTime,
            punch_out_time: outTime,
            notes: ''
        });
        setShowOverrideModal(true);
    };

    const handleOverride = async () => {
        try {
            // Get the local date string from the record's date
            const recordDate = new Date(selectedAttendance.date);
            const year = recordDate.getFullYear();
            const month = String(recordDate.getMonth() + 1).padStart(2, '0');
            const day = String(recordDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            // Combine date from record and time from form (Add :00 for seconds)
            const inDateTime = `${dateStr}T${overrideForm.punch_in_time}:00`;
            const outDateTime = `${dateStr}T${overrideForm.punch_out_time}:00`;

            await api.post('/hr/attendance/override', {
                employee_id: selectedAttendance.employee_id._id,
                date: dateStr,
                punch_in: inDateTime,
                punch_out: outDateTime,
                notes: overrideForm.notes
            });

            setShowOverrideModal(false);
            fetchAttendance();
        } catch (err) {
            console.error('Error overriding attendance:', err);
            alert('Failed to update attendance: ' + (err.response?.data?.message || err.message));
        }
    };

    // Filter and paginate attendance data
    const filteredAttendance = attendance.filter(a => {
        if (!searchQuery) return true;
        const name = a.employee_id?.personal_info?.full_name?.toLowerCase() || '';
        const empId = a.employee_id?.employee_id?.toLowerCase() || '';
        return name.includes(searchQuery.toLowerCase()) || empId.includes(searchQuery.toLowerCase());
    });

    const totalPages = Math.ceil(filteredAttendance.length / itemsPerPage);
    const paginatedAttendance = filteredAttendance.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    return (
        <Layout
            title="Attendance Hub"
            actions={
                <div className="d-flex gap-2">
                    <button className="btn btn-primary rounded-pill px-4" onClick={exportToExcel}>
                        <i className="fa-solid fa-file-excel me-2"></i> Export Report
                    </button>
                </div>
            }
        >
            <div className="row g-4 mb-4">
                <div className="col-md-9">
                    <div className="card border-0 shadow-sm rounded-4 overflow-hidden h-100">
                        <div className="card-header bg-white border-bottom p-4 d-flex justify-content-between align-items-center">
                            <div>
                                <h5 className="fw-bold mb-0">Daily Attendance Log</h5>
                                <div className="text-muted small">Daily RFID tap summary for the selected date</div>
                            </div>
                            <div className="d-flex gap-2 align-items-center">
                                <input
                                    type="text"
                                    className="form-control border-0 bg-light shadow-sm rounded-pill px-4 py-2 w-auto"
                                    placeholder="Search employee..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{ minWidth: '200px' }}
                                />
                                <div className="d-flex align-items-center bg-light rounded-pill px-3 py-1 shadow-sm gap-2">
                                    <div className="d-flex align-items-center gap-1">
                                        <span className="x-small fw-bold text-muted text-uppercase">From:</span>
                                        <input
                                            type="date"
                                            className="form-control border-0 bg-transparent p-0 small fw-bold w-auto cursor-pointer"
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="text-muted opacity-50 px-1">|</div>
                                    <div className="d-flex align-items-center gap-1">
                                        <span className="x-small fw-bold text-muted text-uppercase">To:</span>
                                        <input
                                            type="date"
                                            className="form-control border-0 bg-transparent p-0 small fw-bold w-auto cursor-pointer"
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="py-3 text-muted x-small ls-1 fw-bold text-center">EMPLOYEE</th>
                                        <th className="text-muted x-small ls-1 fw-bold text-center" colSpan="2">ATTENDANCE (IN/OUT)</th>
                                        <th className="text-muted x-small ls-1 fw-bold text-center">DURATION</th>
                                        <th className="text-muted x-small ls-1 fw-bold text-center">STATUS</th>
                                        <th className="text-muted x-small ls-1 fw-bold text-center">EARLY IN</th>
                                        <th className="text-muted x-small ls-1 fw-bold text-center">LATE IN</th>
                                        <th className="text-muted x-small ls-1 fw-bold text-center">EARLY OUT</th>
                                        <th className="text-muted x-small ls-1 fw-bold text-center">LATE OUT</th>
                                        <th className="text-muted x-small ls-1 fw-bold text-center">OVERTIME</th>
                                        <th className="text-muted x-small ls-1 fw-bold text-center">ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="11" className="text-center py-5"><div className="spinner-border spinner-border-sm text-primary"></div></td></tr>
                                    ) : attendance.length === 0 ? (
                                        <tr><td colSpan="11" className="text-center py-5 text-muted opacity-50"><i className="fa-solid fa-id-card fs-1 d-block mb-3"></i>No records synced for this date.</td></tr>
                                    ) : (
                                        paginatedAttendance.map(a => (
                                            <tr key={a._id}>
                                                <td className="text-center">
                                                    <div className="fw-bold text-bright small">{a.employee_id?.personal_info?.full_name}</div>
                                                    <div className="x-small text-muted d-flex align-items-center justify-content-center">
                                                        <span>{a.employee_id?.employee_id}</span>
                                                        {a.segments?.length > 1 && (
                                                            <span className="ms-2 badge bg-primary-subtle text-primary border border-primary-subtle x-small rounded-pill">
                                                                <i className="fa-solid fa-layer-group me-1"></i> {a.segments.length} Shifts
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td colSpan="2" className="text-center">
                                                    {a.segments && a.segments.length > 0 ? (
                                                        <div className="d-flex flex-column gap-1 align-items-center">
                                                            {/* Always show the MOST RECENT segment first */}
                                                            {(() => {
                                                                const sortedSegments = [...a.segments].sort((a, b) => new Date(b.punch_in) - new Date(a.punch_in));
                                                                const latest = sortedSegments[0];
                                                                const others = sortedSegments.slice(1);
                                                                const isExpanded = expandedRows.has(a._id);

                                                                return (
                                                                    <>
                                                                        <div className="x-small d-flex align-items-center bg-white rounded-pill p-1 border shadow-sm px-3" style={{ width: 'fit-content' }}>
                                                                            <span className="fw-bold text-success"><PunchTime date={latest.punch_in} /></span>
                                                                            <i className="fa-solid fa-arrow-right mx-2 text-muted opacity-50" style={{ fontSize: '0.6rem' }}></i>
                                                                            <span className="fw-bold text-danger me-2"><PunchTime date={latest.punch_out} /></span>
                                                                            {others.length > 0 && (
                                                                                <button
                                                                                    className={`btn btn-xs rounded-circle border-0 p-0 d-flex align-items-center justify-content-center ${isExpanded ? 'btn-primary' : 'btn-light'}`}
                                                                                    onClick={() => toggleRow(a._id)}
                                                                                    title={isExpanded ? "Hide previous shifts" : `See ${others.length} more shifts`}
                                                                                    style={{ width: 20, height: 20 }}
                                                                                >
                                                                                    <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`} style={{ fontSize: '0.5rem' }}></i>
                                                                                </button>
                                                                            )}
                                                                        </div>

                                                                        {isExpanded && others.map((seg, i) => (
                                                                            <div key={i} className="x-small d-flex align-items-center bg-light bg-opacity-50 rounded-pill px-3 py-1 border-dashed mt-1" style={{ width: 'fit-content' }}>
                                                                                <span className="text-muted me-2">Shift {others.length - i}:</span>
                                                                                <span className="fw-bold text-success opacity-75"><PunchTime date={seg.punch_in} /></span>
                                                                                <i className="fa-solid fa-arrow-right mx-2 text-muted opacity-50" style={{ fontSize: '0.6rem' }}></i>
                                                                                <span className="fw-bold text-danger opacity-75"><PunchTime date={seg.punch_out} /></span>
                                                                            </div>
                                                                        ))}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <div className="d-flex align-items-center gap-3 justify-content-center">
                                                            <div className="small fw-bold text-success"><PunchTime date={a.punch_in} /></div>
                                                            <i className="fa-solid fa-arrow-right text-muted opacity-25 small"></i>
                                                            <div className="small fw-bold text-danger"><PunchTime date={a.punch_out} /></div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-center"><div className="small fw-bold">{a.total_hours} <span className="fw-normal text-muted">hrs</span></div></td>
                                                <td className="text-center">
                                                    <span className={`badge rounded-pill px-3 py-1 ${a.status === 'Present' ? 'bg-success text-white' :
                                                        a.status === 'Late' ? 'bg-warning text-dark' :
                                                            a.status === 'On Leave' ? 'bg-info text-white' :
                                                                'bg-danger text-white'
                                                        }`}>
                                                        {a.status}
                                                    </span>
                                                    {a.leave_type_name && (
                                                        <div className="x-small text-info mt-1 fw-bold text-uppercase ls-1 justify-content-center d-flex align-items-center" style={{ fontSize: '0.6rem' }}>
                                                            <i className="fa-solid fa-umbrella-beach me-1"></i> {a.leave_type_name}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    <div className="small">
                                                        {a.early_entry > 0 ? (
                                                            <span className="badge bg-info-subtle text-info border border-info">{formatTimeDuration(a.early_entry)}</span>
                                                        ) : (
                                                            <span className="text-muted">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-center">
                                                    <div className="small">
                                                        {a.late_entry > 0 ? (
                                                            <span className="badge bg-warning-subtle text-warning border border-warning">{formatTimeDuration(a.late_entry)}</span>
                                                        ) : (
                                                            <span className="text-muted">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-center">
                                                    <div className="small">
                                                        {a.early_exit > 0 ? (
                                                            <span className="badge bg-success-subtle text-success border border-success">{formatTimeDuration(a.early_exit)}</span>
                                                        ) : (
                                                            <span className="text-muted">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-center">
                                                    <div className="small">
                                                        {a.late_exit > 0 ? (
                                                            <span className="badge bg-danger-subtle text-danger border border-danger">{formatTimeDuration(a.late_exit)}</span>
                                                        ) : (
                                                            <span className="text-muted">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-center"><div className="small text-muted">{a.overtime_hours > 0 ? `${a.overtime_hours} hrs` : '—'}</div></td>
                                                <td className="text-center">
                                                    <button
                                                        className="btn btn-sm btn-outline-primary border-0 rounded-pill px-2 py-0 x-small"
                                                        onClick={() => openOverrideModal(a)}
                                                        title="Override Time"
                                                        style={{ fontSize: '0.65rem' }}
                                                    >
                                                        <i className="fa-solid fa-pen-to-square"></i> Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="card-footer bg-white border-top p-3">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div className="small text-muted">
                                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAttendance.length)} of {filteredAttendance.length} employees
                                    </div>
                                    <div className="btn-group btn-group-sm">
                                        <button
                                            className="btn btn-outline-secondary"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <i className="fa-solid fa-chevron-left"></i>
                                        </button>
                                        {[...Array(totalPages)].map((_, i) => {
                                            const page = i + 1;
                                            if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                                return (
                                                    <button
                                                        key={page}
                                                        className={`btn ${page === currentPage ? 'btn-primary' : 'btn-outline-secondary'}`}
                                                        onClick={() => setCurrentPage(page)}
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            } else if (page === currentPage - 2 || page === currentPage + 2) {
                                                return <span key={page} className="btn btn-outline-secondary disabled">...</span>;
                                            }
                                            return null;
                                        })}
                                        <button
                                            className="btn btn-outline-secondary"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            <i className="fa-solid fa-chevron-right"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                        <div className="p-4 d-flex flex-column">
                            <div className="d-flex align-items-center justify-content-between mb-4">
                                <h6 className="mb-0 fw-bold text-uppercase x-small ls-2 text-muted">Live Status</h6>
                                <i className="fa-solid fa-satellite-dish text-primary pulse-animation opacity-50"></i>
                            </div>

                            <div className="d-flex flex-column gap-4 flex-grow-1 justify-content-center">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="bg-success-subtle rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ width: 35, height: 35 }}>
                                            <i className="fa-solid fa-user-check text-success small"></i>
                                        </div>
                                        <span className="small text-dark fw-semibold">Present</span>
                                    </div>
                                    <span className="fs-5 fw-bold text-dark">{stats.present}</span>
                                </div>

                                <div className="d-flex justify-content-between align-items-center">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="bg-warning-subtle rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ width: 35, height: 35 }}>
                                            <i className="fa-solid fa-clock text-warning small"></i>
                                        </div>
                                        <span className="small text-dark fw-semibold">Late</span>
                                    </div>
                                    <span className="fs-5 fw-bold text-warning">{stats.late}</span>
                                </div>

                                <div className="d-flex justify-content-between align-items-center">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="bg-info-subtle rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ width: 35, height: 35 }}>
                                            <i className="fa-solid fa-umbrella-beach text-info small"></i>
                                        </div>
                                        <span className="small text-dark fw-semibold">On Leave</span>
                                    </div>
                                    <span className="fs-5 fw-bold text-info">{stats.onLeave}</span>
                                </div>

                                <div className="d-flex justify-content-between align-items-center">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="bg-danger-subtle rounded-3 p-2 d-flex align-items-center justify-content-center" style={{ width: 35, height: 35 }}>
                                            <i className="fa-solid fa-user-xmark text-danger small"></i>
                                        </div>
                                        <span className="small text-dark fw-semibold">Absent</span>
                                    </div>
                                    <span className="fs-5 fw-bold text-danger">{stats.absent}</span>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-top border-light text-center">
                                <div className="x-small text-muted fw-bold">REAL-TIME SYNC ACTIVE</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Override Modal */}
            {showOverrideModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow rounded-4">
                            <div className="modal-header border-bottom p-4">
                                <h5 className="modal-title fw-bold">
                                    <i className="fa-solid fa-clock-rotate-left text-primary me-2"></i>
                                    Override Attendance
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setShowOverrideModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="alert bg-primary-subtle border-0 rounded-4 p-3 mb-4">
                                    <div className="fw-bold text-primary mb-1">Editing Record for:</div>
                                    <div className="text-bright small">
                                        {selectedAttendance?.employee_id?.personal_info?.full_name} ({selectedAttendance?.employee_id?.employee_id})
                                    </div>
                                    <div className="x-small text-muted mt-1">Date: {new Date(selectedAttendance?.date).toLocaleDateString()}</div>
                                </div>

                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label x-small fw-bold text-muted text-uppercase ls-1">Punch In Time</label>
                                        <input
                                            type="time"
                                            className="form-control bg-light border-0 rounded-3 p-3"
                                            value={overrideForm.punch_in_time}
                                            onChange={e => setOverrideForm({ ...overrideForm, punch_in_time: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label x-small fw-bold text-muted text-uppercase ls-1">Punch Out Time</label>
                                        <input
                                            type="time"
                                            className="form-control bg-light border-0 rounded-3 p-3"
                                            value={overrideForm.punch_out_time}
                                            onChange={e => setOverrideForm({ ...overrideForm, punch_out_time: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label x-small fw-bold text-muted text-uppercase ls-1">Notes / Reason</label>
                                        <textarea
                                            className="form-control bg-light border-0 rounded-3 p-3"
                                            rows="3"
                                            placeholder="Reason for manual override..."
                                            value={overrideForm.notes}
                                            onChange={e => setOverrideForm({ ...overrideForm, notes: e.target.value })}
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer border-top p-4 d-flex justify-content-between">
                                <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setShowOverrideModal(false)}>Cancel</button>
                                <button type="button" className="btn btn-primary rounded-pill px-4" onClick={handleOverride}>
                                    Save Override
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

// Sub-component for rendering segments if needed, or just inline map
const PunchTime = ({ date }) => {
    if (!date) return '—';
    return new Date(date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
};

export default AttendanceManagement;
