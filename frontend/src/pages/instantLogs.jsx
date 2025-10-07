import React, { useState } from 'react';
import axios from '../axios';
import PageWrapper from '../components/PageWrapper';
import { useAlert } from '../components/AlertProvider';

function InstantLogs() {
    const { showAlert } = useAlert();
    const todayDate = new Date().toISOString().split('T')[0];

    const [selectedDate, setSelectedDate] = useState(todayDate);
    const [option, setOption] = useState('logs'); // 'logs' or 'report'
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResult('');

        try {
            const res = await axios.post('/instant_attendance/instant_logs', {
                date: selectedDate,
                type: option === 'logs' ? 'list': 'report'  // adjust type to Python backend
            });
            
            showAlert('Operation completed successfully', 'success');
        } catch (err) {
            console.error(err);
            showAlert(err.response?.data?.message || 'Operation failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageWrapper title="Instant Logs">
            <div className="p-4 rounded-3 bg-light border mb-4">
                <h4 className="mb-3 text-secondary">Run Instant Logs / Generate Report</h4>
                <form onSubmit={handleSubmit} className="row g-4">
                    <div className="col-md-4">
                        <label htmlFor="logDate" className="form-label fw-medium">Select Date</label>
                        <input
                            type="date"
                            id="logDate"
                            className="form-control"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            required
                        />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label fw-medium">Select Option</label>
                        <select
                            className="form-select"
                            value={option}
                            onChange={(e) => setOption(e.target.value)}
                        >
                            <option value="logs">Get Logs</option>
                            <option value="report">Generate Report</option>
                        </select>
                    </div>
                    <div className="col-12 d-flex justify-content-end align-items-end">
                        <button type="submit" className="btn btn-c-primary px-4 py-2" disabled={loading}>
                            {loading ? 'Processing...' : 'Run'}
                        </button>
                    </div>
                </form>

             
            </div>
        </PageWrapper>
    );
}

export default InstantLogs;
