import React, { useState, useMemo, useEffect } from "react";
import PropTypes from "prop-types";

function Table({
    columns,
    data,
    sortConfig,
    onSort,
    selectedDate,
    rowsPerPage = 10,
    flaggedCells,
    onFlagClick,
    isFlagMode,
    onRowClick,
    currentPage: externalPage,
    onPageChange: externalSetPage,
}) {
    // Use external pagination if provided, otherwise internal state
    const [internalPage, setInternalPage] = useState(1);
    const currentPage = externalPage ?? internalPage;
    const setCurrentPage = externalSetPage ?? setInternalPage;

    const totalPages = Math.ceil(data.length / rowsPerPage);

    const currentData = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return data.slice(startIndex, startIndex + rowsPerPage);
    }, [data, currentPage, rowsPerPage]);

    // Reset only internal pagination when data changes
    useEffect(() => {
        if (!externalPage) setInternalPage(1);
    }, [data, externalPage]);

    // Utility to prettify headers
    const capitalize = (str) =>
        str
            .split("_")
            .map(
                (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join(" ");

    return (
        <div className="table-container" style={{ position: "relative" }}>
            <style>{`
        .flag-hover-cell:hover {
          border: 2px solid #ff9800 !important;
          box-shadow: 0 0 0 2px #ffe0b2;
        }
      `}</style>

            <table className="table table-c">
                <thead className="table-secondary" style={{ position: "sticky", top: 0, zIndex: 2 }}                >
                    <tr>
                        {columns.map((col, i) => (
                            <th key={i} onClick={() => onSort && onSort(col)} style={{ cursor: "pointer", userSelect: "none" }} className="sortable-header"                            >
                                {capitalize(col)}{" "}
                                {onSort ? (sortConfig?.key === col ? sortConfig.direction === "asc"
                                    ? "▲"
                                    : "▼"
                                    : "⇅")
                                    : ""}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {currentData.length > 0 ? (
                        currentData.map((row, rowIndex) => (
                            < tr
                                key={rowIndex}
                                onClick={onRowClick ? () => onRowClick(row.staff_id) : undefined}
                                style={onRowClick ? { cursor: "pointer" } : undefined}
                            >
                                {columns.map((col, colIndex) => {
                                    const isTimeColumn =
                                        col.toLowerCase().includes("in") ||
                                        col.toLowerCase().includes("out");
                                    const timeValue = row[col];
                                    const flaggedKey =
                                        row.staff_id && timeValue
                                            ? `${row.staff_id}_${row.Date}_${timeValue}`
                                            : undefined;
                                    const isFlagged =
                                        flaggedCells && flaggedKey && flaggedCells[flaggedKey];
                                    const isClickable =
                                        isFlagMode && isTimeColumn && timeValue && onFlagClick;

                                    return (
                                        <td
                                            key={colIndex}
                                            onClick={(e) => {
                                                if (isClickable) {
                                                    e.stopPropagation();
                                                    onFlagClick(row.staff_id, selectedDate, timeValue);
                                                }
                                            }}
                                            className={[
                                                isClickable ? "flag-hover-cell" : "",
                                                isFlagged ? "bg-c-warning" : "",
                                            ].filter(Boolean).join(" ")}
                                            style={{
                                                cursor: (!isFlagMode && onRowClick) || (isFlagMode && isClickable) ? "pointer" : "default",
                                            }}
                                        >
                                            {row[col] ?? "-"}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={columns.length} className="text-center">
                                {selectedDate ? "No records found" : "Please select a date"}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {
                totalPages > 1 && (
                    <div className="d-flex justify-content-center my-3">
                        <ul className="pagination">
                            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                                <button
                                    className="page-link page-link-c"
                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                >
                                    &laquo;
                                </button>
                            </li>

                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                                <li key={num} className={`page-item ${num === currentPage ? "active" : ""}`}                            >
                                    <button className="page-link shadow-none page-link-c" onClick={() => setCurrentPage(num)}                                >
                                        {num}
                                    </button>
                                </li>
                            ))}

                            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                                <button className="page-link page-link-c" onClick={() =>
                                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                                }>
                                    &raquo;
                                </button>
                            </li>
                        </ul>
                    </div>
                )
            }
        </div >
    );
}

Table.propTypes = {
    columns: PropTypes.array.isRequired,
    data: PropTypes.array.isRequired,
    sortConfig: PropTypes.object,
    onSort: PropTypes.func,
    selectedDate: PropTypes.string,
    rowsPerPage: PropTypes.number,
    flaggedCells: PropTypes.object,
    onFlagClick: PropTypes.func,
    isFlagMode: PropTypes.bool,
    onRowClick: PropTypes.func,
    currentPage: PropTypes.number,
    onPageChange: PropTypes.func,
};

export default Table;
