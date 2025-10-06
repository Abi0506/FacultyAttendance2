import React, { useState, useEffect } from 'react';
import axios from '../axios';
import PdfTemplate from '../components/PdfTemplate';
import { useAuth } from '../auth/authProvider';
import PageWrapper from '../components/PageWrapper';

function IndividualAttendanceTable() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({ startDate: '', endDate: '', employeeId: '' });
  const [submitted, setSubmitted] = useState(false);
  const [staffInfo, setStaffInfo] = useState({ name: '', designation: '', department: '' });
  const [records, setRecords] = useState([]);
  const [columnsToShow, setColumnsToShow] = useState([]);
  const [error, setError] = useState('');
  const [totalLateMins, setTotalLateMins] = useState(0);
  const [totalAbsentDays, setTotalAbsentDays] = useState(0);
  const [absentDays, setAbsentDays] = useState(0);
  const [lateMins, setLateMins] = useState(0);
  const [markedDays, setMarkedDays] = useState(0);
  const [fromDate, setFromDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitted(false);

    try {
      const res = await axios.post('/attendance/individual_data', {
        start_date: formData.startDate,
        end_date: formData.endDate,
        id: formData.employeeId,
      });
      console.log(res.data);

      const { from, end, late_mins, total_absent_days, absent_days, total_late_mins, marked_days, data, timing } = res.data;

      const employee = data[0] || {};

      setStaffInfo({
        name: employee.name || '',
        designation: employee.designation || '',
        department: employee.dept || '',
      });

      const allColumns = ['IN1', 'OUT1', 'IN2', 'OUT2', 'IN3', 'OUT3'];
      const visibleCols = allColumns.filter((col) => timing.some((row) => row[col]));

      setFromDate(from || formData.startDate);
      setEndDate(end || formData.endDate);
      setLateMins(late_mins || 0);
      setAbsentDays(absent_days || 0);
      setTotalLateMins(total_late_mins || 0);
      setTotalAbsentDays(total_absent_days || 0);
      setMarkedDays(marked_days || 0);
      setColumnsToShow(visibleCols);
      setRecords(timing || []);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch data.');
      setSubmitted(false);
      setRecords([]);
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
    const tableColumn = ['S.No', 'Date', ...columnsToShow, 'Late Mins', 'Working Hours'];
    const tableRows = records.map((rec, idx) => [
      idx + 1,
      rec.date,
      ...columnsToShow.map((col) => rec[col] || '-'),
      rec.late_mins,
      rec.working_hours,
    ]);
    PdfTemplate({
      title: 'Attendance Report for ' + (staffInfo.name),
      tables: [{ columns: tableColumn, data: tableRows }],
      details,
      fileName: `attendance_${staffInfo.name || 'employee'}.pdf`,
    });
  };

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const startDate = `2025-07-01`;
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
    <PageWrapper >
      <div className="d-flex align-items-center justify-content-center position-relative mb-4">
        <h2 className="fw-bold text-c-primary text-center m-0 flex-grow-1">Attendance Report for {staffInfo.name}</h2>
        <button
          className="btn btn-c-primary btn-pdf"
          onClick={handleSaveAsPDF}
        >
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
              {/* <div className="col-md-4">
                <div className="fw-semibold">Designation:</div>
                <div className="fs-6">{staffInfo.designation}</div>
              </div>
              <div className="col-md-4">
                <div className="fw-semibold">Department:</div>
                <div className="fs-6">{staffInfo.department}</div>
              </div> */}
              <div className="col-md-6">
                <span className="fw-semibold">Late Minutes (Filtered): </span> {lateMins}
              </div>
              <div className="col-md-6">
                <span className="fw-semibold">Total Late Minutes (Since Prev. Reset): </span>{totalLateMins}
              </div>
            </div>
          </div>

          <h4 className="mt-4 mb-3">Attendance Details for {fromDate} to {endDate}:</h4>
          <table className="table table-c mt-3">
            <thead className="table-secondary">
              <tr>
                <th>S.No</th>
                <th>Date</th>
                {columnsToShow.map((col, i) => (
                  <th key={i}>{col}</th>
                ))}
                <th>Late Mins</th>
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
                    {columnsToShow.map((col, i) => (
                      <td key={i}>{rec[col] || '-'}</td>
                    ))}
                    <td>{rec.late_mins}</td>
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

export default IndividualAttendanceTable;
