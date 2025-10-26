import React, { useState, useEffect, useMemo } from 'react';
import axios from '../axios';
import PdfTemplate from '../components/PdfTemplate';
import { useAuth } from '../auth/authProvider';
import PageWrapper from '../components/PageWrapper';
import Table from '../components/Table';

function IndividualStaffReport() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({ startDate: '', endDate: '', employeeId: '' });
  const [submitted, setSubmitted] = useState(false);
  const [staffInfo, setStaffInfo] = useState({ name: '', designation: '', department: '' });
  const [records, setRecords] = useState([]);
  const [columnsToShow, setColumnsToShow] = useState([]);
  const [error, setError] = useState('');
  const [totalLateMins, setTotalLateMins] = useState(0);
  const [totalAbsentDays, setTotalAbsentDays] = useState(0);
  const [lateMins, setLateMins] = useState(0);
  // const [fromDate, setFromDate] = useState('');
  // const [endDate, setEndDate] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [flaggedCells, setFlaggedCells] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'Date', direction: 'desc' });
  const [viewMode, setViewMode] = useState('Combined'); // New state for dropdown selection
  const [isLoading, setIsLoading] = useState(true); // New state for loader
  const columnKeyMap = {
    "Date": "date",
    "Late Mins": "late_mins",
    "Additional Late Mins": "additional_late_mins",
    "Working Hours": "working_hours",
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    setSubmitted(false);

    try {
      const res = await axios.post('/attendance/individual_data', {
        start_date: formData.startDate,
        end_date: formData.endDate,
        id: formData.employeeId,
      });

      const {
        // from,
        // end,
        late_mins,
        total_late_mins,
        data, total_absent_days,
        timing
      } = res.data;

      const employee = data[0] || {};
      const recordsData = timing || [];

      setStaffInfo({
        name: employee.name || '',
        designation: employee.designation || '',
        department: employee.dept || '',
      });

      const allColumns = ['IN1', 'OUT1', 'IN2', 'OUT2', 'IN3', 'OUT3'];
      const visibleCols = allColumns.filter((col) => recordsData.some((row) => row[col]));

      // setFromDate(from || formData.startDate);
      // setEndDate(end || formData.endDate);
      setLateMins(late_mins || 0);
      setTotalLateMins(total_late_mins || 0);
      setTotalAbsentDays(total_absent_days || 0);
      setColumnsToShow(visibleCols);
      setRecords(recordsData);
      setSubmitted(true);
      fetchFlagsForStaff(recordsData);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch data.');
      setSubmitted(false);
      setRecords([]);
    }
  };

  // Decide how to display attendance in UI/PDF: show 'N/A' when DB value is 'I' or there is exactly one log present.
  // Do NOT convert zero-log days to N/A (keep DB attendance such as 'A').
  const decideAttendanceDisplay = (rec) => {
    if (rec.attendance) rec.attendance ?? ''.toString().toUpperCase();
    const dbAtt = (rec.attendance).toString().toUpperCase();
    // count non-empty time cells among columnsToShow
    const timeCount = columnsToShow.reduce((acc, col) => {
      const v = rec[col];
      if (v && v !== '---') return acc + 1;
      return acc;
    }, 0);
    // Show N/A when DB explicitly marks 'I'
    if (dbAtt === 'I') return 'N/A';
    // For a single log, only show N/A when DB indicates present (P) or is missing.
    if (timeCount === 1 && (dbAtt === 'P' || !rec.attendance)) return 'N/A';
    return dbAtt;
  };

  const fetchFlagsForStaff = async (recordsData) => {
    if (!formData.employeeId || !formData.startDate || !formData.endDate) return;
    try {
      const response = await axios.post('/attendance/get_flags_for_staff', {
        staff_id: formData.employeeId,
        start_date: formData.startDate,
        end_date: formData.endDate,
      });
      const flags = response.data || {};
      console.log(flags)
      setFlaggedCells(flags);
    } catch (err) {
      console.error('Failed to fetch flagged times', err);
    }
  };

  const handleSaveAsPDF = () => {
    const { columns, data } = getTableColumnsAndData(); // Use the current table view and data

    const formatDate = (date) => date;

    // Add "Staff ID" and "Name" at the start
    const pdfColumns = ['Staff ID', 'Name', ...columns];

    // Map each row, prepending staff_id and name
    const tableRows = data.map((row) => [
      formData.employeeId || '-',            // Staff ID
      staffInfo.name || '-',                 // Staff Name
      ...columns.map((col) => row[col] || '-') // Rest of data
    ]);

    const details = [
      { label: 'Name', value: staffInfo.name || '' },
      { label: 'Designation', value: staffInfo.designation || '' },
      { label: 'Department', value: staffInfo.department || '' },
      { label: `Late Minutes (${formatDate(formData.startDate)} to ${formatDate(formData.endDate)})`, value: lateMins },
      { label: 'Total Late Minutes (Since Previous Reset)', value: totalLateMins },
      { label: 'Total Days to be Deducted', value: totalAbsentDays },
    ];

    console.log(flaggedCells);

    PdfTemplate({
      title: 'Biometric Attendance Report for ' + staffInfo.name,
      tables: [{ columns: pdfColumns, data: tableRows }],
      details,
      fileName: `Biometric Attendance_${staffInfo.name || 'employee'}.pdf`,
      flaggedCells,
    });
  };


  const handleSort = (column) => {
    setSortConfig((prev) =>
      prev.key === column
        ? { key: column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key: column, direction: 'asc' }
    );
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sortedRecords = useMemo(() => {
    if (!sortConfig.key) return records;

    const realKey = columnKeyMap[sortConfig.key] || sortConfig.key; // map label to data key
    const sorted = [...records].sort((a, b) => {
      let aValue = a[realKey] ?? '';
      let bValue = b[realKey] ?? '';

      if (realKey === 'date') {
        // Handle DD-MM-YYYY format properly
        const parseDDMMYYYY = (str) => {
          if (!str || typeof str !== 'string') return new Date('Invalid');
          const [day, month, year] = str.split('-');
          return new Date(`${year}-${month}-${day}`);
        };
        aValue = parseDDMMYYYY(aValue);
        bValue = parseDDMMYYYY(bValue);
      }
      else if (typeof aValue === 'string' && aValue.includes(':')) {
        // handle time strings like '09:45'
        aValue = aValue === '-' ? '00:00' : aValue;
        bValue = bValue === '-' ? '00:00' : bValue;
      } else if (!isNaN(parseFloat(aValue)) && !isNaN(parseFloat(bValue))) {
        aValue = parseFloat(aValue);
        bValue = parseFloat(bValue);
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, sortConfig]);

  const handleViewChange = (e) => {
    setViewMode(e.target.value);
  };

  const getTableColumnsAndData = () => {
    switch (viewMode) {
      case 'Logs':
        return {
          columns: ['Date', ...columnsToShow],
          data: sortedRecords.map((rec) => ({
            Date: rec.date, // Format the date
            ...columnsToShow.reduce((acc, col) => ({ ...acc, [col]: rec[col] || '-' }), {}),
            staff_id: formData.employeeId, // Still passing staff_id to each row
          })),
        };
      case 'Calculated':
        return {
          columns: ['Date', 'Attendance', 'Late Mins', 'Additional Late Mins', 'Working Hours'],
          data: sortedRecords.map((rec) => ({
            Date: rec.date, // Format the date
            Attendance: decideAttendanceDisplay(rec),
            'Late Mins': rec.late_mins,
            'Additional Late Mins': rec.additional_late_mins || 0,
            'Working Hours': rec.working_hours,
            staff_id: formData.employeeId, // Still passing staff_id to each row
          })),
        };
      default:
        return {
          columns: ['Date', ...columnsToShow, 'Attendance', 'Late Mins', 'Additional Late Mins', 'Working Hours'],
          data: sortedRecords.map((rec) => ({
            Date: rec.date,
            ...columnsToShow.reduce((acc, col) => ({ ...acc, [col]: rec[col] || '-' }), {}),
            Attendance: decideAttendanceDisplay(rec),
            'Late Mins': rec.late_mins,
            'Additional Late Mins': rec.additional_late_mins || 0,
            'Working Hours': rec.working_hours,
            staff_id: formData.employeeId, // Still passing staff_id to each row
          })),
        };
    }
  };

  const { columns, data } = getTableColumnsAndData();

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const janFirst = new Date(yyyy, 0, 1);
    const julFirst = new Date(yyyy, 6, 1);
    const startDateObj = today >= julFirst ? julFirst : janFirst;

    const startDate = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`;
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(yyyy, today.getMonth() + 1, 0).getDate();
    const endDate = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;

    const empId = user.staffId || '';
    setFormData((prev) => ({
      ...prev,
      startDate,
      endDate,
      employeeId: empId,
    }));
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (formData.startDate && formData.endDate && formData.employeeId) {
          await handleSubmit({ preventDefault: () => { } });
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line
  }, [formData.startDate, formData.endDate, formData.employeeId]);

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="d-flex align-items-center justify-content-center position-relative mb-4">
        <h2 className="fw-bold text-c-primary text-center m-0 flex-grow-1">
          Attendance Report for {staffInfo.name}
        </h2>
        <button className="btn btn-c-primary btn-pdf" onClick={handleSaveAsPDF}>
          Download PDF
        </button>
      </div>

      <hr className="hr w-75 m-auto my-4" />

      <form className="mb-4">
        <div className="row mb-3">
          <div className="col">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-control"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              required
            />
          </div>
          <div className="col">
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-control"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              required
            />
          </div>
        </div>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}

      {submitted && (
        <>
          <div className="mb-4">
            <div className="border rounded p-3 bg-white d-flex flex-wrap gap-4 align-items-center justify-content-start">
              <div className="col-md-6">
                <span className="fw-semibold">Late Minutes (Filtered): </span> {lateMins}
              </div>
              <div className="col-md-6">
                <span className="fw-semibold">Total Late Minutes (Since Prev. Reset): </span>{totalLateMins}
              </div>
              <div className="col-md-6">
                <span className="fw-semibold">Total days to be Deducted:</span>{totalAbsentDays}
              </div>
            </div>
          </div>
          <div className="d-flex align-items-center justify-content-between mt-4 mb-2">
            <div className="d-flex align-items-center gap-3">
              <div className="d-flex align-items-center">
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#fff3cd',
                    border: '1px solid #e0a800',
                    borderRadius: '4px',
                    marginRight: '8px',
                  }}
                ></div>
                <span className="text-muted small">Flagged Record</span>
              </div>
            </div>


          </div>
          <div className="d-flex align-items-center justify-content-between mt-4 mb-3">
            <h4 className="m-0">
              Records from {formData.startDate} to {formData.endDate}:
            </h4>
            <div className="d-flex align-items-center gap-3">
              <div className="d-flex align-items-center">
                <label htmlFor="viewMode" className="me-2 fw-semibold mb-0">View:</label>
                <select
                  id="viewMode"
                  className="form-select form-select-sm w-auto"
                  value={viewMode}
                  onChange={handleViewChange}
                  style={{ minWidth: '120px' }}
                >
                  <option value="Combined">Combined</option>
                  <option value="Logs">Logs</option>
                  <option value="Calculated">Calculated</option>
                </select>
              </div>
              <div className="d-flex align-items-center">
                <label htmlFor="rowsPerPage" className="me-2 fw-semibold mb-0">Rows per page:</label>
                <select
                  id="rowsPerPage"
                  className="form-select form-select-sm w-auto"
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(parseInt(e.target.value))}
                  style={{ minWidth: '80px' }}
                >
                  {[10, 25, 50, 100, 200].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <Table
            columns={columns}
            data={data}
            sortConfig={sortConfig}
            onSort={handleSort}
            selectedDate={formData.startDate}
            flaggedCells={flaggedCells}
            rowsPerPage={rowsPerPage}
          />
          <div>
            <span className="text-danger small fst-italic float-end pb-2">
              If any record seems incorrect or missing, please report to HR.
            </span>
          </div>
        </>
      )}
    </PageWrapper>
  );
}

export default IndividualStaffReport;
