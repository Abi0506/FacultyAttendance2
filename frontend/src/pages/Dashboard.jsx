import React, { useEffect, useState } from 'react';
import axios from '../axios';
import PageWrapper from '../components/PageWrapper';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    Title,
} from 'chart.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

function PrincipalDashboard() {
    const [timeRange, setTimeRange] = useState('day');
    const [chartData, setChartData] = useState([]);

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
        "TRANSPORT": "TRANS"
    };


    useEffect(() => {
        fetchData();
    }, [timeRange]);

    const fetchData = async () => {
        try {
            const res = await axios.get(`/dashboard/late-summary`, {
                params: { range: timeRange },
            });
            setChartData(res.data); // e.g., [{ department: 'Mechanical Engineering', late_count: 10 }]
        } catch (err) {
            console.error(err);
        }
    };

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
                backgroundColor: '#F9B75D',
                borderRadius: 4,
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
                text: `Late Attendance per Department (${timeRange.toUpperCase()})`,
                font: { size: 16 },
            },
            tooltip: {
                callbacks: {
                    // 🔹 Show full department name in tooltip
                    title: (tooltipItems) => {
                        const index = tooltipItems[0].dataIndex;
                        return chartData[index]?.department || '';
                    },
                    label: (tooltipItem) => {
                        const dept = chartData[tooltipItem.dataIndex]?.department || '';
                        const count = tooltipItem.formattedValue;
                        return `Late Count: ${count}`;
                    },
                },
            },
        },
        scales: {
            x: {
                ticks: {
                    autoSkip: false,
                    maxRotation: 45,
                    minRotation: 0,
                    font: { size: 12 },
                },
            },
            y: {
                beginAtZero: true,
                ticks: { stepSize: 1 },
                grid: { color: '#eee' },
            },
        },
    };

    const rangeButtons = [
        { label: 'Today', value: 'day' },
        { label: 'This Week', value: 'week' },
        { label: 'This Month', value: 'month' },
    ];

    return (
        <PageWrapper title="Principal Dashboard">
            {/* Range Buttons */}
            <div className="flex justify-end gap-2 mb-4">
                {rangeButtons.map((btn) => (
                    <button
                        key={btn.value}
                        onClick={() => setTimeRange(btn.value)}
                        className={`px-4 py-2 rounded-md border transition-all duration-200 ${timeRange === btn.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
                            }`}
                    >
                        {btn.label}
                    </button>
                ))}
            </div>

            {/* Chart */}
            <div className="bg-white p-6 rounded-xl shadow-md" style={{ minHeight: '400px' }}>
                <Bar data={data} options={options} />
            </div>


        </PageWrapper>
    );
}

export default PrincipalDashboard;
