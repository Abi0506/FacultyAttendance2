import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";

function Table({ columns, data, sortConfig, onSort, selectedDate, rowsPerPage = 10 }) {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(data.length / rowsPerPage);

    const currentData = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return data.slice(startIndex, startIndex + rowsPerPage);
    }, [data, currentPage, rowsPerPage]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [data]);

    // To capitlise the column names
    const capitalize = (str) => {
        return str
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // capitalize first letter
            .join(' ');                  // join with space
    };
    return (
        <div className="table-container" style={{ position: "relative" }}>
            <table className="table table-c">
                <thead
                    className="table-secondary"
                    style={{ position: "sticky", top: 0, zIndex: 2 }}
                >
                    <tr>
                        {columns.map((col, i) => (
                            <th
                                key={i}
                                onClick={() => onSort(col)}
                                style={{ cursor: "pointer", userSelect: "none" }}
                                className="sortable-header"
                            >
                                {capitalize(col)}{" "}
                                {sortConfig.key === col
                                    ? sortConfig.direction === "asc"
                                        ? "▲"
                                        : "▼"
                                    : "⇅"}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {currentData.length > 0 ? (
                        currentData.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {columns.map((col, colIndex) => (
                                    <td key={colIndex}>{row[col] ?? "-"}</td>
                                ))}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={columns.length} className="text-center">
                                {selectedDate
                                    ? "No records found"
                                    : "Please select a date"}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {totalPages > 1 && (
                <div className="d-flex justify-content-center my-3">
                    <ul className="pagination">
                        <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                            <button
                                className="page-link page-link-c"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            >
                                &laquo;
                            </button>
                        </li>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                            <li key={num} className={`page-item ${num === currentPage ? "active" : ""}`}>
                                <button
                                    className="page-link shadow-none page-link-c"
                                    onClick={() => setCurrentPage(num)}
                                >
                                    {num}
                                </button>
                            </li>
                        ))}

                        <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                            <button
                                className="page-link page-link-c"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            >
                                &raquo;
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
}

Table.propTypes = {
    columns: PropTypes.array.isRequired,
    data: PropTypes.array.isRequired,
    sortConfig: PropTypes.object,
    onSort: PropTypes.func,
    selectedDate: PropTypes.string,
    rowsPerPage: PropTypes.number,
};

export default Table;
