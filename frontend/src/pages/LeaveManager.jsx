import React, { useState, useEffect } from 'react';
import axios from '../axios';
// staff_id from useAuth is no longer needed here
import { useAlert } from '../components/AlertProvider';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PageWrapper from '../components/PageWrapper';

function LeaveManager() {
    const { showAlert } = useAlert();
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const [myLeaves, setMyLeaves] = useState([]);
    const [filteredLeaves, setFilteredLeaves] = useState([]);
    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);
    const [formData, setFormData] = useState({
        start_date: '',
        end_date: '',
        leave_type: ''
    });

    const fetchMyLeaves = async () => {
        try {
            // This request now automatically gets leaves for the logged-in user via the token
            const res = await axios.get("/leave"); 
            // The .filter() is removed because the backend now sends only this user's leaves
            setMyLeaves(res.data);
        } catch (error) {
            showAlert('Failed to fetch your leave records', 'error');
        }
    };

    useEffect(() => {
        // The dependency array is now empty to fetch once on component mount
        fetchMyLeaves();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    useEffect(() => {
        let filtered = myLeaves;
        if (startDate) {
            filtered = filtered.filter(leave => new Date(leave.start_date) >= new Date(startDate));
        }
        if (endDate) {
            filtered = filtered.filter(leave => new Date(leave.end_date) <= new Date(endDate));
        }
        setFilteredLeaves(filtered);
    }, [startDate, endDate, myLeaves]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.start_date || !formData.end_date || !formData.leave_type) {
            showAlert('Please fill all fields', 'warning');
            return;
        }
        try {
            const payload = {
                start_date: formData.start_date,
                end_date: formData.end_date,
                leave_type: formData.leave_type
            };

            const res = await axios.post("/leave", payload); 

            if (res.data.leave_id) {
                showAlert('Leave request submitted successfully!', 'success');
                fetchMyLeaves(); // Refresh the list
                setFormData({ start_date: '', end_date: '', leave_type: '' });
            } else {
                showAlert('Failed to submit leave request', 'error');
            }
        } catch (error) {
            showAlert(error.response?.data?.message || 'Submission failed!', 'error');
            console.error("Error submitting leave:", error);
        }
    };
    
    const downloadPDF = () => {
        const doc = new jsPDF();
        // The staff_id has been removed from the PDF title
        doc.text(`My Leave History`, 14, 22);
        autoTable(doc, {
            startY: 30,
            head: [['Leave Type', 'Start Date', 'End Date', 'Status']],
            body: filteredLeaves.map(l => [
                l.leave_type,
                new Date(l.start_date).toLocaleDateString(),
                new Date(l.end_date).toLocaleDateString(),
                l.status
            ]),
        });
        // The staff_id has been removed from the filename
        doc.save(`my_leave_history.pdf`);
    };

    return (
        <PageWrapper title="My Leave">
            <div className="p-4 mb-5 rounded-3 bg-light border">
                <h4 className="mb-3 text-secondary">Apply for Leave</h4>
                <form onSubmit={handleSubmit} className="row g-3">
                    <div className="col-md-4">
                        <label className="form-label fw-medium">Leave Type</label>
                        <select className="form-select" name="leave_type" value={formData.leave_type} onChange={handleChange} required>
                            <option value="">Select Type...</option>
                            <option value="Sick Leave">Sick Leave</option>
                            <option value="Casual Leave">Casual Leave</option>
                            <option value="Earned Leave">Earned Leave</option>
                            <option value="Maternity Leave">Maternity Leave</option>
                        </select>
                    </div>
                    <div className="col-md-3">
                        <label className="form-label fw-medium">Start Date</label>
                        <input type="date" className="form-control" name="start_date" value={formData.start_date} onChange={handleChange} required />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label fw-medium">End Date</label>
                        <input type="date" className="form-control" name="end_date" value={formData.end_date} onChange={handleChange} required />
                    </div>
                    <div className="col-md-2 d-flex align-items-end">
                        <button className="btn btn-c-primary w-100" type="submit">Submit Request</button>
                    </div>
                </form>
            </div>

            <div className="p-4 rounded-3 bg-light border">
                <div className="d-flex justify-content-between mb-3">
                    <h4 className="text-secondary">My Leave History</h4>
                     <button className="btn btn-outline-primary" onClick={downloadPDF}>
                        Download My History
                    </button>
                </div>
                 <div className="row g-3 align-items-end mb-4">
                    <div className="col-md-4 col-6">
                        <label className='form-label mb-1'>From Date:</label>
                        <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="col-md-4 col-6">
                        <label className='form-label mb-1'>To Date:</label>
                        <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                </div>
                <div className="table-responsive rounded-3">
                    <table className='table table-c align-middle mb-0'>
                        <thead className="table-secondary">
                            <tr>
                                <th>Leave Type</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                             {filteredLeaves.length > 0 ? filteredLeaves.map((leave) => (
                                <tr key={leave.leave_id}>
                                    <td>{leave.leave_type}</td>
                                    <td>{new Date(leave.start_date).toLocaleDateString()}</td>
                                    <td>{new Date(leave.end_date).toLocaleDateString()}</td>
                                    <td>
                                        {leave.status === 'approved' && <span className="badge bg-success">Approved</span>}
                                        {leave.status === 'rejected' && <span className="badge bg-danger">Rejected</span>}
                                        {leave.status === 'pending' && <span className="badge bg-warning text-dark">Pending</span>}
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="4" className="text-center">You have no leave records</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </PageWrapper>
    );
}

export default LeaveManager;