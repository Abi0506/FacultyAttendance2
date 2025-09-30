import React, { useState, useEffect, useCallback } from 'react';
import axios from '../axios';
import PageWrapper from '../components/PageWrapper';
import PdfTemplate from '../components/PdfTemplate';

function DepartmentSummary() {
    const [mainCategory, setMainCategory] = useState('');
    const [selectedDept, setSelectedDept] = useState('');
    const [summaryData, setSummaryData] = useState({});
    const [date, setDate] = useState([]);
    // Auto-fill startDate as 1st of current month, endDate as today
    function getDefaultStartDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}-01`;
    }
    function getDefaultEndDate() {
        return new Date().toISOString().split('T')[0];
    }
    const [startDate, setStartDate] = useState(getDefaultStartDate());
    const [endDate, setEndDate] = useState(getDefaultEndDate());
    const [totalMarkedDaysCol, setTotalMarkedDaysCol] = useState('Total Marked Days');

    const allDepartments = ["CSE", "ECE", "MECH"];
    const nonTeachingDepartments = ["ADMIN", "LIBRARY", "ECE", "CSE"];
    const departments = [
        "ALL",
        "Teaching Staff",
        "Non Teaching Staff",
        "Department Wise"
    ];

    const getSubDepartments = () => {
        if (mainCategory === 'Teaching Staff') return allDepartments;
        if (mainCategory === 'Non Teaching Staff') return nonTeachingDepartments;
        if (mainCategory === 'Department Wise') return allDepartments;
        return [];
    };

    const fetchDeptSummary = useCallback(async () => {
        if (!mainCategory || (mainCategory !== "ALL" && mainCategory !== "Department Wise" && selectedDept === "")) {
            setSummaryData({});
            return;
        }

        let categoryToSend = mainCategory;
        let deptToSend = "";

        if (mainCategory === "Department Wise" && selectedDept) {
            deptToSend = selectedDept;
            categoryToSend = "";
        } else if (
            (mainCategory === "Teaching Staff" || mainCategory === "Non Teaching Staff") &&
            selectedDept && selectedDept !== "ALL"
        ) {
            deptToSend = selectedDept;
        } else if (mainCategory === "ALL") {
            categoryToSend = "ALL";
        }

        try {
            const response = await axios.post('/attendance/dept_summary', {
                category: categoryToSend,
                dept: deptToSend,
                start_date: startDate,
                end_date: endDate
            });
            console.log('API response:', response.data);
            setSummaryData(response.data.data || {});
            setDate(response.data.date || []);
            setTotalMarkedDaysCol(response.data.total_marked_days_col || 'Total Marked Days');
        } catch (error) {
            console.error("Error fetching summary:", error);
            setSummaryData({});
            setDate([]);
        }
    }, [mainCategory, selectedDept, startDate, endDate]);

    useEffect(() => {
        if (!startDate) setStartDate(getDefaultStartDate());
        if (!endDate) setEndDate(getDefaultEndDate());
        if (mainCategory && (mainCategory === "ALL" || selectedDept !== "") && startDate && endDate) {
            if (new Date(endDate) >= new Date(startDate)) {
                fetchDeptSummary();
            } else {
                setSummaryData({});
                setDate([]);
            }
        } else {
            setSummaryData({});
            setDate([]);
        }
    }, [mainCategory, selectedDept, startDate, endDate, fetchDeptSummary]);

    const handleSaveAsPDF = () => {
        const title = `Department-wise Summary (${date[0]} to ${date[1]})`;
        const tableHeaders = [
            'Employee Name',
            'Employee ID',
            'Designation',
            `Late Minutes (${date[0]} to ${date[1]})`,
            `Absent Days (${date[0]} to ${date[1]})`,
            'Total Late Minutes',
            'Total Absent Days',
            totalMarkedDaysCol
        ];

        if (mainCategory === "ALL") {
            const tables = [];
            Object.entries(summaryData).forEach(([category, depts]) => {
                Object.entries(depts).forEach(([deptName, employees]) => {
                    tables.push({
                        columns: tableHeaders,
                        data: Array.isArray(employees)
                            ? employees.map(emp => [
                                  emp.name || 'N/A',
                                  emp.staff_id || 'N/A',
                                  emp.designation || 'N/A',
                                  emp.summary || 0,
                                  emp.absent_days || 0,
                                  emp.total_late_mins || 0,
                                  emp.total_absent_days || 0,
                                  emp.total_marked_days || 0
                              ])
                            : []
                    });
                });
            });
            PdfTemplate({
                title,
                tables,
                fileName: `dept_summary_ALL_${date[0]}_to_${date[1]}.pdf`
            });
        } else {
            let data = [];
            Object.entries(summaryData).forEach(([deptName, employees]) => {
                if (Array.isArray(employees)) {
                    employees.forEach(emp => {
                        data.push([
                            emp.name || 'N/A',
                            emp.staff_id || 'N/A',
                            emp.designation || 'N/A',
                            emp.summary || 0,
                            emp.absent_days || 0,
                            emp.total_late_mins || 0,
                            emp.total_absent_days || 0,
                            emp.total_marked_days || 0
                        ]);
                    });
                }
            });
            PdfTemplate({
                title,
                tables: [{ columns: tableHeaders, data }],
                fileName: `dept_summary_${mainCategory}_${selectedDept || 'ALL'}_${date[0]}_to_${date[1]}.pdf`
            });
        }
    };

    const renderTable = (deptName, employees) => {
        const empArray = Array.isArray(employees) ? employees : [];
        console.log(`Rendering table for ${deptName}:`, empArray);
        return (
            <div key={deptName} className="mt-4 ms-4">
                <h5>{deptName} Department</h5>
                <table className="table table-bordered table-striped mt-2">
                    <thead className="thead-dark">
                        <tr>
                            <th>Employee Name</th>
                            <th>Staff ID</th>
                            <th>Designation</th>
                            <th>Late Minutes<br />({date[0]} to {date[1]})</th>
                            <th>Absent Days<br />({date[0]} to {date[1]})</th>
                            <th>Total Late Minutes</th>
                            <th>Total Absent Days</th>
                            <th>{totalMarkedDaysCol}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {empArray.length > 0 ? (
                            empArray.map((emp, index) => (
                                <tr key={`${emp.staff_id}-${index}`}>
                                    <td>{emp.name || 'N/A'}</td>
                                    <td>{emp.staff_id || 'N/A'}</td>
                                    <td>{emp.designation || 'N/A'}</td>
                                    <td>{emp.summary || 0}</td>
                                    <td>{emp.absent_days || 0}</td>
                                    <td>{emp.total_late_mins || 0}</td>
                                    <td>{emp.total_absent_days || 0}</td>
                                    <td>{emp.total_marked_days || 0}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={8} className="text-center">No employees found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderCategory = (categoryName, departments) => (
        <div key={categoryName} className="mt-4">
            <h3>{categoryName}</h3>
            {Object.entries(departments).map(([deptName, employees]) =>
                renderTable(deptName, employees)
            )}
        </div>
    );

    return (
        <PageWrapper title="Department-wise Summary">
            <button className="btn btn-outline-secondary mb-3" onClick={handleSaveAsPDF}>
                Save as PDF
            </button>

            <div className="row mb-3">
                <div className="col-md-4 mb-1">
                    <label className="mb-2">&nbsp;Category:</label>
                    <select
                        className="form-control"
                        value={mainCategory}
                        onChange={(e) => {
                            setMainCategory(e.target.value);
                            setSelectedDept('');
                            setSummaryData({});
                            setDate([]);
                        }}
                    >
                        <option value="">Choose Category</option>
                        {departments.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                {(mainCategory === 'Teaching Staff' ||
                    mainCategory === 'Non Teaching Staff' ||
                    mainCategory === 'Department Wise') && (
                        <div className="col-md-4 mb-2">
                            <label className="mb-2">Department:</label>
                            <select
                                className="form-control"
                                value={selectedDept}
                                onChange={(e) => setSelectedDept(e.target.value)}
                            >
                                <option value="">Choose a department</option>
                                {mainCategory !== 'Department Wise' && (
                                    <option value="ALL">ALL</option>
                                )}
                                {getSubDepartments().map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                        </div>
                    )}
            </div>

            {mainCategory && (mainCategory === "ALL" || selectedDept !== "") && (
                <div className="col-md-6 mb-2">
                    <div className="date-range-container d-flex align-items-center gap-2">
                        <label className="me-2">From:</label>
                        <input
                            type="date"
                            className="form-control me-3"
                            value={startDate}
                            onChange={(e) => {
                                const newStartDate = e.target.value;
                                setStartDate(newStartDate);
                                if (newStartDate && endDate && new Date(endDate) < new Date(newStartDate)) {
                                    setEndDate('');
                                }
                            }}
                            max={endDate || getDefaultEndDate()}
                        />
                        <label className="me-2">To:</label>
                        <input
                            type="date"
                            className="form-control"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={startDate || ''}
                            max={getDefaultEndDate()}
                        />
                        <button className="btn btn-primary ms-2" onClick={fetchDeptSummary}>Go</button>
                    </div>
                </div>
            )}

            {mainCategory && (mainCategory === "ALL" || selectedDept !== "") && Object.keys(summaryData).length > 0 ? (
                <>
                    {mainCategory === "ALL"
                        ? Object.entries(summaryData).map(([categoryName, departments]) =>
                            renderCategory(categoryName, departments)
                        )
                        : Object.entries(summaryData).map(([deptName, employees]) =>
                            renderTable(deptName, employees)
                        )}
                </>
            ) : mainCategory === "" ? (
                <div className="alert alert-info mt-3">Please select a category to view the summary.</div>
            ) : (mainCategory !== "ALL" && selectedDept === "") ? (
                <div className="alert alert-info mt-3">Please choose a department.</div>
            ) : (
                <div className="alert alert-info mt-3">No data available for the selected department.</div>
            )}
        </PageWrapper>
    );
}

export default DepartmentSummary;