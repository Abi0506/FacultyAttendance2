import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from '../axios';
import PageWrapper from '../components/PageWrapper';
import PdfTemplate from '../components/PdfTemplate';
import Table from '../components/Table';
import { Line } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Title,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Title
);

function HODDashboard() {
    const navigate = useNavigate();
    const tableRef = useRef(null);

    // State for line graph
    const [dailySummary, setDailySummary] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedType, setSelectedType] = useState(null);
    const [dailyStaff, setDailyStaff] = useState([]);
    const [dailyStaffSortConfig, setDailyStaffSortConfig] = useState({
        key: 'minutes_diff',
        direction: 'desc'
    });
    const [dailyStaffPage, setDailyStaffPage] = useState(1);

    // State for department summary table
    const [summaryData, setSummaryData] = useState({});
    const [filteredData, setFilteredData] = useState({});
    const [sortConfig, setSortConfig] = useState({ key: 'staff_id', direction: 'asc' });
    const [recordsPerPage, setRecordsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);
    const [selectedSubCategory, setSelectedSubCategory] = useState('ALL');
    const [categoryMappings, setCategoryMappings] = useState({});
    const [accessibleDepartments, setAccessibleDepartments] = useState([]);

    // Date range
    function getDefaultStartDate() {
        const today = new Date();
        const year = today.getFullYear();
        const janFirst = new Date(year, 0, 1);
        const julFirst = new Date(year, 6, 1);
        let startDateObj = today >= julFirst ? julFirst : janFirst;
        return `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`;
    }

    function getDefaultEndDate() {
        return new Date().toISOString().split('T')[0];
    }

    const [startDate, setStartDate] = useState(getDefaultStartDate());
    const [endDate, setEndDate] = useState(getDefaultEndDate());

    // Fetch accessible departments
    useEffect(() => {
        const fetchAccessibleDepartments = async () => {
            try {
                const response = await axios.get('/hod-dashboard/accessible-departments');
                if (response.data.success) {
                    setAccessibleDepartments(response.data.departments);
                }
            } catch (error) {
                console.error('Error fetching accessible departments:', error);
            }
        };

        fetchAccessibleDepartments();
    }, []);

    // Fetch category mappings
    useEffect(() => {
        const fetchCategoryMappings = async () => {
            try {
                const response = await axios.get('/attendance/department_categories');
                if (response.data.success) {
                    setCategoryMappings(response.data.categories);
                }
            } catch (error) {
                console.error('Error fetching category mappings:', error);
            }
        };

        fetchCategoryMappings();
    }, []);

    // Fetch daily summary for line graph
    const fetchDailySummary = useCallback(async () => {
        if (!startDate || !endDate) return;
        try {
            const response = await axios.get('/hod-dashboard/daily-summary', {
                params: { startDate, endDate }
            });
            if (response.data.success) {
                setDailySummary(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching daily summary:', error);
            setDailySummary([]);
        }
    }, [startDate, endDate]);

    // Fetch department summary for table
    const fetchDepartmentSummary = useCallback(async () => {
        setLoading(true);
        if (!startDate || !endDate) {
            setSummaryData({});
            setFilteredData({});
            setLoading(false);
            return;
        }

        try {
            const response = await axios.get('/hod-dashboard/department-summary', {
                params: { startDate, endDate }
            });
            if (response.data.success) {
                setSummaryData(response.data.data || {});
            }
        } catch (error) {
            console.error('Error fetching department summary:', error);
            setSummaryData({});
            setFilteredData({});
        }
        setLoading(false);
    }, [startDate, endDate]);

    // Fetch data on date change
    useEffect(() => {
        if (startDate && endDate && new Date(endDate) >= new Date(startDate)) {
            fetchDailySummary();
            fetchDepartmentSummary();
        }
    }, [startDate, endDate, fetchDailySummary, fetchDepartmentSummary]);

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

    // Line graph click handler
    const handleLineClick = async (event, elements) => {
        if (!elements.length) return;

        const index = elements[0].index;
        const datasetIndex = elements[0].datasetIndex;
        // use the normalizedDailySummary (fills missing dates) so index aligns with chart labels
        const clickedDate = normalizedDailySummary[index]?.date;
        const type = datasetIndex === 0 ? 'Late In' : 'Early Out';

        // if we couldn't determine a date, avoid making the request
        if (!clickedDate) {
            console.warn('Clicked date is undefined, aborting daily-staff request');
            // still scroll to department summary as a fallback
            setTimeout(() => {
                tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
            return;
        }

        setSelectedDate(clickedDate);
        setSelectedType(type);

        try {
            const res = await axios.get('/hod-dashboard/daily-staff', {
                params: { date: clickedDate }
            });
            if (res.data.success) {
                const filteredData = res.data.data.filter(staff => staff.type === type);
                setDailyStaff(filteredData);

                setTimeout(() => {
                    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        } catch (err) {
            console.error(err);
            setDailyStaff([]);
        }
    };

    // Row click handler
    const handleRowClick = (staff_id) => {
        if (!staff_id) return;
        navigate(`/individual/${staff_id}`);
        window.scrollTo(0, 0);
    };

    // Fill missing dates for line graph
    function fillMissingDates(dailySummary, startDate, endDate) {
        const result = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        const map = Object.fromEntries(
            dailySummary.map(item => [item.date, item])
        );

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const existing = map[dateStr];
            result.push({
                date: dateStr,
                morning_late_count: existing?.morning_late_count || 0,
                evening_early_count: existing?.evening_early_count || 0,
            });
        }

        return result;
    }

    const normalizedDailySummary = fillMissingDates(dailySummary, startDate, endDate);

    // Line graph configuration
    const lineData = {
        labels: normalizedDailySummary.map(item => item.date),
        datasets: [
            {
                label: 'Morning Late Count',
                data: normalizedDailySummary.map(item => item.morning_late_count),
                borderColor: '#ff4b4bff',
                backgroundColor: '#ff4b4b5a',
                tension: 0.3,
            },
            {
                label: 'Evening Early Count',
                data: normalizedDailySummary.map(item => item.evening_early_count),
                borderColor: '#678dffff',
                backgroundColor: '#678dff68',
                tension: 0.3,
            },
        ],
    };

    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            title: {
                display: true,
                text: `Daily Late Attendance - Your Departments (${startDate} → ${endDate})`,
                font: { size: 16 },
            },
        },
        onClick: handleLineClick,
        onHover: (event, chartElement) => {
            event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
        },
        scales: {
            x: {
                ticks: {
                    maxRotation: 30,
                    minRotation: 30,
                },
                title: {
                    display: true,
                    text: 'Date',
                },
            },
            y: {
                beginAtZero: true,
                ticks: { stepSize: 1 },
                title: {
                    display: true,
                    text: 'Count',
                },
            },
        },
    };

    // Sorted daily staff data
    const sortedDailyStaffData = useMemo(() => {
        if (!dailyStaff.length) return [];
        let sortable = [...dailyStaff];
        if (dailyStaffSortConfig.key) {
            sortable.sort((a, b) => {
                let valA = a[dailyStaffSortConfig.key];
                let valB = b[dailyStaffSortConfig.key];

                if (dailyStaffSortConfig.key === 'minutes_diff') {
                    valA = Number(valA);
                    valB = Number(valB);
                } else {
                    if (typeof valA === 'string') valA = valA.toLowerCase();
                    if (typeof valB === 'string') valB = valB.toLowerCase();
                }

                if (valA < valB) return dailyStaffSortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return dailyStaffSortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [dailyStaff, dailyStaffSortConfig]);

    // Table columns
    const tableColumns = useMemo(() => [
        'name',
        'staff_id',
        'designation',
        'filtered_late_mins',
        'total_late_mins',
        'deducted_days'
    ], []);

    // Sorting logic for table
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

    // Helper for PDF export
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

    // PDF export handler
    const handleSaveAsPDF = () => {
        const title = `HOD Department Summary (${startDate} to ${endDate})`;
        const tableHeaders = [
            'Name',
            'Staff ID',
            'Designation',
            'Filtered Late Minutes',
            'Total Late Minutes',
            'Deducted Days'
        ];

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
                        emp.filtered_late_mins || 0,
                        emp.total_late_mins || 0,
                        emp.deducted_days || 0
                    ]),
                    title: `${category} - ${deptName} Department`
                };
                tables.push(data1);
            });
        });

        PdfTemplate({
            title,
            tables,
            fileName: `HOD_Summary_${startDate}_to_${endDate}.pdf`
        });
    };

    // Render table for a department
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
                    selectedDate={startDate}
                    rowsPerPage={recordsPerPage}
                    onRowClick={handleRowClick}
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
                <h2 className="fw-bold text-c-primary text-center m-0 flex-grow-1">
                    Dashboard
                </h2>
            </div>

            <hr className="hr w-75 m-auto my-4" />

            {/* Display accessible departments */}
            {accessibleDepartments.length > 1 && (
                <div className=" mb-3">
                    <small className="text-muted text-small">
                        <strong>Your Departments:</strong> {accessibleDepartments.join(', ')}
                    </small>
                </div>

            )}


            {/* Date Range Selection */}
            <div className="row mb-3 align-items-end">
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

            {/* Line Chart */}
            <div className="text-sm italic text-gray-400 fw-light text-end w-100 mb-2">
                Click on a point to view staff details
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md mt-4" style={{ minHeight: '400px' }}>
                <Line data={lineData} options={lineOptions} />
            </div>

            {/* Daily Staff Table (from line graph click) */}
            {
                selectedDate && selectedType && (
                    <div ref={tableRef} className="bg-white p-6 rounded-xl shadow-md mt-6">
                        <h5 className="mb-4">
                            {selectedType === 'Late In'
                                ? `Morning Late Staff on ${selectedDate}`
                                : `Evening Early Out Staff on ${selectedDate}`
                            }
                        </h5>

                        <Table
                            columns={['staff_id', 'name', 'dept', 'expected_time', 'actual_time', 'minutes_diff']}
                            data={sortedDailyStaffData}
                            sortConfig={dailyStaffSortConfig}
                            onSort={(col) => {
                                setDailyStaffSortConfig(prev =>
                                    prev.key === col
                                        ? { key: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                                        : { key: col, direction: 'asc' }
                                );
                            }}
                            currentPage={dailyStaffPage}
                            onPageChange={setDailyStaffPage}
                            onRowClick={handleRowClick}
                        />
                    </div>
                )
            }

            <hr className="my-4" />

            {/* Department Summary Section */}
            <div className="d-flex align-items-center justify-content-between position-relative mb-4">
                <h3 className="fw-bold text-c-primary m-0">Department Summary</h3>
                {Object.keys(filteredData).length > 0 && (
                    <button className="btn btn-c-primary btn-pdf" onClick={handleSaveAsPDF}>
                        Download PDF
                    </button>
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

                {/* Category filter */}
                {Object.keys(summaryData).length > 0 && (
                    <div className="col-auto mb-2">
                        <label className="me-2 mb-0">Category:</label>
                        <select
                            className="form-select w-auto"
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

            {/* Department Summary Tables */}
            {
                loading ? (
                    <div className="text-center my-4">Loading...</div>
                ) : Object.keys(filteredData).length > 0 ? (
                    <>
                        {Object.entries(filteredData).map(([categoryName, departments]) =>
                            renderCategory(categoryName, departments)
                        )}
                    </>
                ) : (
                    <div className="alert alert-info mt-3">
                        No data available for the selected date range.
                    </div>
                )
            }
        </PageWrapper >
    );
}

export default HODDashboard;
