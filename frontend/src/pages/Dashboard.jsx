import React, { useState, useEffect } from 'react';
import axios from '../axios';
import PageWrapper from '../components/PageWrapper';
import { Bar, Line } from 'react-chartjs-2';
import Table from '../components/Table';
import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import {
    Chart as ChartJS,
    BarElement,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Title,
    Filler,
} from 'chart.js';

ChartJS.register(
    BarElement,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Title,
    Filler
);

function PrincipalDashboard() {
    const [chartData, setChartData] = useState([]);

    const [selectedDept, setSelectedDept] = useState(null);
    const [staffData, setStaffData] = useState([]);
    const [staffSortConfig, setStaffSortConfig] = useState({ key: 'late_count', direction: 'desc' });
    const [dailySortConfig, setDailySortConfig] = useState({ key: 'staff_id', direction: 'asc' });
    const [staffPage, setStaffPage] = useState(1);
    const [dailyPage, setDailyPage] = useState(1);
    const [dailySummary, setDailySummary] = useState([]);
    const navigate = useNavigate();
    const tableRef = useRef(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [dailyStaff, setDailyStaff] = useState([]);
    const [selectedType, setSelectedType] = useState(null); // 'Late In' or 'Early Out'
    const [dailyStaffSortConfig, setDailyStaffSortConfig] = useState({ key: 'minutes_diff', direction: 'desc' });
    const [dailyStaffPage, setDailyStaffPage] = useState(1);

    const deptShortNames = {
        "MECHANICAL ENGINEERING": "MECH",
        "CIVIL ENGINEERING": "CIVIL",
        "ELECTRICAL AND ELECTRONICS ENGINEERING": "EEE",
        "COMPUTER SCIENCE AND ENGINEERING": "CSE",
        "MATHEMATICS": "MATHS",
        "CHEMISTRY": "CHEM",
        "ENGLISH": "ENG",
        "COMPUTER CENTRE": "CC",
        "PHYSICS": "PHY",
        "PHYSICAL EDUCATION": "PE",
        "OFFICE": "OFFICE",
        "EXAMINATION CENTER": "EXAM",
        "STORES": "STORES",
        "PRINCIPAL OFFICE": "PRINCIPAL",
        "LIBRARY": "LIB",
        "ELECTRONICS AND COMMUNICATION ENGINEERING": "ECE",
        "POWER OFFICE": "POWER",
        "HUMANITIES": "HUM",
        "IQAC": "IQAC",
        "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE": "AIDS",
        "CAREER DEVELOPMENT CENTRE": "CDC",
        "STAFF HOSTEL": "HOSTEL",
        "MAINTANANCE": "MAINT",
        "TOTAL QUALITY MANAGEMENT": "TQM",
        "PSG GRD S & T MUSEUM": "MUSEUM",
        "TAMIL": "TAMIL",
        "COMPUTER MAINTENANCE CELL": "CMC",
        "CONVENTION CENTRE": "CONVENTION",
        "TRANSPORT": "TRANS",
        "PSG SOFTWARE TECHNOLOGIES": "PSGT",
    };

    const sortedStaffData = React.useMemo(() => {
        if (!staffData.length) return [];
        let sortable = [...staffData];
        if (staffSortConfig.key) {
            sortable.sort((a, b) => {
                let valA = a[staffSortConfig.key];
                let valB = b[staffSortConfig.key];

                if (staffSortConfig.key === 'late_count') {
                    valA = Number(valA);
                    valB = Number(valB);
                } else {
                    if (typeof valA === 'string') valA = valA.toLowerCase();
                    if (typeof valB === 'string') valB = valB.toLowerCase();
                }

                if (valA < valB) return staffSortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return staffSortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [staffData, staffSortConfig]);

    const sortedDailyStaffData = React.useMemo(() => {
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

    function getDefaultStartDate() {
        const today = new Date();
        const year = today.getFullYear();
        const janFirst = new Date(year, 0, 1); // January 1
        const julFirst = new Date(year, 6, 1); // July 1

        let startDateObj = today >= julFirst ? julFirst : janFirst;
        return `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`;
    }
    function getDefaultEndDate() {
        return new Date().toISOString().split('T')[0];
    }
    const [startDate, setStartDate] = useState(getDefaultStartDate());
    const [endDate, setEndDate] = useState(getDefaultEndDate());


    // Fetch data
    const fetchData = async () => {
        if (!startDate || !endDate) return;
        try {
            const [deptRes, dailyRes] = await Promise.all([
                axios.get('/dashboard/late-summary', { params: { startDate, endDate } }),
                axios.get('/dashboard/daily-summary', { params: { startDate, endDate } }),
            ]);
            setChartData(deptRes.data);
            setDailySummary(dailyRes.data);
        } catch (err) {
            console.error(err);
        }
    };
    // Update table whenever selectedDept or date range changes
    useEffect(() => {
        if (!selectedDept) return;

        const fetchStaff = async () => {
            try {
                const res = await axios.get('/dashboard/late-staff', {
                    params: { department: selectedDept, startDate, endDate },
                });
                setStaffData(res.data); // update table
            } catch (err) {
                console.error(err);
                setStaffData([]);
            }
        };

        fetchStaff();
    }, [selectedDept, startDate, endDate]);

    const handleBarClick = async (event, elements) => {
        if (!elements.length) return;

        const index = elements[0].index;
        const deptName = chartData[index]?.department;
        setSelectedDept(deptName);

        try {
            const res = await axios.get('/dashboard/late-staff', {
                params: { department: deptName, startDate, endDate },
            });
            setStaffData(res.data);
            setStaffPage(1)
            setTimeout(() => {
                tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } catch (err) {
            console.error(err);
            setStaffData([]);
        }
    };
    const handleRowClick = (staff_id) => {
        if (!staff_id) return;
        navigate(`/individual/${staff_id}`);
        window.scrollTo(0, 0);
    };

    const handleLineClick = async (event, elements) => {
        if (!elements.length) return;

        const index = elements[0].index;
        const datasetIndex = elements[0].datasetIndex; // 0 = Morning Late, 1 = Evening Early
        const clickedDate = dailySummary[index]?.date;

        // Determine which type based on dataset
        const type = datasetIndex === 0 ? 'Late In' : 'Early Out';

        setSelectedDate(clickedDate);
        setSelectedType(type);

        try {
            const res = await axios.get('/dashboard/daily-staff', { params: { date: clickedDate } });
            const filteredData = res.data.filter(staff => staff.type === type);
            setDailyStaff(filteredData);

            setTimeout(() => {
                tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } catch (err) {
            console.error(err);
            setDailyStaff([]);
        }
    };


    // Preset date range setter
    const setPresetRange = (type) => {
        const now = new Date();
        const end = new Date();
        const start = new Date();

        if (type === 'week') start.setDate(now.getDate() - 7);
        else if (type === 'month') start.setMonth(now.getMonth() - 1);

        const format = (d) => d.toISOString().slice(0, 10);
        setStartDate(format(start));
        setEndDate(format(end));
    };
    function fillMissingDates(dailySummary, startDate, endDate) {
        const result = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Create a map for quick lookup
        const map = Object.fromEntries(
            dailySummary.map(item => [item.date, item])
        );

        // Fill all dates in range
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



    // Auto-fetch on date change
    useEffect(() => {
        if (startDate && endDate) fetchData();
    }, [startDate, endDate]);

    const labels = chartData.map((item) => {
        const deptName = item.department?.trim().toLowerCase();
        const normalizedMap = Object.fromEntries(
            Object.entries(deptShortNames).map(([key, value]) => [key.toLowerCase(), value])
        );
        return normalizedMap[deptName] || item.department;
    });

    const data = {
        labels,
        datasets: [
            {
                label: 'Late Attendances',
                data: chartData.map((item) => item.late_count),
                backgroundColor: chartData.map((item) =>
                    item.department === selectedDept ? '#F29C3B' : '#F9B75D'
                ),
                borderRadius: 6,

                borderSkipped: false,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            title: {
                display: true,
                text: `Late Attendance Count per Department (${startDate} → ${endDate})`,
                font: { size: 16 },
            },
            tooltip: {
                callbacks: {
                    title: (tooltipItems) => {
                        const index = tooltipItems[0].dataIndex;
                        return chartData[index]?.department || '';
                    },
                    label: (tooltipItem) => `Late Count: ${tooltipItem.formattedValue}`,
                },
            },
        },
        onHover: (event, chartElement) => {
            event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
        },
        scales: {
            x: { ticks: { autoSkip: false, maxRotation: 45 } },
            y: { beginAtZero: true, ticks: { stepSize: 1 } },
        },
        onClick: handleBarClick,
    };
    const normalizedDailySummary = fillMissingDates(dailySummary, startDate, endDate);


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
                text: `Daily Late Attendance (${startDate} → ${endDate})`,
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
                    // autoSkip: false,
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

    return (
        <PageWrapper title="Principal Dashboard">
            <div className="d-flex justify-content-between items-center mb-6 bg-white">
                <div className="d-flex items-center gap-4 justify-content-between">

                    <div>
                        <label className="form-label">Start Date</label>
                        <input type="date" className="form-control" name="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                    </div>
                    <div>
                        <label className="form-label">End Date</label>
                        <input type="date" className="form-control" name="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                    </div>
                </div>

                {/* Right Section: Quick Range Buttons */}
                <div className="d-flex items-center gap-3">
                    <button
                        onClick={() => setPresetRange('week')}
                        className="btn btn-c-primary h-50 float-end my-auto"
                    >
                        Last Week
                    </button>
                    <button
                        onClick={() => setPresetRange('month')}
                        className="btn btn-c-primary h-50 my-auto"
                    >
                        Last Month
                    </button>
                </div>
            </div>


            {/* Chart */}

            <div className="text-sm italic text-gray-400 fw-light text-end w-100 mb-2">
                Click on a bar to view staff details
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md" style={{ minHeight: '400px' }}>
                <Bar data={data} options={options} />
            </div>

            {selectedDept && (
                <div ref={tableRef} className="bg-white p-6 rounded-xl shadow-md mt-6">
                    <div className="bg-white p-6 rounded-xl shadow-md mt-6">
                        <h5 className="mb-4">
                            {`Details for ${selectedDept} (${startDate} → ${endDate})`}
                        </h5>

                        <Table
                            columns={['staff_id', 'name', 'late_count']}
                            data={sortedStaffData}
                            sortConfig={staffSortConfig}
                            selectedDate={selectedDate}
                            onSort={(col) => {
                                setStaffSortConfig(prev =>
                                    prev.key === col
                                        ? { key: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                                        : { key: col, direction: 'asc' }
                                );
                            }}
                            currentPage={staffPage}
                            onPageChange={setStaffPage}
                            onRowClick={handleRowClick}
                        />
                    </div>
                </div>
            )}

            <hr className="my-4" />
            {/* Line Chart Section */}
            <div className="bg-white p-6 rounded-xl shadow-md mt-6" style={{ minHeight: '400px' }}>
                <Line data={lineData} options={lineOptions} />
            </div>

            {/* Daily Staff Table Section */}
            {selectedDate && selectedType && (
                <div className="bg-white p-6 rounded-xl shadow-md mt-6">
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
            )}
        </PageWrapper>
    );
}

export default PrincipalDashboard;
