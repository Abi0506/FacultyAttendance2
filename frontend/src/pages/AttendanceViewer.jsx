import React, { useState, useEffect, useCallback } from 'react';
import axios from '../axios';
import PageWrapper from '../components/PageWrapper';
import PdfTemplate from '../components/PdfTemplate';
import { useAlert } from '../components/AlertProvider';
import { useLocation } from 'react-router-dom';

function AttendanceViewer() {
  const [selectedDate, setSelectedDate] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [columnsToShow, setColumnsToShow] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
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

      const allColumns = ['IN1', 'OUT1', 'IN2', 'OUT2', 'IN3', 'OUT3'];
      const visibleCols = allColumns.filter(col =>
        fetchedLogs.some(row => row[col])
      );
      setColumnsToShow(visibleCols);

    } catch (error) {
      console.error('Error fetching logs:', error);
      setError("Failed to load attendance data");
      setLogs([]);
      setColumnsToShow([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const dd = String(today.getDate()).padStart(2, '0');

    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  }, []);


  useEffect(() => {
    getLogs(selectedDate);
    setCurrentPage(1);
  }, [selectedDate, getLogs]);

  // Sorting
  const handleSort = (column) => {
    setSortConfig((prev) => {
      setCurrentPage(1)
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


  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = sortedLogs.slice(indexOfFirstRow, indexOfLastRow);

  // set pages 
  useEffect(() => {
    setTotalPages(Math.ceil(filteredLogs.length / rowsPerPage));
    if (currentPage > Math.ceil(filteredLogs.length / rowsPerPage)) {
      setCurrentPage(1);
    }
  }, [filteredLogs, rowsPerPage]);

  const handleSaveAsPDF = () => {
    // Convert selectedDate to newDate format DD-MM-YYYY
    let newDate = selectedDate.split('-').reverse().join('-');
    PdfTemplate({
      title: 'Faculty Attendance Record - ' + newDate,
      tables: [{
        columns: ['Staff ID', 'Name', ...columnsToShow],
        data: sortedLogs.map((log) => [
          log.staff_id,
          log.name,
          ...columnsToShow.map(col => log[col] || '-')
        ])
      }],
      fileName: `logs[${newDate}].pdf`
    });
  };

  return (
    <PageWrapper>
      {/* Header with title centered and Save as PDF button on the right */}
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
          className="btn btn-c-primary position-absolute end-0 top-50 translate-middle-y"
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
              setCurrentPage(1);
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
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {loading && <div className="text-center my-4">Loading...</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-container" style={{ position: "relative" }}>
        <table className="table table-c">
          <thead className="table-secondary" style={{ position: "sticky", top: 0, zIndex: 2 }}>
            <tr>
              <th
                onClick={() => handleSort('staff_id')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                className="sortable-header"
              >
                Staff ID {sortConfig.key === 'staff_id' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
              </th>

              <th
                onClick={() => handleSort('name')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                className="sortable-header"
              >
                Name {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
              </th>

              {columnsToShow.map((col, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(col)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  className="sortable-header"
                >
                  {col} {sortConfig.key === col ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                </th>
              ))}


            </tr>
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
              currentRows.map((log) => (
                <tr key={log.staff_id}>
                  <td>{log.staff_id}</td>
                  <td>{log.name}</td>
                  {columnsToShow.map((col, i) => (
                    <td key={i}>{log[col] || '-'}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2 + columnsToShow.length} className="text-center">
                  {selectedDate ? "No records found" : "Please select a date"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={`justify-content-center my-3 ${totalPages === 1 ? 'd-none' : 'd-flex'}`}>
        <ul className="pagination">
          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
            <button
              className="page-link page-link-c"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            >
              &laquo;
            </button>
          </li>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
            <li
              key={num}
              className={`page-item ${num === currentPage ? 'active' : ''}`}
            >
              <button
                className="page-link shadow-none page-link-c"
                onClick={() => setCurrentPage(num)}
              >
                {num}
              </button>
            </li>
          ))}

          <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
            <button
              className="page-link"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            >
              &raquo;
            </button>
          </li>
        </ul>
      </div>
    </PageWrapper>
  );
}

export default AttendanceViewer;
