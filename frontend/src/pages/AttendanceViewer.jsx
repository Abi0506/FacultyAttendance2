import React, { useState, useEffect, useCallback } from 'react';
import axios from '../axios';
import PageWrapper from '../components/PageWrapper';
import PdfTemplate from '../components/PdfTemplate';
import { useAlert } from '../components/AlertProvider';
import { useLocation, useNavigate } from 'react-router-dom';

import Table from '../components/Table';


function AttendanceViewer() {
  const [selectedDate, setSelectedDate] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [columnsToShow, setColumnsToShow] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState({ key: 'IN1', direction: 'asc' });
  const [flaggedCells, setFlaggedCells] = useState({});
  const [isFlagMode, setIsFlagMode] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const { showAlert } = useAlert();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const message = params.get('message');
    if (message) {
      showAlert(message, 'success');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.search, showAlert]);

  // Handle row click to navigate to individual report
  const handleRowClick = (staff_id) => {
    if (isFlagMode) return; // Disable navigation in flag mode
    if (!staff_id) return;
    navigate(`/individual/${staff_id}`);
    window.scrollTo(0, 0);
  };

  // Initialize date
  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  const fetchAttendanceLogs = useCallback(async (date) => {
    if (!date) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/attendance/attendance_viewer', { date });
      const fetchedLogs = response.data || [];
      setLogs(fetchedLogs);
      setColumnsToShow(fetchedLogs[0] ? Object.keys(fetchedLogs[0]) : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load attendance data");
      setLogs([]);
      setColumnsToShow([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFlags = useCallback(async (date) => {
    if (!date) return;
    try {
      const response = await axios.post('/attendance/get_flags', { date });
      setFlaggedCells(response.data || {});
    } catch (err) {
      console.error("Failed to fetch flagged times", err);
    }
  }, []);

  const handleFlagTime = async (staff_id,selectedDate, timeValue) => {
    if (!isFlagMode) return;
    try {
      const response = await axios.post('/attendance/flag_time', {
        staff_id,
        date: selectedDate,
        time: timeValue
      });

      const key = `${staff_id}_${selectedDate}_${timeValue}`;
      setFlaggedCells(prev => {
        const newFlags = { ...prev };
        if (response.data.revoked) {
          delete newFlags[key];
          showAlert(`Flag revoked for ${staff_id}`, 'info');
        } else {
          newFlags[key] = true;
          showAlert(`Time flagged for ${staff_id}`, 'success');
        }
        return newFlags;
      });

    } catch (err) {
      console.error(err);
      showAlert("Failed to toggle flag", 'danger');
    }
  };

  const toggleFlagMode = () => {
    setIsFlagMode(prev => !prev);
    window.dispatchEvent(new Event('flagModeChanged'));
  }

  const handleSaveAsPDF = () => {
    const newDate = selectedDate.split('-').reverse().join('-');
    PdfTemplate({
      title: `Faculty Attendance Record - ${newDate}`,
      tables: [{
        columns: [...columnsToShow],
        data: sortedLogs.map(log => [...columnsToShow.map(col => log[col] || '-')])
      }],
      fileName: `Logs[${newDate}].pdf`
    });
  };

  useEffect(() => {
    fetchAttendanceLogs(selectedDate);
    fetchFlags(selectedDate);
  }, [selectedDate, fetchAttendanceLogs, fetchFlags]);

  const handleSort = (column) => {
    setSortConfig(prev => prev.key === column
      ? { key: column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { key: column, direction: 'asc' }
    );
  };

  const filteredLogs = logs.filter(log =>
    log.staff_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedLogs = React.useMemo(() => {
    let sortableLogs = [...filteredLogs];
    if (sortConfig.key) {
      sortableLogs.sort((a, b) => {
        let valA = a[sortConfig.key] ?? "";
        let valB = b[sortConfig.key] ?? "";
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableLogs;
  }, [filteredLogs, sortConfig]);

  return (
    <PageWrapper>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-center position-relative mb-4">
        <button
          className="refresh-btn"
          onClick={async () => {
            if (!selectedDate) return;
            try {
              setLoading(true);
              await fetchAttendanceLogs(selectedDate);
              showAlert('Data refreshed successfully', 'success');
            } catch (err) {
              showAlert('Data fetch failed', 'danger');
            } finally {
              setLoading(false);
            }
          }}
          title="Reload logs"
        >
          <i className="bi bi-arrow-clockwise fs-4"></i>
          <span className="refresh-text">Refresh</span>
        </button>

        <h2 className="fw-bold text-c-primary text-center m-0 flex-grow-1">Live Logs</h2>

        <button className="btn btn-c-primary btn-pdf" onClick={handleSaveAsPDF}>
          Download PDF
        </button>
      </div>

      <hr className="hr w-75 m-auto my-4" />

      {/* Controls */}
      <div className="d-flex flex-wrap align-items-center justify-content-between p-3 mb-2">
        {/* Date */}
        <div className="form-group me-3 d-flex align-items-center">
          <label htmlFor="date" className="form-label me-2 fw-semibold">Date:</label>
          <input
            type="date"
            id="date"
            className="form-control form-control-sm"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        {/* Rows */}
        <div className="d-flex align-items-center me-3">
          <label htmlFor="rowsPerPage" className="me-2 fw-semibold">Rows:</label>
          <select
            id="rowsPerPage"
            className="form-select form-select-sm"
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(parseInt(e.target.value))}
          >
            {[10, 25, 50, 100, 200].map(num => <option key={num} value={num}>{num}</option>)}
          </select>
        </div>

        {/* Staff search */}
        <div className="flex-grow-1 d-flex justify-content-end">
          <input
            type="text"
            className="form-control form-control-sm w-100"
            placeholder="Search by Staff ID or Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Flag Mode Button */}
      <div className="mb-4 text-start">
        <button
          className={`btn ${isFlagMode ? 'btn-danger' : 'btn-warning'}`}
          onClick={toggleFlagMode}
        >
          {isFlagMode ? 'Exit' : 'Flag Records'}
        </button>
      </div>

      {loading && <div className="text-center my-4">Loading...</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="d-flex align-items-center justify-content-between mt-4 mb-2">
        <div className="d-flex align-items-center gap-3">
          <div className="d-flex align-items-center">
            <div className='flag-indicator'></div>
            <span className="text-muted small">Flagged Records</span>
          </div>
        </div>
      </div>
      {/* Table */}
      <Table
        key="attendance-table"
        columns={columnsToShow}
        data={sortedLogs}
        sortConfig={sortConfig}
        onSort={handleSort}
        rowsPerPage={rowsPerPage}
        flaggedCells={flaggedCells}
        onFlagClick={handleFlagTime}
        isFlagMode={isFlagMode}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onRowClick={handleRowClick}
        selectedDate={selectedDate}
      />
    </PageWrapper>
  );
}

export default AttendanceViewer;
