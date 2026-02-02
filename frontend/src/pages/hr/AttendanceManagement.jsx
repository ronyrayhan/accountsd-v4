import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../api/axios';

const AttendanceManagement = () => {
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const getLocalDateString = () => {
        const d = new Date();
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };
    const [filterDate, setFilterDate] = useState(getLocalDateString());
    const [stats, setStats] = useState({ present: 0, absent: 0, late: 0 });

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/hr/attendance?start_date=${filterDate}&end_date=${filterDate}`);
            setAttendance(res.data);

            // Calculate stats
            const present = res.data.filter(a => a.status === 'Present' || a.status === 'Late').length;
            const absent = res.data.filter(a => a.status === 'Absent').length;
            const late = res.data.filter(a => a.status === 'Late').length;
            setStats({ present, absent, late });
        } catch (err) {
            console.error('Error fetching attendance:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendance();
    }, [filterDate]);

    return (
        <Layout
            title="Attendance Hub"
            actions={
                <div className="d-flex gap-2">
                    <button className="btn btn-primary rounded-pill px-4">
                        <i className="fa-solid fa-shuttle-space me-2"></i> Export Report
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
                                <label className="small fw-bold text-muted text-uppercase mb-0 me-2">Date:</label>
                                <input
                                    type="date"
                                    className="form-control border-0 bg-light shadow-sm rounded-pill px-4 py-2 fw-bold w-auto"
                                    value={filterDate}
                                    onChange={e => setFilterDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="ps-4 py-3 text-muted x-small ls-1 fw-bold">EMPLOYEE</th>
                                        <th className="text-muted x-small ls-1 fw-bold">PUNCH IN</th>
                                        <th className="text-muted x-small ls-1 fw-bold">PUNCH OUT</th>
                                        <th className="text-muted x-small ls-1 fw-bold">DURATION</th>
                                        <th className="text-muted x-small ls-1 fw-bold">STATUS</th>
                                        <th className="text-muted x-small ls-1 fw-bold">OVERTIME</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="6" className="text-center py-5"><div className="spinner-border spinner-border-sm text-primary"></div></td></tr>
                                    ) : attendance.length === 0 ? (
                                        <tr><td colSpan="6" className="text-center py-5 text-muted opacity-50"><i className="fa-solid fa-id-card fs-1 d-block mb-3"></i>No records synced for this date.</td></tr>
                                    ) : (
                                        attendance.map(a => (
                                            <tr key={a._id}>
                                                <td>
                                                    <div className="fw-bold text-bright small">{a.employee_id?.personal_info?.full_name}</div>
                                                    <div className="x-small text-muted d-flex align-items-center">
                                                        <span>{a.employee_id?.employee_id}</span>
                                                        {a.segments?.length > 1 && (
                                                            <span className="ms-2 badge bg-primary-subtle text-primary border border-primary-subtle x-small rounded-pill">
                                                                <i className="fa-solid fa-layer-group me-1"></i> {a.segments.length} Shifts
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td colSpan="2">
                                                    {a.segments && a.segments.length > 0 ? (
                                                        <div className="d-flex flex-column gap-1">
                                                            {a.segments.map((seg, i) => (
                                                                <div key={i} className="x-small d-flex align-items-center bg-light rounded px-2 py-1 border" style={{ width: 'fit-content' }}>
                                                                    <span className="fw-bold text-success"><PunchTime date={seg.punch_in} /></span>
                                                                    <i className="fa-solid fa-arrow-right mx-2 text-muted opacity-50" style={{ fontSize: '0.6rem' }}></i>
                                                                    <span className="fw-bold text-danger"><PunchTime date={seg.punch_out} /></span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="d-flex align-items-center gap-3">
                                                            <div className="small fw-bold text-success"><PunchTime date={a.punch_in} /></div>
                                                            <i className="fa-solid fa-arrow-right text-muted opacity-25 small"></i>
                                                            <div className="small fw-bold text-danger"><PunchTime date={a.punch_out} /></div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td><div className="small fw-bold">{a.total_hours} <span className="fw-normal text-muted">hrs</span></div></td>
                                                <td>
                                                    <span className={`badge rounded-pill px-3 py-1 ${a.status === 'Present' ? 'bg-success text-white' :
                                                        a.status === 'Late' ? 'bg-warning text-dark' :
                                                            'bg-danger text-white'
                                                        }`}>
                                                        {a.status}
                                                    </span>
                                                </td>
                                                <td><div className="small text-muted">{a.overtime_hours > 0 ? `${a.overtime_hours} hrs` : '—'}</div></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-gradient-success text-white h-100">
                        <div className="stats-icon-box bg-white bg-opacity-10 text-white mb-4 shadow-sm" style={{ width: 48, height: 48 }}>
                            <i className="fa-solid fa-user-check"></i>
                        </div>
                        <h6 className="text-white text-opacity-75 fw-bold text-uppercase x-small ls-1 mb-2">Total Present</h6>
                        <h2 className="fw-bold mb-1 display-5">{stats.present} <span className="fs-5 fw-normal text-opacity-75">Staff</span></h2>
                        <div className="mt-auto pt-3 text-white text-opacity-75 small">
                            <i className="fa-solid fa-clock-pulse me-1"></i> Today's active workforce
                        </div>
                    </div>
                </div>
            </div>

            {/* Live Stats Legend */}
            <div className="row">
                <div className="col-md-12">
                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-light border-0">
                        <div className="d-flex flex-wrap gap-4 align-items-center">
                            <div className="d-flex align-items-center gap-2">
                                <i className="fa-solid fa-chart-pie text-primary opacity-50"></i>
                                <span className="small fw-bold text-muted">LIVE STATUS:</span>
                            </div>
                            <div className="ms-auto d-flex gap-4">
                                <div className="d-flex align-items-center gap-2 x-small text-muted fw-bold">
                                    <i className="fa-solid fa-circle text-success mx-1"></i>
                                    <span>PRESENT: <span className="text-dark fs-6">{stats.present}</span></span>
                                </div>
                                <div className="d-flex align-items-center gap-2 x-small text-muted fw-bold">
                                    <i className="fa-solid fa-circle text-warning mx-1"></i>
                                    <span>LATE: <span className="text-dark fs-6">{stats.late}</span></span>
                                </div>
                                <div className="d-flex align-items-center gap-2 x-small text-muted fw-bold">
                                    <i className="fa-solid fa-circle text-danger mx-1"></i>
                                    <span>ABSENT: <span className="text-dark fs-6">{stats.absent}</span></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

// Sub-component for rendering segments if needed, or just inline map
const PunchTime = ({ date }) => {
    if (!date) return '—';
    return new Date(date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
};

export default AttendanceManagement;
