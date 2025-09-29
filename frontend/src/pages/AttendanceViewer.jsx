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
  const rowsPerPage = 25;
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
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  useEffect(() => {
    getLogs(selectedDate);
    setCurrentPage(1);
  }, [selectedDate, getLogs]);

  const handleSaveAsPDF = () => {
    PdfTemplate({
      title: 'Attendance Logs',
      tables: [{
        columns: ['Staff ID', 'Name', ...columnsToShow],
        data: filteredLogs.map((log) => [
          log.staff_id,
          log.name,
          ...columnsToShow.map(col => log[col] || '-')
        ])
      }],
      fileName: `logs[${selectedDate}].pdf`
    });
  };


  const filteredLogs = logs.filter(log =>
    log.staff_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const [isAtBottom, setIsAtBottom] = useState(false);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 1); // near bottom
  };

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredLogs.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage);

  return (
    <PageWrapper title="Live Logs">
      <div className="d-flex justify-content-between">
        {/* Date Picker */}
        <div className="form-group me-3 d-flex align-items-center">
          <label htmlFor="date" className="form-label me-2">Select Date:</label>
          <input
            type="date"
            className="form-control w-auto"
            id="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        {/* Search Bar */}
        <div className="flex-grow-1 d-flex justify-content-end align-items-center">
          <input
            type="text"
            className="form-control w-50"
            placeholder="Search by Staff ID or Name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // reset page on search
            }}
          />
        </div>
      </div>

      <button className="btn btn-outline-secondary mb-3" onClick={handleSaveAsPDF}>
        Save as PDF
      </button>

      {loading && <div className="text-center my-4">Loading...</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-container" style={{ position: "relative", maxHeight: "500px", overflowY: "auto" }} onScroll={handleScroll}>
        <table className="table table-c">
          <thead className="table-secondary" style={{ position: "sticky", top: 0, zIndex: 2 }}>
            <tr>
              <th>Staff ID</th>
              <th>Name</th>
              {columnsToShow.map((col, i) => (
                <th key={i}>{col}</th>
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
                <td colSpan="8" className="text-center">
                  {selectedDate ? "No records found" : "Please select a date"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="fade-bottom" style={{ opacity: isAtBottom ? 0 : 1 }}></div>
      </div>

      <div className="d-flex justify-content-center my-3">
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
