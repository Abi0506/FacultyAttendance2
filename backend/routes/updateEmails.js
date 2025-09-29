require('dotenv').config();  // Ensure this is at the top of your file
const mysql = require('mysql2/promise');
const fs = require('fs');
const csv = require('csv-parser');

// Debugging: Log environment variables to check if they are loaded
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);

// Set up the MySQL connection pool
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "root",
  database: 'faculty_data_logs',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function updateEmails() {
  const connection = await pool.getConnection();

  try {
    // Read CSV file and process the data
    const staffData = [];
    fs.createReadStream('faculties.csv')
      .pipe(csv())
      .on('data', (row) => {
        staffData.push(row);
      })
      .on('end', async () => {
        console.log('CSV file successfully processed');

        try {
          await connection.beginTransaction(); 

          for (let staff of staffData) {
            const { faculty_id, faculty_mail } = staff;

            const [rows] = await connection.execute(
              'SELECT staff_id FROM staff WHERE staff_id = ?',
              [faculty_id]
            );

            if (rows.length > 0) {
              // Record exists, update the email
              const [result] = await connection.execute(
                'UPDATE staff SET email = ? WHERE staff_id = ?',
                [faculty_mail, faculty_id]
              );
              // console.log(`Updated email for faculty_id: ${faculty_id}`);
            } else {
              // Record does not exist
              console.log(`Record not found for faculty_id: ${faculty_id}`);
            }
          }

          await connection.commit(); // Commit the transaction
          console.log('All emails updated successfully!');

          // After the updates, query for any records with a NULL email
          const [nullEmails] = await connection.execute(
            'SELECT staff_id, name FROM staff WHERE email IS NULL'
          );

          if (nullEmails.length > 0) {
            console.log('Records with NULL email:');
            nullEmails.forEach(record => {
              console.log(`Faculty ID: ${record.staff_id}, Name: ${record.name}`);
            });
          } else {
            console.log('No records with NULL email found.');
          }
        } catch (error) {
          await connection.rollback(); // Rollback if there's an error
          console.error('Error updating emails:', error);
        } finally {
          connection.release();
        }
      });
  } catch (err) {
    console.error('Error processing CSV:', err);
  }
}

// Execute the function
updateEmails();
