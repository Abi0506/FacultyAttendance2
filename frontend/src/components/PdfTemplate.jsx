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

const PdfTemplate = ({
    title = '',
    tables = [],
    logoBase64 = null, // optional
    fileName = 'report.pdf',
    details = null,
    banner = 'psgitarlogo.jpg',
    fromDate = null,
    toDate = null
}) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    // Banner ratio - 60*9
    const bannerWidth = 120;
    const bannerHeight = 18;
    doc.addImage(banner, 'JPEG', (pageWidth - bannerWidth) / 2, 5, bannerWidth, bannerHeight);

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, bannerHeight + 20);

    let startY = bannerHeight + 35;
    doc.setFontSize(15); // smaller font for record dates
    if (fromDate && toDate) {
        if (fromDate === toDate) {
            doc.text(`Records for ${formatDate(fromDate)}`, 14, startY);
            startY += 6;
        } else {
            doc.text(`Records from ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, startY);
            startY += 6;
        }
    }

    if (details && Array.isArray(details)) {
        details.forEach((item) => {
            doc.text(`${item.label}: ${item.value}`, 14, startY);
            startY += 6;
        });
    }

    if (Array.isArray(tables) && tables.length > 0) {
        tables.forEach((table) => {
            autoTable(doc, {
                startY,
                head: [table.columns],
                body: table.data,
                theme: 'plain',
                styles: { fontSize: 10, cellPadding: 3 },
                headStyles: { fillColor: [63, 63, 149], textColor: [255, 255, 255] },
                didDrawPage: () => {
                    const footerText = `Report generated on ${new Date().toLocaleString()}`;
                    doc.setFontSize(10);
                    doc.text(
                        footerText,
                        pageWidth - doc.getTextWidth(footerText) - 10,
                        pageHeight - 10
                    );
                }
            });
            startY = doc.lastAutoTable.finalY + 10;
        });
    } else {
        // Footer even if no tables
        const footerText = `Report generated on ${new Date().toLocaleString()}`;
        doc.setFontSize(10);
        doc.text(
            footerText,
            pageWidth - doc.getTextWidth(footerText) - 10,
            pageHeight - 10
        );
    }

    doc.save(fileName);
};

export default PdfTemplate;
