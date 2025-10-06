import React, { useState, useEffect, useCallback } from 'react';
import axios from '../axios';
import PageWrapper from '../components/PageWrapper';
import PdfTemplate from '../components/PdfTemplate';
import Table from '../components/Table';
import { useAlert } from '../components/AlertProvider';
import { useLocation } from 'react-router-dom';

function AttendanceViewer() {
  const [selectedDate, setSelectedDate] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [columnsToShow, setColumnsToShow] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState({ key: 'IN1', direction: 'asc' });

  const { showAlert } = useAlert();
  const location = useLocation();

  // Message as alert
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const message = params.get('message');
    if (message) {
      showAlert(message, 'success');
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [location.search, showAlert]);

  const getLogs = useCallback(async (date) => {
    if (!date) return;

    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/attendance/attendance_viewer', { date });
      const fetchedLogs = response.data || [];
      setLogs(fetchedLogs);

      const allColumns = fetchedLogs[0] ? Object.keys(fetchedLogs[0]) : [];
      setColumnsToShow(allColumns);

    } catch (error) {
      console.error('Error fetching logs:', error);
      setError("Failed to load attendance data");
      setLogs([]);
      setColumnsToShow([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Convert date format
  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const dd = String(today.getDate()).padStart(2, '0');

    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  }, []);


  useEffect(() => {
    getLogs(selectedDate);
  }, [selectedDate, getLogs]);

  // Sorting
  const handleSort = (column) => {
    setSortConfig((prev) => {
      if (prev.key === column) {
        return { key: column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key: column, direction: 'asc' };
    });
  };

  const filteredLogs = logs.filter(log =>
    log.staff_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedLogs = React.useMemo(() => {
    let sortableLogs = [...filteredLogs];
    if (sortConfig.key) {
      sortableLogs.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        // Move non-empty above empty
        if (!valA && valB) return 1;
        if (valA && !valB) return -1;
        if (!valA && !valB) return 0;

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableLogs;
  }, [filteredLogs, sortConfig]);

  const handleSaveAsPDF = () => {
    // Convert selectedDate to newDate format DD-MM-YYYY
    let newDate = selectedDate.split('-').reverse().join('-');
    PdfTemplate({
      title: 'Faculty Attendance Record - ' + newDate,
      tables: [{
        columns: [...columnsToShow],
        data: sortedLogs.map((log) => [
          ...columnsToShow.map(col => log[col] || '-')
        ])
      }],
      fileName: `logs[${newDate}].pdf`
    });
  };

  return (
    <PageWrapper>
      <div className="d-flex align-items-center justify-content-center position-relative mb-4">
        <button
          className="refresh-btn"
          onClick={async () => {
            if (!selectedDate) return;
            try {
              setLoading(true);
              await getLogs(selectedDate);
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

        {/* Title centered */}
        <h2 className="fw-bold text-c-primary text-center m-0 flex-grow-1">Live Logs</h2>

        {/* Save as PDF button on the right */}
        <button
          className="btn btn-c-primary btn-pdf"
          onClick={handleSaveAsPDF}
        >
          Download PDF
        </button>
      </div>


      <hr className="hr w-75 m-auto my-4" />

      <div className="d-flex flex-wrap align-items-center justify-content-between p-3 mb-4">
        {/* Date Picker */}
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

        {/* Rows per Page */}
        <div className="d-flex align-items-center me-3">
          <label htmlFor="rowsPerPage" className="me-2 fw-semibold">Rows:</label>
          <select
            id="rowsPerPage"
            className="form-select form-select-sm"
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(parseInt(e.target.value));
            }}
          >
            {[10, 25, 50, 100, 200].map(num => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex-grow-1 d-flex justify-content-end">
          <input
            type="text"
            className="form-control form-control-sm w-100"
            placeholder="Search by Staff ID or Name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
          />
        </div>
      </div>

      {loading && <div className="text-center my-4">Loading...</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <Table
        columns={columnsToShow}
        data={sortedLogs}
        sortConfig={sortConfig}
        onSort={handleSort}
        selectedDate={selectedDate}
        rowsPerPage={rowsPerPage}
      />
    </PageWrapper>
  );
}

export default AttendanceViewer;
