const xlsx = require("xlsx");
const db = require('../db');

async function importXLS(fileName) {
    try {
        const workbook = xlsx.readFile(fileName);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Convert sheet to array of objects (with header mapping)
        const data = xlsx.utils.sheet_to_json(sheet);
        const missingStaff = [];
        let insertedCount = 0;
        let skippedCount = 0;

        for (const row of data) {
            const staff_id = row.NSTAFF_ID;
            const dateStr = row.PUNCH_DATE;
            const timeStr = row.PUNCH_TIME;

            if (!staff_id || !dateStr || !timeStr) continue;

            // Check if staff exists
            const [staffRows] = await db.query(
                `SELECT staff_id FROM staff WHERE staff_id = ?`,
                [staff_id]
            );

            if (staffRows.length === 0) {
                if (!missingStaff.includes(staff_id)) missingStaff.push(staff_id);
                continue;
            }

            // Convert date + time formats
            const [day, month, year] = dateStr.split("-");
            const formattedDate = `20${year}-${month}-${day}`;
            const formattedTime = `${timeStr.toString().slice(0, 2)}:${timeStr
                .toString()
                .slice(2)}`;

            // ✅ Check if record already exists
            const [existing] = await db.query(
                `SELECT * FROM logs WHERE staff_id = ? AND date = ? AND time = ?`,
                [staff_id, formattedDate, formattedTime]
            );

            if (existing.length > 0) {
                skippedCount++;
                continue; // Skip duplicate entry
            }

            // Insert new record
            await db.query(
                `INSERT INTO logs (staff_id, date, time) VALUES (?, ?, ?)`,
                [staff_id, formattedDate, formattedTime]
            );

            insertedCount++;
        }

        console.log("✅ XLS data import completed!");
        console.log(`➡️ Inserted: ${insertedCount} | Skipped (duplicates): ${skippedCount}`);
        if (missingStaff.length > 0)
            console.log("⚠️ Missing staff IDs:", missingStaff.join(", "));

        process.exit(0);
    } catch (err) {
        console.error("❌ Failed to import XLS:", err);
        process.exit(1);
    }
}

importXLS("out.xls");
importXLS("in.xls");
