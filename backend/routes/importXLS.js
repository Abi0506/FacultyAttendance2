const xlsx = require("xlsx"); const db = require('../db');

async function importXLS(fileName) {
    try {
        const workbook = xlsx.readFile(fileName);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Convert sheet to array of objects (with header mapping)
        const data = xlsx.utils.sheet_to_json(sheet);
        const missingStaff = []
        for (const row of data) {
            const staff_id = row.NSTAFF_ID;
            const dateStr = row.PUNCH_DATE;
            const timeStr = row.PUNCH_TIME;

            if (!staff_id || !dateStr || !timeStr) continue;

            // Check if staff exists first
            const [staffRows] = await db.query(
                `SELECT staff_id FROM staff WHERE staff_id = ?`,
                [staff_id]
            );

            if (staffRows.length === 0) {
                // console.warn(`⚠️ Skipped ${staff_id} — not found in staff table`);
                if (!missingStaff.includes(staff_id)) {
                    missingStaff.push(staff_id)
                }
                continue;
            }

            // Convert date + time
            const [day, month, year] = dateStr.split("-");
            const formattedDate = `20${year}-${month}-${day}`;
            const formattedTime = `${timeStr.toString().slice(0, 2)}:${timeStr
                .toString()
                .slice(2)}`;

            await db.query(
                `INSERT INTO logs (staff_id, date, time) VALUES (?, ?, ?)`,
                [staff_id, formattedDate, formattedTime]
            );

            // console.log(`✅ Log inserted successfully for ${staff_id} ${formattedDate} ${formattedTime}`);
        }


        console.log("✅ XLS data imported successfully!");
        console.log("Missing staff IDS Include", missingStaff)
        process.exit(0);
    } catch (err) {
        console.error("❌ Failed to import XLS:", err);
        process.exit(1);
    }
}

importXLS("out.xls");
importXLS("in.xls")