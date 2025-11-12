import React, { useState, useEffect, useMemo } from 'react';
import axios from '../axios';
import { useAlert } from '../components/AlertProvider';
import PageWrapper from '../components/PageWrapper';
import Table from '../components/Table';

function HolidayManager() {
  const { showAlert } = useAlert();

  // Default date range: current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0];

  // State
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });
  const [records, setRecords] = useState([]);
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [formData, setFormData] = useState({ holiday: '', reason: '' });

  // Column mapping
  const columnKeyMap = {
    date: 'date',
    reason: 'reason',
  };

  // Sorting logic
  const sortedRecords = useMemo(() => {
    if (!sortConfig.key) return records;

    const realKey = columnKeyMap[sortConfig.key] || sortConfig.key;
    const sorted = [...records].sort((a, b) => {
      let aValue = a[realKey] ?? '';
      let bValue = b[realKey] ?? '';

      if (realKey === 'date') {
        const parseDate = (str) => {
          if (!str || typeof str !== 'string') return new Date('Invalid');
          if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str);
          if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
            const [day, month, year] = str.split('-');
            return new Date(`${year}-${month}-${day}`);
          }
          return new Date(str);
        };
        aValue = parseDate(aValue);
        bValue = parseDate(bValue);
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [records, sortConfig]);

  // Fetch holidays (from backend)
  const fetchHolidays = async () => {
    try {
      const res = await axios.post('/attendance/get_holiday_list', {
        start_date: startDate,
        end_date: endDate,
      });
      if (res.data.success) {
        setRecords(res.data.holidays || []);
      } else {
        showAlert('Failed to fetch holidays', 'error');
      }
    } catch (err) {
      console.error('Holiday fetch error:', err);
      showAlert('Error fetching holidays', 'error');
    }
  };

  useEffect(() => {
    fetchHolidays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // Handle add holiday form
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!formData.holiday || !formData.reason) {
    showAlert('Please enter both date and reason', 'warning');
    return;
  }

  try {
    const res = await axios.post('/attendance/add_holiday', formData);
    if (res.data.success) {
      showAlert('Holiday added successfully', 'success');

      // Create new record entry
      const newRecord = {
        date: formData.holiday,
        reason: formData.reason
      };

      // Add dynamically to table without full reload
      setRecords((prev) => [...prev, newRecord]);

      // Reset form
      setFormData({ holiday: '', reason: '' });
    } else {
      showAlert(res.data.message || 'Failed to add holiday', 'error');
    }
  } catch (err) {
    console.error(err);
    showAlert(err.response?.data?.message || 'Error adding holiday', 'error');
  }
};


  // Handle sorting clicks
  const handleSort = (col) => {
    setSortConfig((prev) => {
      if (prev.key === col) {
        return { key: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key: col, direction: 'asc' };
    });
  };

  return (
    <PageWrapper title="Holiday Manager">
      <div className="p-4 rounded-3 bg-light border mt-4">
  <h4 className="text-secondary mb-3">Google Calendar View</h4>
  <div style={{ border: "1px solid #ddd", borderRadius: "8px", overflow: "hidden" }}>
    <iframe
      title="Google Holiday Calendar"
      src="https://calendar.google.com/calendar/embed?src=c_f65646ec47f509e6a093824790c28766188222d525707dfb817f80ac21e9e24c%40group.calendar.google.com&ctz=Asia%2FKolkata" 
      style={{ border: 0, width: "100%", height: "600px" }}
      frameBorder="0"
      scrolling="no"
    ></iframe>
  </div>
</div>

      <div className="p-4 mb-5 rounded-3 bg-light border mt-4">
        <h4 className="mb-3 text-secondary">Add New Holiday</h4>
        <form onSubmit={handleSubmit} className="row g-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label fw-medium">Holiday Date</label>
            <input
              type="date"
              className="form-control"
              name="holiday"
              value={formData.holiday}
              onChange={handleChange}
              required
            />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-medium">Reason</label>
            <input
              type="text"
              className="form-control"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Enter reason"
              required
            />
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-c-primary w-100">
              Add Holiday
            </button>
          </div>
        </form>
      </div>

      {/* Holiday List */}
      <div className="p-4 rounded-3 bg-light border">
        <div className="d-flex justify-content-between mb-3">
          <h4 className="text-secondary">Holiday List</h4>
        </div>
        <div className="row g-3 align-items-end mb-4">
          <div className="col-md-4 col-6">
            <label className="form-label mb-1">From Date:</label>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="col-md-4 col-6">
            <label className="form-label mb-1">To Date:</label>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div className="table-responsive rounded-3">
          <Table
            columns={['date', 'reason']}
            data={sortedRecords}
            sortConfig={sortConfig}
            onSort={handleSort}
            rowsPerPage={10}
          />
        </div>
      </div>
    </PageWrapper>
  );
}

export default HolidayManager;
