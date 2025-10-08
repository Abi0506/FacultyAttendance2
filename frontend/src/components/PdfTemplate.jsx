import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};

const capitalize = (str) => {
    return str
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // capitalize first letter
        .join(' ');
};
const PdfTemplate = ({
    title = '',
    tables = [],
    logoBase64 = null, // optional
    fileName = 'Report.pdf',
    details = null,
    banner = 'psgitarlogo.jpg',
    fromDate = null,
    toDate = null
}) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Helper function for footer
    const drawFooter = () => {
        doc.setDrawColor(150);
        doc.setLineWidth(0.5);
        doc.line(10, pageHeight - 16, pageWidth - 10, pageHeight - 16);
        const footerText = `Report generated on ${new Date().toLocaleString()}`;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(
            footerText,
            pageWidth - doc.getTextWidth(footerText) - 10,
            pageHeight - 10
        );
    };

    // Draw banner
    const bannerWidth = 120;
    const bannerHeight = 18;
    doc.addImage(banner, 'JPEG', (pageWidth - bannerWidth) / 2, 5, bannerWidth, bannerHeight);

    // Draw title
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, bannerHeight + 15);

    let startY = bannerHeight + 20;

    // Record date text
    doc.setFontSize(10);
    if (fromDate && toDate) {
        if (fromDate === toDate) {
            doc.text(`Records for ${formatDate(fromDate)}`, 14, startY);
            startY += 7;
        } else {
            doc.text(`Records from ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, startY);
            startY += 7;
        }
    }

    if (details && Array.isArray(details) && details.length > 0) {
        // Group details into rows of two pairs (4 cells per row)
        const groupedData = [];
        for (let i = 0; i < details.length; i += 2) {
            const d1 = details[i];
            const d2 = details[i + 1];
            groupedData.push([
                `${d1.label}: ${d1.value}`,
                d2 ? `${d2.label}: ${d2.value}` : ''
            ]);
        }

        autoTable(doc, {
            startY,
            body: groupedData,
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 1.3, overflow: 'linebreak', fontStyle: 'bold' },
            margin: { left: 14, right: 14 },
            tableWidth: 'auto',
            didDrawPage: () => {
                drawFooter();
            },
        });

        startY = doc.lastAutoTable.finalY + 6; // tighter spacing after table
    }

    // Draw tables
    if (Array.isArray(tables) && tables.length > 0) {
        tables.forEach((table) => {
            const minTableSpace = 40; // Minimum space needed for a table title + at least one row
            const footerReserve = 26; // Space for footer and line
            if (startY > pageHeight - minTableSpace - footerReserve) {
                doc.addPage();
                startY = 20; // Top margin for new page
            }
            if (table.title) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(String(table.title), 14, startY);
                startY += 8;
            }

            // If after title, not enough space for table, add a new page
            if (startY > pageHeight - minTableSpace - footerReserve) {
                doc.addPage();
                startY = 20;
            }

            const margin = { top: startY, bottom: 20, left: 14, right: 14 };
            autoTable(doc, {
                startY,
                head: [table.columns.map(col => capitalize(col))],
                body: table.data,
                theme: "plain",
                styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
                headStyles: { fillColor: [63, 63, 149], textColor: [255, 255, 255] },
                margin,
                didDrawPage: () => {
                    drawFooter();
                }
            });
            startY = doc.lastAutoTable.finalY + 10;
        });
    } else {
        drawFooter(); // Footer even if no tables
    }

    doc.save(fileName);
};

export default PdfTemplate;
