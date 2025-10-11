import React, { useState, useEffect } from 'react';
import axios from '../axios';
import PdfTemplate from '../components/PdfTemplate';
import { useAlert } from '../components/AlertProvider';
import PageWrapper from '../components/PageWrapper';
import { useParams } from 'react-router-dom';

function IndividualAttendanceTable() {
  const { showAlert } = useAlert();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({ startDate: '', endDate: '' });
  const [records, setRecords] = useState([]);
  const [columnsToShow, setColumnsToShow] = useState([]);
  const [error, setError] = useState('');
  const [totalLateMins, setTotalLateMins] = useState(0);
  const [lateMins, setLateMins] = useState(0);
  const [fromDate, setFromDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingLateMins, setEditingLateMins] = useState({});
  const { staffId } = useParams();
  const [flaggedCells, setFlaggedCells] = useState({}); // new state for flagged times

  // Fetch flagged times for selected user
  const fetchFlagsForUser = async (employeeId, start, end) => {
    if (!employeeId) return;
    try {
      const response = await axios.post('/attendance/get_flags_for_staff', {
        staff_id: employeeId,
        start_date: start,
        end_date: end,
      });
      // Map flags to {staffId_date_time: true}
      const flags = {};
      const data = response.data || {};
      for (const key in data) flags[key] = true;
      setFlaggedCells(flags);
    } catch (err) {
      console.error('Failed to fetch flagged times', err);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await axios.get(`/attendance/search/query?q=${query}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    }
  };

  const handleSelectUser = async (user) => {
    try {
      const res = await axios.post('/attendance/search/getuser', { staffId: user.staff_id });
      const fullUser = res.data.staff;

      setSelectedUser(fullUser);

      // Reset states
      setSearchQuery('');
      setSearchResults([]);
      setRecords([]);
      setColumnsToShow([]);
      setTotalLateMins(0);
      setLateMins(0);
      setError('');

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const startDate = `2025-07-01`;
      const lastDay = new Date(yyyy, today.getMonth() + 1, 0).getDate();
      const endDate = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
      setFormData({ startDate, endDate });
    } catch (err) {
      console.error("Failed to fetch full user details:", err);
      showAlert("Failed to fetch user details", "danger");
    }
  };

  const fetchAttendance = async (employeeId, start, end) => {
    setError('');
    try {
      const res = await axios.post('/attendance/individual_data', {
        start_date: start,
        end_date: end,
        id: employeeId,
      });

      const { from, end: endRes, late_mins, total_late_mins, timing } = res.data;

      setFromDate(from || start);
      setEndDate(endRes || end);
      setLateMins(late_mins || 0);
      setTotalLateMins(total_late_mins || 0);

      if (!timing || timing.length === 0) {
        showAlert('No logs found', 'danger');
        setColumnsToShow([]);
        setRecords([]);
        return;
      }
      const allColumns = ['IN1', 'OUT1', 'IN2', 'OUT2', 'IN3', 'OUT3'];
      const visibleCols = allColumns.filter((col) => timing.some((row) => row[col]));
      setColumnsToShow(visibleCols);
      fetchFlagsForUser(employeeId, start, end);
      setRecords(timing || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch data.');
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateSubmit = (e) => {
    e.preventDefault();
    if (!selectedUser || !formData.startDate || !formData.endDate) return;
    fetchAttendance(selectedUser.staff_id, formData.startDate, formData.endDate);
  };

  const handleUpdateAdditional = async (date, value) => {
    let parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue) || parsedValue < 0) {
      parsedValue = 0;
    }
    if (parsedValue > 90) {
      parsedValue = 90;
    }
    try {
      const res = await axios.post('/attendance/update_additional_late_mins', {
        staff_id: selectedUser.staff_id,
        date,
        additional_late_mins: parsedValue,
      });
      showAlert(res.data.message || "Additional late minutes updated", "success");
      // Refetch to update totals and records
      if (selectedUser && formData.startDate && formData.endDate) {
        fetchAttendance(selectedUser.staff_id, formData.startDate, formData.endDate);
      }
    } catch (err) {
      console.error("Failed to update additional late minutes:", err);
      showAlert(err.response.data.message || "Failed to update additional late minutes", "danger");
    }
  };

  useEffect(() => {
    if (staffId) {
      // Fetch the user by ID
      const fetchUser = async () => {
        try {
          const res = await axios.post('/attendance/search/getuser', { staffId });
          const user = res.data.staff;
          handleSelectUser(user); // Reuse your existing function
        } catch (err) {
          console.error(err);
        }
      };
      fetchUser();
    }
  }, [staffId]);

  useEffect(() => {
    if (selectedUser && formData.startDate && formData.endDate) {
      fetchAttendance(selectedUser.staff_id, formData.startDate, formData.endDate);
    }
  }, [selectedUser, formData.startDate, formData.endDate]);

  const handleSaveAsPDF = () => {
    if (!selectedUser) return;
    const details = [
      { label: 'Name', value: selectedUser.name },
      { label: 'ID', value: selectedUser.staff_id },
      { label: 'Department', value: selectedUser.dept },
      { label: 'Category', value: selectedUser.category },
      { label: 'Designation', value: selectedUser.designation },
      { label: 'Email', value: selectedUser.email || 'No Email' },
      { label: 'Date Range', value: `${fromDate} to ${endDate}` },
      { label: `Late Minutes (Filtered)`, value: lateMins },
      { label: 'Late Minutes(Total)', value: totalLateMins },
    ];
    const tableColumn = ['Date', ...columnsToShow, 'Late Mins', 'Working Hours', 'Additional Late Mins'];

    const tableRows = records.map((rec) => [
      rec.date,
      ...columnsToShow.map((col) => rec[col] || '-'),
      rec.late_mins,
      rec.working_hours,
      rec.additional_late_mins || 0,
    ]);
    PdfTemplate({
      title: 'Biometric Attendance Report for ' + selectedUser.name,
      tables: [{ columns: tableColumn, data: tableRows }],
      details,
      fileName: `Attendance_${selectedUser.name || 'employee'}.pdf`,
    });
  };

  return (
    <PageWrapper>
      <div className="d-flex align-items-center justify-content-center position-relative mb-4">
        <h2 className="fw-bold text-c-primary mb-4">Individual User</h2>
        <button
          className="btn btn-c-primary btn-pdf"
          onClick={handleSaveAsPDF}
        >
          Download PDF
        </button>
      </div>
      <hr className="hr w-75 m-auto my-4" />

      <div className="mb-3 position-relative">
        <input
          type="text"
          className="form-control"
          placeholder="Search by User ID or Name"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {searchResults.length > 0 && (
          <div className="list-group position-absolute w-100 shadow-sm" style={{ zIndex: 10 }}>
            {searchResults.map((user) => (
              <button
                key={user.staff_id}
                type="button"
                className="list-group-item list-group-item-action"
                onClick={() => handleSelectUser(user)}
              >
                {user.name} ({user.staff_id})
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedUser && (
        <>
          <div className="border rounded p-4 bg-white mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div><strong>Name:</strong> {selectedUser.name}</div>
            <div><strong>ID:</strong> {selectedUser.staff_id}</div>
            <div><strong>Department:</strong> {selectedUser.dept}</div>
            <div><strong>Category:</strong> {selectedUser.category}</div>
            <div><strong>Designation:</strong> {selectedUser.designation}</div>
            <div><strong>Email:</strong> {selectedUser.email || "No Email"}</div>
            <div><strong>Late Minutes (filtered):</strong> {lateMins}</div>
            <div><strong>Total Late Minutes (since reset):</strong> {totalLateMins}</div>
          </div>

          <form className="mb-4 d-flex gap-3 align-items-end" onSubmit={handleDateSubmit}>
            <div>
              <label className="form-label">Start Date</label>
              <input type="date" className="form-control" name="startDate" value={formData.startDate} onChange={handleDateChange} required />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input type="date" className="form-control" name="endDate" value={formData.endDate} onChange={handleDateChange} required />
            </div>
          </form>

          {error && <div className="alert alert-danger">{error}</div>}

          {records.length > 0 && (
            <table className="table table-c mt-3">
              <thead className="table-secondary">
                <tr>
                  <th>Date</th>
                  {columnsToShow.map((col, i) => (
                    <th key={i}>{col}</th>
                  ))}
                  <th>Late Mins</th>
                  <th>Working Hours</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Additional Late Mins</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec, idx) => (
                  <tr key={idx}>
                    <td>{rec.date}</td>
                    {columnsToShow.map((col, i) => {
                      const timeValue = rec[col];
                      const key = `${selectedUser.staff_id}_${rec.date.split("-").reverse().join("-")}_${timeValue}`;
                      const isFlagged = flaggedCells[key];
                      return (
                        <td key={i} className={isFlagged ? 'table-warning' : ''}>
                          {timeValue || '-'}
                        </td>
                      );
                    })}
                    <td>{rec.late_mins}</td>
                    <td>{rec.working_hours}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="90"
                        value={editingLateMins[rec.date] ?? rec.additional_late_mins ?? 0}
                        onChange={(e) =>
                          setEditingLateMins((prev) => ({ ...prev, [rec.date]: e.target.value }))
                        }
                        onBlur={(e) => handleUpdateAdditional(rec.date, e.target.value)}
                        className="form-control form-control-sm text-center"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          )}
        </>
      )}
    </PageWrapper>
  );
}

export default IndividualAttendanceTable;