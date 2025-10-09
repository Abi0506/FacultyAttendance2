import mysql.connector
from datetime import datetime, timedelta
from connection import db as db_connect

SESSION_TIMES = {
    "1": {"start": "08:30:00", "end": "09:20:00"},
    "2": {"start": "09:20:00", "end": "10:10:00"},
    "3": {"start": "10:25:00", "end": "11:15:00"},
    "4": {"start": "11:15:00", "end": "12:05:00"},
    "5": {"start": "13:10:00", "end": "14:00:00"},
    "6": {"start": "14:00:00", "end": "14:50:00"},
    "7": {"start": "15:05:00", "end": "15:55:00"},
    "8": {"start": "15:55:00", "end": "16:45:00"}
}

def process_exemptions(date1=None):
    """
    Reads the report table and recalculates late_mins for staff with unprocessed exemptions.
    """
    conn = db_connect()
    if not conn:
        print("Database connection failed.")
        return

    cursor = conn.cursor()
    today = date1 if date1 else datetime.now().date()
    print(f"--- Processing exemptions for {today} ---")

    try:
        # Fetch unprocessed exemptions
        cursor.execute(
            "SELECT * FROM exemptions WHERE exemptionDate = %s AND exemptionStatus = 'approved' AND processed = 0",
            (today,)
        )
        exemptions_to_process = cursor.fetchall()
        print(f"Exemptions to process: {exemptions_to_process}")
        if not exemptions_to_process:
            print("No new daily exemptions to process.")
            return

        # Fetch staff, category, logs, and report data
        cursor.execute("SELECT staff_id, category FROM staff")
        staff_map = {s[0]: s for s in cursor.fetchall()}
        cursor.execute("SELECT * FROM category")
        categories = {cat[0]: cat for cat in cursor.fetchall()}
        cursor.execute("SELECT staff_id, time FROM logs WHERE date = %s", (today,))
        logs_today_map = {}
        for log in cursor.fetchall():
            logs_today_map.setdefault(log[0], []).append(log[1])
        cursor.execute("SELECT staff_id, late_mins FROM report WHERE date = %s", (today,))
        report_map = {r[0]: r for r in cursor.fetchall()}

        # Process each exemption
        for exemption in exemptions_to_process:
            staff_id = exemption[1]  # staffId
            staff_info = staff_map.get(staff_id)
            initial_report = report_map.get(staff_id)
            if not staff_info or not initial_report:
                print(f"Skipping exemption for {staff_id}: No staff or report data")
                continue

            category_rules = categories.get(staff_info[1])
            staff_logs = sorted(logs_today_map.get(staff_id, []))
            initial_late_mins = initial_report[1]
            final_late_mins = initial_late_mins

            # Handle Day exemption
            if exemption[3] == 'Day':  # exemptionType
                final_late_mins = 0
                print(f"Day exemption for {staff_id}: late_mins set to 0")

            # Handle Time and Session exemptions
            elif staff_logs and exemption[3] in ['Time', 'Session']:
                exemption_start_time = None
                exemption_end_time = None
                if exemption[3] == 'Time' and exemption[4] and exemption[5]:  # start_time, end_time
                    exemption_start_time = exemption[4]
                    exemption_end_time = exemption[5]
                elif exemption[3] == 'Session':
                    session_key = exemption[6]  # exemptionSession
                    session_times = SESSION_TIMES.get(session_key)
                    if session_times:
                        exemption_start_time = datetime.strptime(session_times['start'], '%H:%M:%S').time()
                        exemption_end_time = datetime.strptime(session_times['end'], '%H:%M:%S').time()

                if not exemption_start_time:
                    print(f"Invalid exemption for {staff_id}: No valid start time")
                    continue

                try:
                    exemption_duration = (datetime.combine(today, exemption_end_time) - 
                                       datetime.combine(today, exemption_start_time)).total_seconds() / 60
                    print(f"Exemption duration for {staff_id}: {exemption_duration:.2f} mins")
                except (ValueError, TypeError) as e:
                    print(f"Error calculating exemption duration for {staff_id}: {e}")
                    continue

                if category_rules[7] == 'fixed':
                    final_late_mins = max(0, initial_late_mins - exemption_duration)
                    print(f"Fixed category for {staff_id}: late_mins {initial_late_mins} -> {final_late_mins}")
                elif category_rules[7] == 'hrs':
                    required_mins = (datetime.strptime(category_rules[5], '%H:%M:%S').hour * 60 +
                                   datetime.strptime(category_rules[5], '%H:%M:%S').minute)
                    total_duration = (datetime.combine(today, staff_logs[-1]) - 
                                    datetime.combine(today, staff_logs[0])).total_seconds() / 60
                    
                    break_mins = 0
                    for i in range(1, len(staff_logs) - 1, 2):
                        try:
                            break_mins += (datetime.combine(today, staff_logs[i+1]) - 
                                         datetime.combine(today, staff_logs[i])).total_seconds() / 60
                        except (ValueError, IndexError) as e:
                            print(f"Error calculating break for {staff_id}: {e}")
                            continue
                    
                    actual_work_mins = total_duration - break_mins
                    effective_work_mins = actual_work_mins + exemption_duration
                    final_late_mins = max(0, required_mins - effective_work_mins)
                    print(f"Hrs category for {staff_id}: work_mins={actual_work_mins:.2f}, effective={effective_work_mins:.2f}, late_mins={final_late_mins}")

            # Update report if late_mins changed
            if round(final_late_mins) != round(initial_late_mins):
                try:
                    cursor.execute(
                        "UPDATE report SET late_mins = %s WHERE staff_id = %s AND date = %s",
                        (round(final_late_mins), staff_id, today)
                    )
                    print(f"Updated report for {staff_id} after exemption: late_mins={round(final_late_mins)}")
                except mysql.connector.Error as err:
                    print(f"Error updating report for {staff_id}: {err}")

        # Mark exemptions as processed
        processed_ids = tuple(ex[0] for ex in exemptions_to_process)
        if processed_ids:
            try:
                if len(processed_ids) == 1:
                    cursor.execute("UPDATE exemptions SET processed = 1 WHERE exemptionId = %s", (processed_ids[0],))
                else:
                    cursor.execute("UPDATE exemptions SET processed = 1 WHERE exemptionId IN %s", (processed_ids,))
                print(f"Marked exemptions as processed: {processed_ids}")
            except mysql.connector.Error as err:
                print(f"Error marking exemptions as processed: {err}")

        conn.commit()
        print(f"--- Exemption processing complete. ---")

    except mysql.connector.Error as err:
        print(f"Database error during exemption processing: {err}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    process_exemptions("2025-09-30")