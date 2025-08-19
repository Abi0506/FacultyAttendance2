import React, { useState, useEffect } from 'react';
import axios from '../axios';
import { useAlert } from '../components/AlertProvider';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PageWrapper from '../components/PageWrapper';

function HRLeaveManager() {
    const { showAlert } = useAlert();
    const today = new Date();

    // Correctly gets the first day of the current month.
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    // Correctly gets the last day of the current month.
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const [leaves, setLeaves] = useState([]);
    const [filteredLeaves, setFilteredLeaves] = useState([]);
    const [status, setStatus] = useState('');
    const [filterStaffId, setFilterStaffId] = useState(''); // For filtering the list
    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(lastDayOfMonth);

    // --- States for the "Apply for Leave" form ---
    const [staffName, setStaffName] = useState('');
    const [formData, setFormData] = useState({
        staff_id: '',
        start_date: '',
        end_date: '',
        leave_type: ''
    });

    // --- Fetch staff name as HR types the ID ---
    useEffect(() => {
        const fetchStaffName = async () => {
            if (formData.staff_id && formData.staff_id.length > 2) {
                try {
                    const res = await axios.post('/attendance/search/getuser', { staffId: formData.staff_id });
                    if (res.data && res.data.staff && res.data.staff.name) {
                        setStaffName(res.data.staff.name);
                    } else {
                        setStaffName('Staff not found');
                    }
                } catch (err) {
                    setStaffName('');
                }
            } else {
                setStaffName('');
            }
        };
        fetchStaffName();
    }, [formData.staff_id]);

    const fetchLeaves = async () => {
        try {
            const res = await axios.get("/leave");
            setLeaves(res.data);
        } catch (error) {
            showAlert('Failed to fetch leave records', 'error');
            console.error("Error fetching leaves:", error);
        }
    };

    useEffect(() => {
        fetchLeaves();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let filtered = leaves;
        if (startDate) {
            filtered = filtered.filter(leave => new Date(leave.start_date) >= new Date(startDate));
        }
        if (endDate) {
            filtered = filtered.filter(leave => new Date(leave.end_date) <= new Date(endDate));
        }
        if (status) {
            filtered = filtered.filter(leave => leave.status === status);
        }
        if (filterStaffId) {
            filtered = filtered.filter(leave =>
                leave.staff_id && leave.staff_id.toLowerCase().includes(filterStaffId.toLowerCase())
            );
        }
        setFilteredLeaves(filtered);
    }, [startDate, endDate, status, filterStaffId, leaves]);
    
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.staff_id || !formData.start_date || !formData.end_date || !formData.leave_type) {
            showAlert('Please fill all fields for the leave application', 'warning');
            return;
        }
        try {
            const payload = { ...formData, status: 'approved' };
            const res = await axios.post("/leave", payload);
            if (res.data.leave_id) {
                showAlert('Leave request submitted and approved!', 'success');
                fetchLeaves();
                setFormData({ staff_id: '', start_date: '', end_date: '', leave_type: '' });
            } else {
                showAlert('Failed to submit leave request', 'error');
            }
        } catch (error) {
            showAlert('Submission failed!', 'error');
        }
    };

    const downloadPDF = () => {
        const doc = new jsPDF();
        doc.text("Leave Records", 14, 22);
        autoTable(doc, {
            startY: 30,
            head: [['Staff ID', 'Leave Type', 'Start Date', 'End Date']],
            body: filteredLeaves.map(l => [
                l.staff_id,
                l.leave_type,
                new Date(l.start_date).toLocaleDateString(),
                new Date(l.end_date).toLocaleDateString()
            ]),
        });
        doc.save('leave_records.pdf');
    };

    return (
        <PageWrapper title="Manage Leave Requests">
            <div className="p-4 mb-5 rounded-3 bg-light border">
                <h4 className="mb-3 text-secondary">Apply for Leave on Behalf of Staff</h4>
                <form onSubmit={handleSubmit} className="row g-3 align-items-end">
                    <div className="col-md-3">
                        <label className="form-label fw-medium">Staff ID</label>
                        <input
                            type="text"
                            className="form-control"
                            name="staff_id"
                            value={formData.staff_id}
                            onChange={handleChange}
                            placeholder="Enter Staff ID"
                            required
                        />
                         {staffName && (
                            <div className="mt-1 text-primary small">{staffName}</div>
                        )}
                    </div>
                    <div className="col-md-3">
                        <label className="form-label fw-medium">Leave Type</label>
                        <select className="form-select" name="leave_type" value={formData.leave_type} onChange={handleChange} required>
                            <option value="">Select Type...</option>
                            <option value="Sick Leave">Sick Leave</option>
                            <option value="Casual Leave">Casual Leave</option>
                            <option value="Earned Leave">Earned Leave</option>
                            <option value="Maternity Leave">Maternity Leave</option>
                        </select>
                    </div>
                    <div className="col-md-2">
                        <label className="form-label fw-medium">Start Date</label>
                        <input type="date" className="form-control" name="start_date" value={formData.start_date} onChange={handleChange} required />
                    </div>
                    <div className="col-md-2">
                        <label className="form-label fw-medium">End Date</label>
                        <input type="date" className="form-control" name="end_date" value={formData.end_date} onChange={handleChange} required />
                    </div>
                    <div className="col-md-2">
                        <button className="btn btn-c-primary w-100" type="submit">Submit & Approve</button>
                    </div>
                </form>
            </div>

            <div className="p-4 rounded-3 bg-light border">
                <div className="d-flex justify-content-between mb-3">
                    <h4 className="text-secondary">View All Leave Requests</h4>
                    <button className="btn btn-outline-primary" onClick={downloadPDF}>
                        Download PDF
                    </button>
                </div>
                <div className="row g-3 align-items-end mb-4">
                    <div className="col-md-3 col-6">
                        <label className='form-label mb-1'>From Date:</label>
                        <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="col-md-3 col-6">
                        <label className='form-label mb-1'>To Date:</label>
                        <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="col-md-3 col-6">
                        <label className="form-label mb-1">Staff ID:</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Filter by Staff ID"
                            value={filterStaffId}
                            onChange={e => setFilterStaffId(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-responsive rounded-3">
                    <table className='table table-c align-middle mb-0'>
                        <thead className="table-secondary">
                            <tr>
                                <th>Staff ID</th>
                                <th>Leave Type</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLeaves.length > 0 ? filteredLeaves.map((leave) => (
                                <tr key={leave.leave_id}>
                                    <td>{leave.staff_id}</td>
                                    <td>{leave.leave_type}</td>
                                    <td>{new Date(leave.start_date).toLocaleDateString()}</td>
                                    <td>{new Date(leave.end_date).toLocaleDateString()}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan="4" className="text-center">No leave records found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </PageWrapper>
    );
}

export default HRLeaveManager;