import mysql.connector
from datetime import datetime, timedelta
import math
from connection import db as db_connect
from holiday import get_holidays

def insert_log(cursor, staffs, logs, date, is_holiday):
    print("Inserting log")
    cursor.execute("SELECT * FROM category")
    categories = cursor.fetchall()

    for staff_id, category_id in staffs:
        # Fetch flagged times
        cursor.execute(
            "SELECT time FROM attendance_flags WHERE staff_id = %s AND date = %s",
            (staff_id, date)
        )
        flagged_times_raw = cursor.fetchall()
        flagged_times = {str(t[0]) for t in flagged_times_raw}
        print(f"Flagged times for {staff_id}:", flagged_times)

        # Get leave record
        cursor.execute("SELECT * FROM `leave` WHERE staff_id = %s AND %s BETWEEN start_date AND end_date",
                       (staff_id, date))
        leave_record = cursor.fetchone()

        # Filter log times
        time_logs = [log_time for log_staff_id, log_time in logs if log_staff_id == staff_id]
        time_logs.sort()

        # Remove flagged log times
        time_logs = [t for t in time_logs if t not in flagged_times]
        print(f"Filtered logs for {staff_id}:", time_logs)

        # Skip if on leave with no logs
        if leave_record and not time_logs:
            attendance = 'L'
            late_mins = 0
            print(f"Staff ID: {staff_id}, Date: {date}, Late Minutes: {round(late_mins, 2)}, Attendance: {attendance}")
            cursor.execute(
                "INSERT INTO attendance (staff_id, date, late_mins, attendance) VALUES (%s, %s, %s, %s)",
                (staff_id, date, late_mins, attendance)
            )
            continue

        # Category data lookup
        category_data = next((cat for cat in categories if cat[0] == category_id), None)
        if not category_data:
            print(f"No category data found for staff {staff_id}")
            continue

        late_mins = 0
        attendance = 'P'
        is_fixed_hours = category_data[7] == 'fixed'
        half_day_morning = False
        half_day_afternoon = False

        # Holiday logic
        if is_holiday or datetime.today().weekday() == 6:
            if not time_logs:
                continue

        if not time_logs:
            attendance = 'A'
            print(f"Staff ID: {staff_id}, Date: {date}, Late Minutes: {round(late_mins, 2)}, Attendance: {attendance}")
            cursor.execute(
                "INSERT INTO report (staff_id, date, late_mins, attendance) VALUES (%s, %s, %s, %s)",
                (staff_id, date, late_mins, attendance)
            )
            continue

        time_objs = [datetime.strptime(f"{date} {t}", "%Y-%m-%d %H:%M:%S") for t in time_logs]
        n = len(time_objs)

        if is_fixed_hours:
            in_time = category_data[2]
            break_in = category_data[3]
            break_out = category_data[4]
            out_time = category_data[5]
            allowed_break = int(category_data[6])

            start_const = datetime.strptime(f"{date} {in_time}", "%Y-%m-%d %H:%M:%S")
            break_in_const = datetime.strptime(f"{date} {break_in}", "%Y-%m-%d %H:%M:%S")
            break_out_const = datetime.strptime(f"{date} {break_out}", "%Y-%m-%d %H:%M:%S")
            end_const = datetime.strptime(f"{date} {out_time}", "%Y-%m-%d %H:%M:%S")

            # Morning session logic
            if time_objs[0] > start_const:
                late_minutes = (time_objs[0] - start_const).total_seconds() / 60
                if late_minutes > 90:
                    half_day_morning = True
                    attendance = 'H'
                    print("Morning absence > 90 mins, marking half-day")
                elif late_minutes > 15:
                    late_mins += late_minutes
                    print("Morning late mins:", late_minutes)
            elif not any(t <= break_in_const for t in time_objs):
                half_day_morning = True
                attendance = 'H'
                print("No logs before break_in, marking half-day")

            # Break-in logic
            break_in_log = next((t for t in time_objs if break_in_const <= t <= break_out_const), None)
            morning_present = any(t <= break_in_const for t in time_objs)
            if break_in_log:
                if morning_present and break_in_log < break_in_const:
                    early_minutes = (break_in_const - break_in_log).total_seconds() / 60
                    if early_minutes > 90:
                        half_day_morning = True
                        attendance = 'H'
                        print("Early break-in > 90 mins:", early_minutes)
                    else:
                        late_mins += early_minutes
                        print("Early break-in mins:", early_minutes)
            else:
                if morning_present:
                    half_day_afternoon = True
                    attendance = 'H'
                    print("No break-in log within window, marking half-day afternoon")

            # Out-time logic
            if not half_day_afternoon and time_objs[-1] < end_const:
                early_minutes = (end_const - time_objs[-1]).total_seconds() / 60
                if early_minutes > 90:
                    half_day_afternoon = True
                    attendance = 'H'
                    print("Early out > 90 mins:", early_minutes)
                else:
                    late_mins += early_minutes
                    print("Early out mins:", early_minutes)

            # Break time calculation
            break_mins = 0
            for i in range(1, n - 1, 2):
                try:
                    exit_time = time_objs[i]
                    entry_time = time_objs[i + 1]
                    break_mins += (entry_time - exit_time).total_seconds() / 60
                    print(f"Break mins: {break_mins:.2f}")
                except IndexError:
                    continue
                if not (half_day_morning or half_day_afternoon) and break_mins > allowed_break:
                    late_mins += break_mins - allowed_break
                    print("Excess break mins:", late_mins)

            # Check for two half-days
            if half_day_morning and half_day_afternoon:
                attendance = 'A'
                late_mins = 0
                print("Both sessions half-day, marking absent")

        else:
            # Hourly-based category
            start_const = time_objs[0]
            end_temp = datetime.strptime(f"{date} {category_data[5]}", "%Y-%m-%d %H:%M:%S")
            end_const = start_const + timedelta(hours=end_temp.hour, minutes=end_temp.minute)
            allowed_break = int(category_data[6])

            # Out-time logic
            if time_objs[-1] < end_const:
                early_minutes = (end_const - time_objs[-1]).total_seconds() / 60
                if early_minutes > 90:
                    half_day_afternoon = True
                    attendance = 'H'
                    print("Early out > 90 mins:", early_minutes)
                else:
                    late_mins += early_minutes
                    print("Early out mins:", early_minutes)

            # Break time calculation
            break_mins = 0
            for i in range(1, n - 1, 2):
                try:
                    exit_time = time_objs[i]
                    entry_time = time_objs[i + 1]
                    break_mins += (entry_time - exit_time).total_seconds() / 60
                    print(f"Break mins: {break_mins:.2f}")
                except IndexError:
                    continue
                if not half_day_afternoon and break_mins > allowed_break:
                    late_mins += break_mins - allowed_break
                    print("Excess break mins:", late_mins)

            # Check for absence
            if half_day_afternoon and n == 1:
                attendance = 'A'
                late_mins = 0
                print("Single log with early out, marking absent")

        # Round late_mins based on rule
        if late_mins > 0:
            fractional_part = late_mins - int(late_mins)
            if fractional_part > 0.5:
                late_mins = math.ceil(late_mins)
            else:
                late_mins = math.floor(late_mins)
            print(f"Rounded late_mins: {late_mins}")

        # Insert into attendance table
        try:
            cursor.execute(
                "INSERT INTO report (staff_id, date, late_mins, attendance) VALUES (%s, %s, %s, %s)",
                (staff_id, date, late_mins, attendance)
            )
            print(f"Inserted report for {staff_id}: Date: {date}, Late Minutes: {late_mins}, Attendance: {attendance}")
        except mysql.connector.Error as err:
            print(f"Error inserting report for {staff_id}: {err}")

def process_logs(date1=None):
    conn = db_connect()
    if not conn:
        print("Database connection failed.")
        return

    cursor = conn.cursor()
    today = date1 if date1 else datetime.now().date()
    holidays = get_holidays()
    is_holiday = today in holidays

    try:
        cursor.execute("SELECT staff_id, category FROM staff")
        staffs = cursor.fetchall()

        cursor.execute("""
            SELECT logs.staff_id, logs.time
            FROM logs
            JOIN staff ON logs.staff_id = staff.staff_id
            WHERE logs.date = %s
        """, (today,))
        logs = cursor.fetchall()

        insert_log(cursor, staffs, logs, today, is_holiday)
        conn.commit()

    except mysql.connector.Error as err:
        print(f"Error: {err}")
    finally:
        cursor.close()
        conn.close()
if __name__ == "__main__":
    process_logs("2025-10-08")