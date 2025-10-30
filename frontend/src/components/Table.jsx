import React, { useState, useMemo, useEffect } from "react";
import PropTypes from "prop-types";

function Table({
    opt_staff_id = "",
    columns,
    data,
    sortConfig,
    onSort,
    selectedDate,
    rowsPerPage = 10,
    rowHighlightMap = {},
    flaggedCells,
    onFlagClick,
    isFlagMode,
    onRowClick,
    currentPage: externalPage,
    onPageChange: externalSetPage,
    loading,
    editableColumns = [], // NEW
    onEdit, // NEW
    editConfig = {}, // NEW — optional (min, max)
}) {
    const [internalPage, setInternalPage] = useState(1);
    const currentPage = externalPage ?? internalPage;
    const setCurrentPage = externalSetPage ?? setInternalPage;

    const totalPages = Math.ceil(data.length / rowsPerPage);

    const currentData = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return data.slice(startIndex, startIndex + rowsPerPage);
    }, [data, currentPage, rowsPerPage]);

    let currentDateExempted = false;

    useEffect(() => {
        if (!externalPage) setInternalPage(1);
    }, [data, externalPage]);

    const capitalize = (str) =>
        str
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");

    const getPaginationRange = (current, total) => {
        const delta = 2; // how many pages to show around current
        const range = [];
        const rangeWithDots = [];
        for (let i = 1; i <= total; i++) {
            if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
                range.push(i);
            }
        }
        let prev = 0;
        for (let i of range) {
            if (prev) {
                if (i - prev === 2) {
                    rangeWithDots.push(prev + 1);
                } else if (i - prev !== 1) {
                    rangeWithDots.push("...");
                }
            }
            rangeWithDots.push(i);
            prev = i;
        }
        return rangeWithDots;
    };



    return (
        <div className="table-container" style={{ position: "relative" }}>
            <table className="table table-c">
                <thead className="table-secondary" style={{ position: "sticky", top: 0, zIndex: 2 }}>
                    <tr>
                        {columns.map((col, i) => (
                            <th
                                key={i}
                                onClick={() => onSort && onSort(col)}
                                style={{ cursor: onSort ? "pointer" : "default", userSelect: "none" }}
                            >
                                {capitalize(col)}{" "}
                                {onSort ? (
                                    sortConfig?.key === col
                                        ? sortConfig.direction === "asc"
                                            ? "▲"
                                            : "▼"
                                        : "⇅"
                                ) : (
                                    ""
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={columns.length} className="text-center py-4 text-secondary">
                                Loading...
                            </td>
                        </tr>
                    ) : currentData.length > 0 ? (
                        currentData.map((row, rowIndex) => (
                            currentDateExempted = false,
                            Object.values(rowHighlightMap).forEach(e => {
                                if (e.exemptionDate === (row.Date || row.date)) {
                                    currentDateExempted = true;
                                }
                            }),
                            <tr
                                key={rowIndex}
                                onClick={onRowClick ? () => onRowClick(row.staff_id) : undefined}
                                style={{
                                    ...(onRowClick ? { cursor: "pointer" } : {}),
                                    ...(currentDateExempted ? { backgroundColor: "#7cfbe836" } : {})
                                }}
                            >
                                {columns.map((col, colIndex) => {
                                    const timeValue = row[col];
                                    const flaggedKey =
                                        (row.staff_id || opt_staff_id) && timeValue
                                            ? `${row.staff_id || opt_staff_id}_${row.Date || row.date}_${timeValue}`
                                            : undefined;
                                    const isFlagged =
                                        flaggedCells && flaggedKey && flaggedCells[flaggedKey];
                                    const isClickable =
                                        isFlagMode &&
                                        (col.toLowerCase().includes("in") ||
                                            col.toLowerCase().includes("out")) &&
                                        timeValue &&
                                        onFlagClick;

                                    // Handle editable numeric column
                                    const isEditable = editableColumns.includes(col);
                                    if (isEditable) {
                                        return (
                                            <td key={colIndex} style={{
                                                backgroundColor: "inherit"
                                            }}>
                                                <EditableCell
                                                    value={row[col]}
                                                    row={row}
                                                    col={col}
                                                    editConfig={editConfig}
                                                    onEdit={onEdit}
                                                />
                                            </td>
                                        );
                                    }

                                    // Regular cell
                                    return (
                                        <td
                                            key={colIndex}
                                            onClick={(e) => {
                                                if (isClickable) {
                                                    e.stopPropagation();
                                                    onFlagClick(
                                                        row.staff_id,
                                                        row.Date || row.date || selectedDate,
                                                        timeValue
                                                    );
                                                }
                                            }}
                                            className={[
                                                isClickable ? "flag-hover-cell" : "",
                                                isFlagged ? "bg-c-warning" : "",

                                            ]
                                                .filter(Boolean)
                                                .join(" ")}
                                            style={{
                                                cursor:
                                                    (!isFlagMode && onRowClick) ||
                                                        (isFlagMode && isClickable)
                                                        ? "pointer"
                                                        : "default",
                                                backgroundColor: "inherit",
                                            }}
                                        >
                                            {timeValue ?? "-"}
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

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="d-flex justify-content-center my-3">
                    <ul className="pagination flex-wrap justify-content-center mb-2">
                        <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                            <button
                                className="page-link page-link-c"
                                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                            >
                                &laquo;
                            </button>
                        </li>
                        {getPaginationRange(currentPage, totalPages).map((num, i) =>
                            num === "..." ? (
                                <li key={`ellipsis-${i}`} className="page-item disabled">
                                    <span className="page-link page-link-c">...</span>
                                </li>
                            ) : (
                                <EditablePageButton
                                    key={num}
                                    num={num}
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    setCurrentPage={setCurrentPage}
                                />
                            )
                        )}
                        <li
                            className={`page-item ${currentPage === totalPages ? "disabled" : ""
                                }`}
                        >
                            <button
                                className="page-link page-link-c"
                                onClick={() =>
                                    setCurrentPage((p) => Math.min(p + 1, totalPages))
                                }
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

function EditableCell({ value, row, col, editConfig, onEdit }) {
    const [localValue, setLocalValue] = React.useState(value ?? 0);

    React.useEffect(() => {
        setLocalValue(value ?? 0);
    }, [value]);

    return (
        <input
            type="number"
            className="form-control form-control-sm text-center m-auto w-50"
            value={localValue}
            min={editConfig.min ?? 0}
            max={editConfig.max ?? 90}
            onChange={(e) => {
                const val = e.target.value;
                setLocalValue(val);
                if (onEdit) onEdit(row, col, val, { onChange: true });
            }}
            onBlur={(e) => {
                const raw = parseInt(e.target.value, 10);
                const minVal = typeof editConfig.min === "number" ? editConfig.min : -Infinity;
                const maxVal = typeof editConfig.max === "number" ? editConfig.max : Infinity;

                const finalVal = isNaN(raw)
                    ? 0
                    : Math.min(Math.max(raw, minVal), maxVal);

                setLocalValue(finalVal);
                if (onEdit) onEdit(row, col, finalVal, { onBlur: true });
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    e.target.blur();
                }
            }}
        />
    );
}
function EditablePageButton({ num, currentPage, totalPages, setCurrentPage }) {
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(currentPage);
    useEffect(() => {
        if (!isEditing) setInputValue(currentPage);
    }, [currentPage, isEditing]);
    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            let page = Number(inputValue);
            if (isNaN(page)) page = currentPage;
            if (page < 1) page = 1;
            if (page > totalPages) page = totalPages;
            setCurrentPage(page);
            setIsEditing(false);
        } else if (e.key === "Escape") {
            setIsEditing(false);
        }
    };
    return (
        <li className={`page-item ${num === currentPage ? "active" : ""}`}>
            {isEditing && num === currentPage ? (
                <input
                    type="number"
                    className="page-link page-link-c text-center"
                    value={inputValue}
                    autoFocus
                    min="1"
                    max={totalPages}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => setIsEditing(false)}
                    style={{ width: "8ch", textAlign: "center" }}
                />
            ) : (
                <button
                    className="page-link shadow-none page-link-c"
                    onClick={() =>
                        num === currentPage ? setIsEditing(true) : setCurrentPage(num)
                    }
                    style={{
                        cursor: num === currentPage ? "text" : "pointer",
                        userSelect: "none",
                        width: "6ch",
                        textAlign: "center",
                    }}
                >
                    {num}
                </button>
            )}
        </li>
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
    loading: PropTypes.bool,
    editableColumns: PropTypes.array,
    onEdit: PropTypes.func,
    editConfig: PropTypes.object,
};

export default Table;
