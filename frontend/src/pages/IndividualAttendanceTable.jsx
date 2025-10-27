import React, { useState, useEffect } from 'react';
import axios from '../axios';
import PdfTemplate from '../components/PdfTemplate';
import { useAlert } from '../components/AlertProvider';
import Table from '../components/Table';
import PageWrapper from '../components/PageWrapper';
import { useParams } from 'react-router-dom';
import { useMemo } from 'react';

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
  const [flaggedCells, setFlaggedCells] = useState({});
  const [approvedExemptionsMap, setApprovedExemptionsMap] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  const handleSort = (column) => {
    setSortConfig((prev) =>
      prev.key === column
        ? { key: column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key: column, direction: 'asc' }
    );
  };

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
  console.log("Flags response from /get_flags_for_staff:", response.data);
      const flags = {};
      const data = response.data || {};
      for (const key in data) flags[key] = true;
      console.log(flags)
      setFlaggedCells(flags);
    } catch (err) {
      console.error('Failed to fetch flagged times', err);
    }
  };

  const decideAttendanceDisplay = (rec) => {
    const dbAtt = (rec.attendance ?? '').toString().toUpperCase();
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
      const janFirst = new Date(yyyy, 0, 1);
      const julFirst = new Date(yyyy, 6, 1);
      const startDateObj = today >= julFirst ? julFirst : janFirst;

      const startDate = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`;
      const mm = String(today.getMonth() + 1).padStart(2, '0');
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
      fetchApprovedExemptionsForUser(employeeId, start, end);
      setRecords(timing || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch data.');
    }
  };

  const normalizeDateYMD = (d) => {
    if (!d) return d;
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
      const [day, month, year] = d.split('-');
      return `${year}-${month}-${day}`;
    }
    return d;
  };

  const normalizeDateDMY = (d) => {
    if (!d) return d;
    if (/^\d{2}-\d{2}-\d{4}$/.test(d)) return d;
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [year, month, day] = d.split('-');
      return `${day}-${month}-${year}`;
    }
    return d;
  };

  const fetchApprovedExemptionsForUser = async (employeeId, start, end) => {
    if (!employeeId) return;
    try {
      const res = await axios.post('/attendance/hr_approved_exemptions_for_staff', {
        start,
        end,
        id: employeeId,
      });
  console.log('Approved exemptions raw response:', res.data);
  const rows = res.data?.exemptions || res.data || [];
  console.log('Approved exemptions rows:', rows);
      const map = {};
      rows.forEach((r) => {
        const raw = r.exemptionDate || r.exemption_date || r.date || r.exemptionDate;
        if (!raw) return;
        const ymd = normalizeDateYMD(raw);
        const dmy = normalizeDateDMY(raw);
        const entry = { backgroundColor: '#fff3bf', note: 'Approved Exemption' };
        map[ymd] = entry;
        map[dmy] = entry;
      });
      setApprovedExemptionsMap(map);
    } catch (err) {
      console.error('Failed to fetch approved exemptions for user', err);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  useEffect(() => {
    if (selectedUser && formData.startDate && formData.endDate) {
      fetchAttendance(selectedUser.staff_id, formData.startDate, formData.endDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, formData.startDate, formData.endDate]);

  const handleSaveAsPDF = () => {
    if (!selectedUser) return;
    const details = [
      { label: 'Name', value: selectedUser.name },
      { label: 'ID', value: selectedUser.staff_id },
      { label: 'Department', value: selectedUser.dept },
      { label: 'Category', value: selectedUser.category_name },
      { label: 'Designation', value: selectedUser.designation },
      { label: 'Email', value: selectedUser.email || 'No Email' },
      { label: 'Date Range', value: `${formData.startDate} to ${formData.endDate}` },
      { label: `Late Minutes (Filtered)`, value: lateMins },
      { label: 'Late Minutes(Total)', value: totalLateMins },
    ];
    const tableColumn = ['Date', ...columnsToShow, 'Attendance', 'Late Mins', 'Working Hours', 'Additional Late Mins'];
    // Add Note column for approved exemptions
    const tableRows = records.map((rec) => {
      const recDate = (rec.date || '').toString();
      const ymd = normalizeDateYMD(recDate);
      const dmy = normalizeDateDMY(recDate);
      const match = approvedExemptionsMap[recDate] || approvedExemptionsMap[ymd] || approvedExemptionsMap[dmy];
      const note = match ? match.note : '-';
      return [
        rec.date,
        ...columnsToShow.map((col) => rec[col] || '-'),
        decideAttendanceDisplay(rec),
        rec.late_mins,
        rec.working_hours,
        rec.additional_late_mins || 0,
        note,
      ];
    });
    const tableColumnWithNote = [...tableColumn, 'Note'];
    PdfTemplate({
      title: 'Biometric Attendance Report for ' + selectedUser.name,
      tables: [{ columns: tableColumnWithNote, data: tableRows }],
      details,
      fileName: `Attendance_${selectedUser.name || 'employee'}.pdf`,
    });
  };
  const sortedRecords = useMemo(() => {
    if (!sortConfig.key) return records;

    const sorted = [...records].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

       if (sortConfig.key === 'date') {
      const parseDMY = (str) => {
        if (!str || typeof str !== 'string') return new Date('Invalid');
        const [d, m, y] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
      };

      const aDate = parseDMY(aValue);
      const bDate = parseDMY(bValue);

      if (aDate < bDate) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aDate > bDate) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    }
          // Handle numeric comparison
      if (!isNaN(aValue) && !isNaN(bValue)) {
        aValue = parseFloat(aValue);
        bValue = parseFloat(bValue);
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [records, sortConfig]);

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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (searchResults.length > 0) {
                handleSelectUser(searchResults[0]);
              }
            }
          }}
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
            <div><strong>Category:</strong> {selectedUser.category_name}</div>
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


          <Table
            columns={['date', ...columnsToShow, 'late_mins', 'additional_late_mins', 'working_hours', 'attendance']}
            data={sortedRecords}
            flaggedCells={flaggedCells}
            rowHighlightMap={approvedExemptionsMap}
            editableColumns={['additional_late_mins']}
            editConfig={{ min: -90, max: 90 }}
            onSort={handleSort}
            sortConfig={sortConfig}
            onEdit={(row, column, value, meta) => {
              if (meta.onBlur) handleUpdateAdditional(row.date, value);
              else {
                setEditingLateMins((prev) => ({ ...prev, [row.date]: value }));
              }
            }}
          />
        </>
      )
      }
    </PageWrapper >
  );
}

export default IndividualAttendanceTable;