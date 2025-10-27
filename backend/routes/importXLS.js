const xlsx = require("xlsx");
const db = require('../db');
const hashPassword = require("../routes/passWord")

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
async function importStaffEmails(fileName) {
    try {
        const workbook = xlsx.readFile(fileName);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        let updatedCount = 0;
        let insertedCount = 0;
        let skippedCount = 0;

        for (const row of data) {
            const staff_id = row["Employee-ID"];
            const name = row["Employee-Name"];
            const dept = row["Department"];
            const email = row["Email"];

            if (!staff_id || !name || !dept) {
                skippedCount++;
                continue;
            }

            // Check if staff exists
            const [existing] = await db.query(
                `SELECT staff_id FROM staff WHERE staff_id = ?`,
                [staff_id]
            );

            if (existing.length > 0) {
                // Staff exists → update email (if provided)
                if (email) {
                    await db.query(
                        `UPDATE staff SET email = ? WHERE staff_id = ?`,
                        [email, staff_id]
                    );
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            } else {
                // New staff → hash staff_id for password
                const hashedPassword = await hashPassword(staff_id.toString());

                await db.query(
                    `INSERT INTO staff (staff_id, name, dept, category, password, designation, email)
                     VALUES (?, ?, ?, 1, ?, NULL, ?)`,
                    [staff_id, name, dept, hashedPassword, email || null]
                );
                insertedCount++;
            }
        }

        console.log("✅ Staff import/update completed!");
        console.log(`➡️ Updated existing staff emails: ${updatedCount}`);
        console.log(`➡️ Inserted new staff records: ${insertedCount}`);
        console.log(`➡️ Skipped (missing fields or empty email): ${skippedCount}`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Failed to import XLS:", err);
        process.exit(1);
    }
}

async function fillMissingEmails() {
    try {
        // Step 1: Find all staff with missing or empty email
        const [rows] = await db.query(
            `SELECT staff_id FROM staff WHERE email IS NULL OR TRIM(email) = ''`
        );

        if (rows.length === 0) {
            console.log("✅ No staff with missing emails found.");
            process.exit(0);
        }

        // Step 2: Update all matching records
        const [result] = await db.query(
            `UPDATE staff 
             SET email = 'hr@psgitech.ac.in' 
             WHERE email IS NULL OR TRIM(email) = ''`
        );

        console.log("✅ Email update completed!");
        console.log(`➡️ Records updated: ${result.affectedRows}`);
        console.log(
            "➡️ Updated staff IDs:",
            rows.map(r => r.staff_id).join(", ")
        );

        process.exit(0);
    } catch (err) {
        console.error("❌ Failed to update missing emails:", err);
        process.exit(1);
    }
}


async function importCanteenStaff(fileName) {
    try {
        const workbook = xlsx.readFile(fileName);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        let insertedCount = 0;
        let skippedCount = 0;

        for (const row of data) {
            const staff_id = row["Employee Id"];
            const name = row["Employee Name with initial"];
            const designation = row["Designation"];

            // Skip invalid rows
            if (!staff_id || !name) {
                skippedCount++;
                continue;
            }

            // Check if staff already exists (avoid duplicates)
            const [existing] = await db.query(
                `SELECT staff_id FROM staff WHERE staff_id = ?`,
                [staff_id]
            );

            if (existing.length > 0) {
                skippedCount++;
                continue;
            }

            // Hash staff_id for password
            const hashedPassword = await hashPassword(staff_id.toString());

            // Insert into staff table
            await db.query(
                `INSERT INTO staff (staff_id, name, dept, category, password, designation, email)
                 VALUES (?, ?, 'CANTEEN', 1, ?, ?, 'hr@psgitech.ac.in')`,
                [staff_id, name, hashedPassword, designation || null]
            );

            insertedCount++;
        }

        console.log("✅ CANTEEN staff import completed!");
        console.log(`➡️ Inserted new records: ${insertedCount}`);
        console.log(`➡️ Skipped (missing or duplicate staff): ${skippedCount}`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Failed to import CANTEEN staff:", err);
        process.exit(1);
    }
}
async function importPhDStudents(fileName) {
    try {
        const workbook = xlsx.readFile(fileName);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        let insertedCount = 0;
        let skippedCount = 0;

        for (const row of data) {
            const staff_id = row["Roll No"] || row["Dummy Roll No"];
            const name = row["Student Name"];
            const programName = row["Program Name"];
            const email = row["Student e-mail"];

            if (!staff_id || !name || !programName) {
                skippedCount++;
                continue;
            }

            // Crop "DOCTOR OF PHILOSOPHY IN " from Program Name
            const designation = programName
                .replace(/^DOCTOR OF PHILOSOPHY IN\s*/i, "")
                .trim();

            // Department is fixed as PHD
            const dept = "PHD";

            // Check if staff already exists
            const [existing] = await db.query(
                `SELECT staff_id FROM staff WHERE staff_id = ?`,
                [staff_id]
            );

            if (existing.length > 0) {
                skippedCount++;
                continue;
            }

            // Hash Roll No as password
            const hashedPassword = await hashPassword(staff_id.toString());

            // Insert into table
            await db.query(
                `INSERT INTO staff (staff_id, name, dept, category, password, designation, email)
                 VALUES (?, ?, ?, 5, ?, ?, ?)`,
                [staff_id, name, dept, hashedPassword, designation, email || null]
            );

            insertedCount++;
        }

        console.log("✅ PhD student import completed!");
        console.log(`➡️ Inserted: ${insertedCount}`);
        console.log(`➡️ Skipped (missing or duplicate): ${skippedCount}`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Failed to import PhD students:", err);
        process.exit(1);
    }
}

importPhDStudents("research.xlsx")

// Example usage:
// importCanteenStaff("canteen.xlsx");


// Example usage:
// importStaffEmails("details.xlsx");

// fillMissingEmails();





// importXLS("out.xls");
// importXLS("in.xls");
