import React from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';



const PdfTemplate = ({
    title = '',
    tables = [],
    logoBase64 = 'logo.png',
    details = null,
    fileName = 'report.pdf'
}) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const headerHeight = 30;
    const footerHeight = 15;

    // header background
    doc.setFillColor(230, 230, 230);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    // (left)
    const logoWidth = 20;
    const logoHeight = 20;
    if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 14, 5, logoWidth, logoHeight);
    }

    // (center)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, 17);

    // (right)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const rightText = 'PSG iTech';
    const rightTextWidth = doc.getTextWidth(rightText);
    doc.text(rightText, pageWidth - rightTextWidth - 14, 17);

    // Details section (if provided)
    let startY = headerHeight + 10;
    if (details && Array.isArray(details)) {
        let y = startY;
        details.forEach((item) => {
            doc.text(`${item.label}: ${item.value}`, 14, y);
            y += 8; // adjust spacing as needed
        });
        startY = y;
    }

    // Multi-table support
    if (Array.isArray(tables) && tables.length > 0) {
        tables.forEach((table, idx) => {
            autoTable(doc, {
                startY,
                head: [table.columns],
                body: table.data,
                theme: 'plain',
                styles: { fontSize: 10, cellPadding: 3 },
                headStyles: { fillColor: [63, 63, 149], textColor: [255, 255, 255] },
            });
            startY = doc.lastAutoTable.finalY + 10;
        });
    }

    // footer background
    doc.setFillColor(230, 230, 230);
    doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');

    // footer text
    const footerText = `Generated on ${new Date().toLocaleDateString()}`;
    doc.setFontSize(10);
    const footerTextWidth = doc.getTextWidth(footerText);
    doc.text(
        footerText,
        (pageWidth - footerTextWidth) / 2,
        pageHeight - footerHeight / 2 + 1
    );

    doc.save(fileName);
};

export default PdfTemplate;