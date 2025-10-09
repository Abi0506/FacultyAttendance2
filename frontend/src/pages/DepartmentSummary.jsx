import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from '../axios';
import PageWrapper from '../components/PageWrapper';
import PdfTemplate from '../components/PdfTemplate';
import Table from '../components/Table';

function DepartmentSummary() {
    const [mainCategory, setMainCategory] = useState('ALL');
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedSubCategory, setSelectedSubCategory] = useState(''); // e.g., "Teaching Staff"
    const [summaryData, setSummaryData] = useState({});
    const [filteredData, setFilteredData] = useState({});
    const [date, setDate] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'staff_id', direction: 'asc' });
    const [departments, setDepartments] = useState([]);
    const [categoryMappings, setCategoryMappings] = useState({});
    const [totalMarkedDaysCol, setTotalMarkedDaysCol] = useState('Total Marked Days');
    const [recordsPerPage, setRecordsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);
    // const [error, setError] = useState("");

    // Auto-fill startDate as 1st of current month, endDate as today
    function getDefaultStartDate() {
        const today = new Date();
        const year = today.getFullYear();
        const janFirst = new Date(year, 0, 1); // January 1
        const julFirst = new Date(year, 6, 1); // July 1

        let startDateObj;
        if (today >= julFirst) {
            startDateObj = julFirst;
        } else {
            startDateObj = janFirst;
        }
        const startDate = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`;
        return startDate;
    }

    function getDefaultEndDate() {
        return new Date().toISOString().split('T')[0];
    }
    const [startDate, setStartDate] = useState(getDefaultStartDate());
    const [endDate, setEndDate] = useState(getDefaultEndDate());

    const categories = ["ALL", "Department Wise"];

    // Fetch departments and category mappings
    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const response = await axios.post('/attendance/department');
                if (response.data.success) {
                    setDepartments(response.data.departments.map(d => d.dept));
                } else {
                    console.error('Failed to fetch departments:', response.data.message);
                }
            } catch (error) {
                console.error('Error fetching departments:', error);
            }
        };

        const fetchCategoryMappings = async () => {
            try {
                const response = await axios.get('/attendance/department_categories');
                if (response.data.success) {
                    setCategoryMappings(response.data.categories);
                } else {
                    console.error('Failed to fetch category mappings:', response.data.message);
                }
            } catch (error) {
                console.error('Error fetching category mappings:', error);
            }
        };

        fetchDepartments();
        fetchCategoryMappings();
    }, []);

    // Filter data based on selectedSubCategory
    useEffect(() => {
        if (!selectedSubCategory || selectedSubCategory === 'ALL') {
            setFilteredData(summaryData);
        } else {
            const filtered = {};
            Object.entries(summaryData).forEach(([catType, depts]) => {
                if (catType === selectedSubCategory) {
                    filtered[catType] = depts;
                }
            });
            setFilteredData(filtered);
        }
    }, [summaryData, selectedSubCategory]);

    const getSubDepartments = () => {
        if (mainCategory === 'Department Wise') {
            return departments;
        }
        return [];
    };

    const fetchDeptSummary = useCallback(async () => {
        setLoading(true);
        if (!mainCategory || (mainCategory === 'Department Wise' && selectedDept === '')) {
            setSummaryData({});
            setFilteredData({});
            return;
        }

        let deptToSend = mainCategory === 'Department Wise' ? selectedDept : '';

        try {
            const response = await axios.post('/attendance/dept_summary', {
                category: mainCategory,
                dept: deptToSend,
                start_date: startDate,
                end_date: endDate
            });
            setSummaryData(response.data.data || {});
            setDate(response.data.date || []);
            setTotalMarkedDaysCol(response.data.total_marked_days_col || 'Total Marked Days');
        } catch (error) {
            console.error('Error fetching summary:', error);
            setSummaryData({});
            setFilteredData({});
            setDate([]);
        }
        setLoading(false);
    }, [mainCategory, selectedDept, startDate, endDate]);

    useEffect(() => {
        if (!startDate) setStartDate(getDefaultStartDate());
        if (!endDate) setEndDate(getDefaultEndDate());
        if (mainCategory && (mainCategory === 'ALL' || selectedDept !== '') && startDate && endDate) {
            if (new Date(endDate) >= new Date(startDate)) {
                fetchDeptSummary();
            } else {
                setSummaryData({});
                setFilteredData({});
                setDate([]);
            }
        } else {
            setSummaryData({});
            setFilteredData({});
            setDate([]);
        }
    }, [mainCategory, selectedDept, startDate, endDate, fetchDeptSummary]);

    // Helper to get sorted array (same as used in renderTable)
    const getSortedArrayForPDF = (arr) => {
        if (!sortConfig.key) return arr;
        return [...arr].sort((a, b) => {
            const aVal = a[sortConfig.key] ?? '';
            const bVal = b[sortConfig.key] ?? '';
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            }
            return sortConfig.direction === 'asc'
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });
    };

    const handleSaveAsPDF = () => {
        const title = `Department-wise Summary (${date[0]} to ${date[1]})`;
        const tableHeaders = [
            'Name',
            'Staff ID',
            'Designation',
            `Filtered Late Minutes`,
            `Filtered Absent Days`,
            'Total Late Minutes',
            'Total Absent Days',
            totalMarkedDaysCol
        ];

        if (mainCategory === 'ALL') {
            const tables = [];
            Object.entries(filteredData).forEach(([category, depts]) => {
                Object.entries(depts).forEach(([deptName, employees]) => {
                    let sortedEmployees = Array.isArray(employees) ? getSortedArrayForPDF(employees) : [];
                    let data1 = {
                        columns: tableHeaders,
                        data: sortedEmployees.map(emp => [
                            emp.name || 'N/A',
                            emp.staff_id || 'N/A',
                            emp.designation || 'N/A',
                            emp.summary || 0,
                            emp.absent_days || 0,
                            emp.total_late_mins || 0,
                            emp.total_absent_days || 0,
                            emp.total_marked_days || 0
                        ]),
                        title: `${category} - ${deptName} Department`
                    };
                    tables.push(data1);
                });
            });
            PdfTemplate({
                title,
                tables,
                fileName: `Dept_Summary_ALL_${date[0]}_to_${date[1]}.pdf`
            });
        } else {
            let data = [];
            let deptTitle = '';
            Object.entries(filteredData).forEach(([deptName, employees]) => {
                deptTitle = `${deptName} Department`;
                const allEmployees = Object.values(employees).flat();
                if (Array.isArray(allEmployees)) {
                    let sortedEmployees = getSortedArrayForPDF(allEmployees);
                    sortedEmployees.forEach(emp => {
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
                tables: [{ columns: tableHeaders, data, title: deptTitle }],
                fileName: `Dept_Summary_${mainCategory}_${selectedDept || 'ALL'}_${date[0]}_to_${date[1]}.pdf`
            });
        }
    };

    // Table columns for Table component
    const tableColumns = useMemo(() => [
        'name',
        'staff_id',
        'designation',
        'late_mins',
        'absent_days',
        'total_late_mins',
        'total_absent_days',
        'total_marked_days',
    ], []);

    // Sorting logic for Table
    const handleSort = (col) => {
        setSortConfig((prev) => {
            if (prev.key === col) {
                return { key: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key: col, direction: 'asc' };
        });
    };

    // Sort data for a department
    const getSortedData = (dataArr) => {
        if (!sortConfig.key) return dataArr;
        return [...dataArr].sort((a, b) => {
            const aVal = a[sortConfig.key] ?? '';
            const bVal = b[sortConfig.key] ?? '';
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            }
            return sortConfig.direction === 'asc'
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });
    };

    // Render Table component for a department
    const renderTable = (deptName, employees) => {
        const empArray = Array.isArray(employees) ? employees : [];
        return (
            <div key={deptName} className="mt-4 ms-4">
                <h5>{deptName} Department</h5>
                <Table
                    columns={tableColumns}
                    data={getSortedData(empArray)}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    selectedDate={date[0]}
                    rowsPerPage={recordsPerPage}
                />
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
        <PageWrapper>
            <div className="d-flex align-items-center justify-content-center position-relative mb-4">
                <h2 className="fw-bold text-c-primary text-center m-0 flex-grow-1">Department</h2>
                <button className="btn btn-c-primary btn-pdf" onClick={handleSaveAsPDF}>
                    Download PDF
                </button>
            </div>

            <hr className="hr w-75 m-auto my-4" />

            {/* Category */}
            <div className="row mb-3">
                <div className="col-md-4 mb-1">
                    <label className="mb-2">&nbsp;Category:</label>
                    <select
                        className="form-control"
                        value={mainCategory}
                        onChange={(e) => {
                            setMainCategory(e.target.value);
                            setSelectedDept('');
                            setSelectedSubCategory('');
                            setSummaryData({});
                            setFilteredData({});
                            setDate([]);
                        }}
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                {mainCategory === 'Department Wise' && (
                    <div className="col-md-4 mb-2">
                        <label className="mb-2">Department:</label>
                        <select
                            className="form-control"
                            value={selectedDept}
                            onChange={(e) => {
                                setSelectedDept(e.target.value);
                                setSelectedSubCategory('');
                            }}
                        >
                            <option value="">Choose a department</option>
                            {getSubDepartments().map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>
                )}

                {Object.keys(summaryData).length > 0 && (
                    <div className="col-md-4 mb-2">
                        <label className="mb-2">Filter by Category:</label>
                        <select
                            className="form-control"
                            value={selectedSubCategory}
                            onChange={(e) => setSelectedSubCategory(e.target.value)}
                        >
                            <option value="ALL">All Categories</option>
                            {Object.keys(categoryMappings).map(cat => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Filters Row */}
            <div className="row mb-3 align-items-end">
                {/* Records per page filter */}
                <div className="col-auto mb-2">
                    <label className="me-2 mb-0">Rows:</label>
                    <select
                        className="form-select w-auto"
                        value={recordsPerPage}
                        onChange={e => setRecordsPerPage(Number(e.target.value))}
                    >
                        {[5, 10, 20, 50, 100].map(num => (
                            <option key={num} value={num}>{num}</option>
                        ))}
                    </select>
                </div>
                {/* Date range filter */}
                <div className="col-auto mb-2">
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
                    </div>
                </div>
            </div>

            {loading && <div className="text-center my-4">Loading...</div>}

            {mainCategory && (mainCategory === "ALL" || selectedDept !== "") && Object.keys(filteredData).length > 0 ? (
                <>
                    {Object.entries(filteredData).map(([categoryName, departments]) =>
                        renderCategory(categoryName, departments)
                    )}
                </>
            ) : mainCategory === "" ? (
                <div className="alert alert-info mt-3">Please select a category to view the summary.</div>
            ) : (mainCategory === "Department Wise" && selectedDept === "") ? (
                <div className="alert alert-info mt-3">Please choose a department.</div>
            ) : (
                <div className="alert alert-info mt-3">No data available for the selected filters.</div>
            )}
        </PageWrapper>
    );
}

export default DepartmentSummary;