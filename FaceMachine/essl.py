import mysql.connector
from datetime import datetime, timedelta
import math
from connection import db as db_connect
from holiday import get_holidays

def ensure_report_table(cursor):
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS report (
                staff_id VARCHAR(50),
                date DATE,
                late_mins FLOAT,
                attendance VARCHAR(1),
                PRIMARY KEY (staff_id, date)
            )
        """)
        print("Ensured report table exists")
    except mysql.connector.Error as err:
        print(f"Error creating report table: {err}")

def insert_log(cursor, staffs, logs, date, is_holiday):
    print("Inserting log")
    try:
        cursor.execute("SELECT * FROM category")
        categories = cursor.fetchall()
        print(f"Categories fetched: {categories}")
    except mysql.connector.Error as err:
        print(f"Error fetching categories: {err}")
        return

    for staff_id, category_id in staffs:
        print(f"Processing staff_id: {staff_id}, category_id: {category_id}")
        try:
            cursor.execute(
                "SELECT time FROM attendance_flags WHERE staff_id = %s AND date = %s",
                (staff_id, date)
            )
            flagged_times_raw = cursor.fetchall()
            flagged_times = {str(t[0]) for t in flagged_times_raw}
            print(f"Flagged times for {staff_id}: {flagged_times}")

            time_logs = [log_time for log_staff_id, log_time in logs if log_staff_id == staff_id]
            time_logs.sort()
            time_logs = [t if isinstance(t, str) else str(t) for t in time_logs]
            original_logs = time_logs.copy()
            time_logs = [t for t in time_logs if t not in flagged_times]
            print(f"Original logs for {staff_id}: {original_logs}")
            print(f"Filtered logs for {staff_id}: {time_logs}")
            if len(original_logs) > len(time_logs):
                print(f"Skipped {len(original_logs) - len(time_logs)} flagged logs for {staff_id}")

            if not time_logs:
                print(f"No logs for {staff_id} on {date}, skipping report")
                continue

            category_data = next((cat for cat in categories if cat[0] == category_id), None)
            if not category_data:
                print(f"No category data found for staff {staff_id}")
                continue
            print(f"Category data for {staff_id}: {category_data}")

            late_mins = 0
            attendance = 'P'
            is_fixed_hours = category_data[7] == 'fixed'
            half_day_morning = False
            half_day_afternoon = False

            if is_holiday or datetime.strptime(date, "%Y-%m-%d").weekday() == 6:
                if not time_logs:
                    print(f"No logs for {staff_id} on holiday or Sunday ({date}), skipping report")
                    continue

            try:
                time_objs = [datetime.strptime(f"{date} {t}", "%Y-%m-%d %H:%M:%S") for t in time_logs]
                print(f"Time objects for {staff_id}: {time_objs}")
            except ValueError as e:
                print(f"Error parsing time logs for {staff_id}: {e}")
                continue
            n = len(time_objs)

            if is_fixed_hours:
                in_time = category_data[2]
                break_in = category_data[3]
                break_out = category_data[4]
                out_time = category_data[5]
                allowed_break = int(category_data[6])
                in2 = category_data[8]
                out2 = category_data[9]

                # Validate category time fields
                time_fields = {'in_time': in_time, 'break_in': break_in, 'break_out': break_out, 
                              'out_time': out_time, 'in2': in2, 'out2': out2}
                for field_name, field_value in time_fields.items():
                    if field_value is None:
                        print(f"Error: {field_name} is None for staff {staff_id}, skipping processing")
                        continue
                    try:
                        datetime.strptime(f"{date} {field_value}", "%Y-%m-%d %H:%M:%S")
                    except ValueError as e:
                        print(f"Error parsing {field_name} for staff {staff_id}: {e}")
                        continue

                try:
                    start_const = datetime.strptime(f"{date} {in_time}", "%Y-%m-%d %H:%M:%S")
                    break_in_const = datetime.strptime(f"{date} {break_in}", "%Y-%m-%d %H:%M:%S")
                    break_out_const = datetime.strptime(f"{date} {break_out}", "%Y-%m-%d %H:%M:%S")
                    end_const = datetime.strptime(f"{date} {out_time}", "%Y-%m-%d %H:%M:%S")
                    in2_const = datetime.strptime(f"{date} {in2}", "%Y-%m-%d %H:%M:%S")
                    out2_const = datetime.strptime(f"{date} {out2}", "%Y-%m-%d %H:%M:%S")
                    print(f"Constants for {staff_id}: start={start_const}, break_in={break_in_const}, break_out={break_out_const}, end={end_const}, in2={in2_const}, out2={out2_const}")
                except ValueError as e:
                    print(f"Error parsing category times for {staff_id}: {e}")
                    continue

                # Morning check
                if time_objs[0] > start_const:
                    late_minutes = (time_objs[0] - start_const).total_seconds() / 60
                    if late_minutes > 90:
                        half_day_morning = True
                        attendance = 'H'
                        print(f"Morning absence > 90 mins for {staff_id}: {late_minutes}")
                    elif late_minutes > 15:
                        late_mins += late_minutes
                        print(f"Morning late mins for {staff_id}: {late_minutes}")

                if not any(t > in2_const for t in time_objs):
                    half_day_morning = True
                    attendance = 'H'
                    print(f"No logs after in2 for {staff_id}, marking morning half-day")

                # Break check
                break_mins = 0
                invalid_break_mins = 0
                i = 1
                while i < n - 1:
                    try:
                        exit_time = time_objs[i]
                        entry_time = time_objs[i + 1]
                        break_duration = (entry_time - exit_time).total_seconds() / 60
                        if (exit_time < break_in_const and entry_time <= break_in_const) or (exit_time > break_out_const and entry_time > break_out_const):
                            invalid_break_mins += break_duration
                            print(f"Invalid break for {staff_id}: {break_duration:.2f} mins (from {exit_time} to {entry_time}) added to late_mins")
                        else:
                            break_mins += break_duration
                            print(f"Break {i//2 + 1} for {staff_id}: {break_duration:.2f} mins (from {exit_time} to {entry_time})")
                        i += 2
                    except IndexError:
                        print(f"IndexError in break calculation for {staff_id} at index {i}")
                        break
                print(f"Total valid break mins for {staff_id}: {break_mins:.2f}")
                print(f"Total invalid break mins for {staff_id}: {invalid_break_mins:.2f}")

                # Afternoon check
                print(f"Checking logs after out2 for {staff_id}: {[t.time() for t in time_objs]}, out2={out2_const.time()}")
                if not any(t > out2_const for t in time_objs):
                    half_day_afternoon = True
                    attendance = 'H'
                    print(f"No logs after out2 for {staff_id}, marking half-day")
                else:
                    print(f"Logs found after out2 for {staff_id}")

                # Early out check
                if time_objs[-1] < end_const and not half_day_afternoon:
                    early_minutes = (end_const - time_objs[-1]).total_seconds() / 60
                    print(f"Early out check: last_log={time_objs[-1].time()}, end_const={end_const.time()}, early_minutes={early_minutes}")
                    if early_minutes > 90:
                        half_day_afternoon = True
                        attendance = 'H'
                        print(f"Early out > 90 mins for {staff_id}: {early_minutes}")
                    else:
                        late_mins += early_minutes
                        print(f"Early out mins added to late_mins for {staff_id}: {early_minutes}")

                # Excess break check
                if not (half_day_morning or half_day_afternoon) and break_mins > allowed_break:
                    excess_break = break_mins - allowed_break
                    late_mins += excess_break
                    print(f"Excess break mins for {staff_id}: {excess_break:.2f}")

                # Add invalid break minutes
                if invalid_break_mins > 0:
                    late_mins += invalid_break_mins
                    print(f"Added invalid break mins to late_mins for {staff_id}: {invalid_break_mins:.2f}")

                # Two half-days check
                if half_day_morning and half_day_afternoon:
                    attendance = 'I'
                    late_mins = 0
                    print(f"Both sessions half-day for {staff_id}, marking as 'I'")

            else:
                start_const = time_objs[0]
                end_temp = datetime.strptime(f"{date} {category_data[5]}", "%Y-%m-%d %H:%M:%S")
                end_const = start_const + timedelta(hours=end_temp.hour, minutes=end_temp.minute)
                allowed_break = int(category_data[6])

                if time_objs[-1] < end_const:
                    early_minutes = (end_const - time_objs[-1]).total_seconds() / 60
                    if early_minutes > 90:
                        half_day_afternoon = True
                        attendance = 'H'
                        print(f"Early out > 90 mins for {staff_id}: {early_minutes}")
                    else:
                        late_mins += early_minutes
                        print(f"Early out mins for {staff_id}: {early_minutes}")

                break_mins = 0
                i = 1
                while i < n - 1:
                    try:
                        exit_time = time_objs[i]
                        entry_time = time_objs[i + 1]
                        break_duration = (entry_time - exit_time).total_seconds() / 60
                        break_mins += break_duration
                        print(f"Break {i//2 + 1} for {staff_id}: {break_duration:.2f} mins (from {exit_time} to {entry_time})")
                        i += 2
                    except IndexError:
                        print(f"IndexError in break calculation for {staff_id} at index {i}")
                        break
                print(f"Total break mins for {staff_id}: {break_mins:.2f}")

                if not half_day_afternoon and break_mins > allowed_break:
                    excess_break = break_mins - allowed_break
                    late_mins += excess_break
                    print(f"Excess break mins for {staff_id}: {excess_break:.2f}")

                if half_day_afternoon and n == 1:
                    attendance = 'H'
                    late_mins = 0
                    print(f"Single log with early out for {staff_id}, marking half-day")

            if late_mins > 0:
                fractional_part = late_mins - int(late_mins)
                if fractional_part > 0.5:
                    late_mins = math.ceil(late_mins)
                else:
                    late_mins = math.floor(late_mins)
                print(f"Rounded late_mins for {staff_id}: {late_mins}")

            try:
                cursor.execute(
                    "SELECT 1 FROM report WHERE staff_id = %s AND date = %s",
                    (staff_id, date)
                )
                exists = cursor.fetchone()
                if exists:
                    cursor.execute(
                        "UPDATE report SET late_mins = %s, attendance = %s WHERE staff_id = %s AND date = %s",
                        (late_mins, attendance, staff_id, date)
                    )
                    print(f"Updated report for {staff_id}: Date: {date}, Late Minutes: {late_mins}, Attendance: {attendance}")
                else:
                    cursor.execute(
                        "INSERT INTO report (staff_id, date, late_mins, attendance) VALUES (%s, %s, %s, %s)",
                        (staff_id, date, late_mins, attendance)
                    )
                    print(f"Inserted report for {staff_id}: Date: {date}, Late Minutes: {late_mins}, Attendance: {attendance}")
            except mysql.connector.Error as err:
                print(f"Error inserting or updating report for {staff_id}: {err}")
        except mysql.connector.Error as err:
            print(f"Error processing staff {staff_id}: {err}")

def process_logs(date1=None):
    conn = db_connect()
    if not conn:
        print("Database connection failed.")
        return

    cursor = conn.cursor()
    today = date1 if date1 else datetime.now().date()
    holidays = get_holidays()
    is_holiday = today in holidays
    print(f"Processing date: {today}, is_holiday: {is_holiday}")

    try:
        ensure_report_table(cursor)
        cursor.execute("SELECT staff_id, category FROM staff")
        staffs = cursor.fetchall()
        print(f"Staffs fetched: {staffs}")

        cursor.execute("""
            SELECT logs.staff_id, logs.time
            FROM logs
            JOIN staff ON logs.staff_id = staff.staff_id
            WHERE logs.date = %s
        """, (today,))
        logs = cursor.fetchall()
        print(f"Logs fetched: {logs}")

        insert_log(cursor, staffs, logs, today, is_holiday)
        conn.commit()

    except mysql.connector.Error as err:
        print(f"Error: {err}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    process_logs("2025-09-30")