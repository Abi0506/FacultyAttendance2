import React, { useState, useEffect } from 'react';
import axios from '../axios';
import PdfTemplate from '../components/PdfTemplate';
import { useAuth } from '../auth/authProvider';
import PageWrapper from '../components/PageWrapper';

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
  const [fromDate, setFromDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [flaggedCells, setFlaggedCells] = useState({});

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
        from,
        end,
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

      setFromDate(from || formData.startDate);
      setEndDate(end || formData.endDate);
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

  const fetchFlagsForStaff = async (recordsData) => {
    if (!formData.employeeId || !formData.startDate || !formData.endDate) return;
    try {
      const response = await axios.post('/attendance/get_flags_for_staff', {
        staff_id: formData.employeeId,
        start_date: formData.startDate,
        end_date: formData.endDate,
      });

      // Map flagged times to use {staffId_date_time: true}
      const flags = {};
      const data = response.data || {};
      for (const key in data) {
        flags[key] = true;
      }
      setFlaggedCells(flags);
    } catch (err) {
      console.error('Failed to fetch flagged times', err);
    }
  };

  const handleSaveAsPDF = () => {
    const details = [
      { label: 'Name', value: staffInfo.name || '' },
      { label: 'Designation', value: staffInfo.designation || '' },
      { label: 'Department', value: staffInfo.department || '' },
      { label: 'Date Range', value: `${fromDate} to ${endDate}` },
      { label: `Late Minutes (${fromDate} to ${endDate})`, value: lateMins },
      { label: 'Total Late Minutes (Since Previous Reset)', value: totalLateMins },
    ];

    const tableColumns = ['S.No', 'Date', ...columnsToShow, 'Late Mins', 'Working Hours'];
    const tableRows = records.map((rec, idx) => [
      idx + 1,
      rec.date,
      ...columnsToShow.map((col) => rec[col] || '-'),
      rec.late_mins,
      rec.additional_late_mins || 0,
      rec.working_hours,
    ]);

    PdfTemplate({
      title: 'Biometric Attendance Report for ' + staffInfo.name,
      tables: [{ columns: tableColumns, data: tableRows }],
      details,
      fileName: `Biometric Attendance_${staffInfo.name || 'employee'}.pdf`,
    });
  };

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
    if (formData.startDate && formData.endDate && formData.employeeId) {
      handleSubmit({ preventDefault: () => { } });
    }
    // eslint-disable-next-line
  }, [formData.startDate, formData.endDate, formData.employeeId]);

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

            <div>
              <span className="text-danger small fst-italic">
                If any record seems incorrect or missing, please report to HR.
              </span>
            </div>
          </div>

          <h4 className="mt-4 mb-3">Attendance Details for {fromDate} to {endDate}:</h4>
          <table className="table table-c mt-3">
            <thead className="table-secondary">
              <tr>
                <th>S.No</th>
                <th>Date</th>
                {columnsToShow.map((col, i) => <th key={i}>{col}</th>)}
                <th>Late Mins</th>
                <th>Additional Late Mins</th>
                <th>Working Hours</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={columnsToShow.length + 4} className="text-center">
                    No data available
                  </td>
                </tr>
              ) : (
                records.map((rec, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{rec.date}</td>
                    {columnsToShow.map((col, i) => {
                      const timeValue = rec[col];
                      const dateParts = rec.date.split('-');
                      const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
                      const key = `${formData.employeeId}_${formattedDate}_${timeValue}`;
                      const isFlagged = flaggedCells[key];
                      return (
                        <td key={i} className={isFlagged ? 'table-warning' : ''}>
                          {rec[col] || '-'}
                        </td>
                      );
                    })}

                    <td>{rec.late_mins}</td>
                    <td>{rec.additional_late_mins}</td>
                    <td>{rec.working_hours}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}
    </PageWrapper>
  );
}

export default IndividualStaffReport;
