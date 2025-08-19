import mysql.connector
from datetime import datetime
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

def process_exemptions():
    """
    Reads the initial report and performs a full recalculation of late_mins for staff with unprocessed exemptions.
    """
    conn = db_connect()
    if not conn: return

    cursor = conn.cursor(dictionary=True)
    today = datetime.now().date()
    print(f"--- Processing exemptions for {today} ---")

    try:
        # 1. Fetch all unprocessed daily exemptions for today
        cursor.execute(
            "SELECT * FROM exemptions WHERE exemptionDate = %s AND exemptionStatus = 'approved' AND processed = 0",
            (today,)
        )
        exemptions_to_process = cursor.fetchall()

        if not exemptions_to_process:
            print("No new daily exemptions to process.")
            return

        # 2. Fetch all necessary data for calculations
        cursor.execute("SELECT staff_id, category FROM staff")
        staff_map = {s['staff_id']: s for s in cursor.fetchall()}
        cursor.execute("SELECT * FROM category")
        categories = {cat['category_no']: cat for cat in cursor.fetchall()}
        cursor.execute("SELECT * FROM logs WHERE date = %s", (today,))
        logs_today_map = {}
        for log in cursor.fetchall():
            logs_today_map.setdefault(log['staff_id'], []).append(log['time'])
        
        cursor.execute("SELECT * FROM report WHERE date = %s", (today,))
        report_map = {r['staff_id']: r for r in cursor.fetchall()}

        # 3. Loop through each exemption and perform a full recalculation
        for exemption in exemptions_to_process:
            staff_id = exemption['staffId']
            staff_info = staff_map.get(staff_id)
            initial_report = report_map.get(staff_id)

            if not staff_info or not initial_report:
                continue

            category_rules = categories.get(staff_info['category'])
            staff_logs = sorted(logs_today_map.get(staff_id, []))
            initial_late_mins = initial_report['late_mins']
            final_late_mins = 0
            
            # --- Handle 'Day' Exemption ---
            if exemption['exemptionType'] == 'Day':
                final_late_mins = 0
            
            # --- Handle 'Time' and 'Session' Exemptions ---
            elif staff_logs and exemption['exemptionType'] in ['Time', 'Session']:
                # Determine the exemption window
                exemption_start_time = None
                exemption_end_time = None
                
                if exemption['exemptionType'] == 'Time' and exemption.get('start_time'):
                    exemption_start_time = exemption['start_time']
                    exemption_end_time = exemption['end_time']
                elif exemption['exemptionType'] == 'Session':
                    session_key = exemption['exemptionSession']
                    session_times = SESSION_TIMES.get(session_key)
                    if session_times:
                        exemption_start_time = datetime.strptime(session_times['start'], '%H:%M:%S').time()
                        exemption_end_time = datetime.strptime(session_times['end'], '%H:%M:%S').time()

                if not exemption_start_time:
                    continue
                
                exemption_duration = (datetime.combine(today, exemption_end_time) - datetime.combine(today, exemption_start_time)).total_seconds() / 60
                
                # RECALCULATE based on category type
                if category_rules['type'] == 'fixed':
                    # For 'fixed' time, we subtract the exemption duration from the initial penalty
                    final_late_mins = max(0, initial_late_mins - exemption_duration)
                
                elif category_rules['type'] == 'hrs':
                    # For 'hrs', the exemption provides credited work time
                    required_mins = (datetime.strptime(category_rules['out_time'], '%H:%M:%S').hour * 60)
                    total_duration = (datetime.combine(today, staff_logs[-1]) - datetime.combine(today, staff_logs[0])).total_seconds() / 60
                    
                    break_mins = 0
                    for i in range(1, len(staff_logs) - 1, 2):
                        break_mins += (datetime.combine(today, staff_logs[i+1]) - datetime.combine(today, staff_logs[i])).total_seconds() / 60
                    
                    actual_work_mins = total_duration - break_mins
                    effective_work_mins = actual_work_mins + exemption_duration
                    final_late_mins = max(0, required_mins - effective_work_mins)

            # --- Update the report with the final calculated value ---
            if round(final_late_mins) != round(initial_late_mins):
                cursor.execute(
                    "UPDATE report SET late_mins = %s WHERE staff_id = %s AND date = %s",
                    (round(final_late_mins), staff_id, today)
                )

        # 4. Mark all processed daily exemptions for the day
        processed_ids = tuple(ex['exemptionId'] for ex in exemptions_to_process)
        if len(processed_ids) == 1:
            cursor.execute("UPDATE exemptions SET processed = 1 WHERE exemptionId = %s", (processed_ids[0],))
        elif len(processed_ids) > 1:
            cursor.execute("UPDATE exemptions SET processed = 1 WHERE exemptionId IN %s", (processed_ids,))

        conn.commit()
        print(f"--- Exemption processing complete. ---")

    except mysql.connector.Error as err:
        print(f"Database error during exemption processing: {err}")
        conn.rollback()
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()