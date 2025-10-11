import { useState } from 'react';
import axios from '../axios';
import PageWrapper from '../components/PageWrapper';
import { useAlert } from '../components/AlertProvider';

function InstantLogs() {
    const { showAlert } = useAlert();
    const todayDate = new Date().toISOString().split('T')[0];

    const [fromDate, setFromDate] = useState(todayDate);
    const [toDate, setToDate] = useState(todayDate);
    const [option, setOption] = useState('logs'); // 'logs' or 'report'
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const getDaysBetween = (from, to) => {
        const start = new Date(from);
        const end = new Date(to);
        const diff = end - start;
        return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (new Date(fromDate) > new Date(toDate)) {
            showAlert('From date must be before or equal to To date', 'error');
            return;
        }
        setLoading(true);
        setProgress(0);

        const totalDays = getDaysBetween(fromDate, toDate);
        let completed = 0;
        let errors = [];

        let current = new Date(fromDate);
        while (current <= new Date(toDate)) {
            const dateStr = current.toISOString().split('T')[0];
            try {
                const res = await axios.post('/instant_attendance/instant', {
                    date: dateStr,
                    type: option === 'logs' ? 'list' : 'report'
                });
                console.log(`Response for ${dateStr}:`, res);
                if (res.data.status !== "success") {
                    throw new Error(res.message || 'Operation failed');
                }
            } catch (err) {
                console.error(err);
                const msg = err.response?.data?.message || 'Operation failed';
                errors.push(`Error for ${dateStr}: ${msg}`);
            }
            completed++;
            setProgress(Math.round((completed / totalDays) * 100));
            current.setDate(current.getDate() + 1);
        }

        if (errors.length > 0) {
            showAlert('Some operations failed:\n' + errors.join('\n'), 'error');
        } else {
            showAlert('All operations completed successfully', 'success');
        }

        setLoading(false);
    };

    return (
        <PageWrapper title="Attendance Sync & Process">
            <div className="p-4 rounded-3 bg-light border mb-4">
                <h4 className="mb-3 text-secondary">Get Logs / Generate Report</h4>
                <form onSubmit={handleSubmit} className="row g-4">
                    <div className="col-md-4">
                        <label htmlFor="fromDate" className="form-label fw-medium">From Date</label>
                        <input
                            type="date"
                            id="fromDate"
                            className="form-control"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            required
                        />
                    </div>
                    <div className="col-md-4">
                        <label htmlFor="toDate" className="form-label fw-medium">To Date</label>
                        <input
                            type="date"
                            id="toDate"
                            className="form-control"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
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
                {loading && (
                    <div className="progress mt-3">
                        <div
                            className="progress-bar"
                            role="progressbar"
                            style={{ width: `${progress}%` }}
                            aria-valuenow={progress}
                            aria-valuemin="0"
                            aria-valuemax="100"
                        >
                            {progress}%
                        </div>
                    </div>
                )}
            </div>
        </PageWrapper>
    );
}

export default InstantLogs;