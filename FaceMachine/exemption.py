import mysql.connector
from datetime import datetime, timedelta
import math
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
    Processes all approved and unprocessed exemptions where exemptionDate is before yesterday.
    - Day: Sets late_mins=0, attendance='P', skips log processing.
    - Time/Session: Excludes logs in exempted period, calculates late_mins for remaining periods using essl.py logic for fixed category.
    """
    conn = db_connect()
    if not conn:
        print("Database connection failed.")
        return

    cursor = conn.cursor()
    current_date = datetime.now().date()
   

    try:
        # Fetch all unprocessed approved exemptions where exemptionDate <= yesterday
        cursor.execute(
            "SELECT * FROM exemptions WHERE exemptionStatus = 'approved' AND processed = 0",
          
        )
        exemptions_to_process = cursor.fetchall()
        print(f"Exemptions to process: {exemptions_to_process}")
        if not exemptions_to_process:
            print("No unprocessed approved exemptions found for past dates.")
            return

        # Fetch staff and category data
        cursor.execute("SELECT staff_id, category FROM staff")
        staff_map = {s[0]: s for s in cursor.fetchall()}
        cursor.execute("SELECT * FROM category")
        categories = {cat[0]: cat for cat in cursor.fetchall()}

        processed_ids = []
        for exemption in exemptions_to_process:
            exemption_id = exemption[0]  # exemptionId
            staff_id = exemption[2]  # staffId
            exemption_date = exemption[5]  # exemptionDate
            exemption_type = exemption[1].lower()  # exemptionType
            start_time = exemption[8] if len(exemption) > 8 else None  # start_time
            end_time = exemption[9] if len(exemption) > 9 else None  # end_time
            session_key = exemption[4] if len(exemption) > 10 else None  # exemptionSession

            staff_info = staff_map.get(staff_id)
            if not staff_info:
                print(f"Skipping exemption {exemption_id} for {staff_id}: No staff record found")
                continue

            category_rules = categories.get(staff_info[1])
            if not category_rules:
                print(f"Skipping exemption {exemption_id} for {staff_id}: No category data for category {staff_info[1]}")
                continue

            # Initialize report variables
            final_late_mins = 0
            final_attendance = 'P'

            if exemption_type == 'day':
                print(f"Day exemption for {staff_id}: late_mins set to 0, attendance set to P")
            else:
                # Fetch logs and flagged times for Time/Session exemptions
                cursor.execute("SELECT time FROM logs WHERE staff_id = %s AND date = %s", (staff_id, exemption_date))
                staff_logs = sorted([row[0] if isinstance(row[0], str) else str(row[0]) for row in cursor.fetchall()])
                cursor.execute(
                    "SELECT time FROM attendance_flags WHERE staff_id = %s AND date = %s",
                    (staff_id, exemption_date)
                )
                flagged_times_raw = cursor.fetchall()
                flagged_times = {str(t[0]) for t in flagged_times_raw}
                print(f"Flagged times for {staff_id} on {exemption_date}: {flagged_times}")

                # Filter logs
                original_logs = staff_logs.copy()
                staff_logs = [t for t in staff_logs if t not in flagged_times]
                print(f"Original logs for {staff_id} on {exemption_date}: {original_logs}")
                print(f"Filtered logs for {staff_id} on {exemption_date}: {staff_logs}")
                if len(original_logs) > len(staff_logs):
                    print(f"Skipped {len(original_logs) - len(staff_logs)} flagged logs for {staff_id}")

                # Handle Time or Session exemption
                exemption_start_time = None
                exemption_end_time = None
                if exemption_type == 'time' and start_time and end_time:
                    exemption_start_time = start_time
                    exemption_end_time = end_time
                elif exemption_type == 'session' and session_key:
                    session_times = SESSION_TIMES.get(session_key)
                    if session_times:
                        exemption_start_time = datetime.strptime(session_times['start'], '%H:%M:%S').time()
                        exemption_end_time = datetime.strptime(session_times['end'], '%H:%M:%S').time()

                if not exemption_start_time or not exemption_end_time:
                    print(f"Skipping exemption {exemption_id} for {staff_id}: Invalid start/end time")
                    continue

                # Filter logs outside the exempted period
                exemption_start_dt = datetime.combine(exemption_date, exemption_start_time)
                exemption_end_dt = datetime.combine(exemption_date, exemption_end_time)
                filtered_logs = [
                    t for t in staff_logs
                    if not (exemption_start_dt <= datetime.strptime(f"{exemption_date} {t}", "%Y-%m-%d %H:%M:%S") <= exemption_end_dt)
                ]
                print(f"Logs after excluding exempted period for {staff_id}: {filtered_logs}")

                # Check for odd number of logs and remove last log if odd
                if len(filtered_logs) % 2 != 0 and filtered_logs:
                    removed_log = filtered_logs.pop()
                    print(f"Odd number of logs for {staff_id}, removed last log: {removed_log}")
                    print(f"Updated logs for {staff_id}: {filtered_logs}")

                half_day_morning = False
                half_day_afternoon = False

                # Check if exemption covers the entire workday or afternoon
                if category_rules[7] == 'fixed':
                    in_time = datetime.strptime(f"{exemption_date} {category_rules[2]}", "%Y-%m-%d %H:%M:%S")
                    out_time = datetime.strptime(f"{exemption_date} {category_rules[5]}", "%Y-%m-%d %H:%M:%S")
                    break_out = datetime.strptime(f"{exemption_date} {category_rules[4]}", "%Y-%m-%d %H:%M:%S")
                    if exemption_start_dt <= in_time and exemption_end_dt >= out_time:
                        print(f"Exemption covers entire workday for {staff_id}, setting late_mins=0, attendance=P")
                        final_late_mins = 0
                        final_attendance = 'P'
                    else:
                        # Check if exemption covers afternoon (break_out to out_time)
                        if exemption_start_dt <= break_out and exemption_end_dt >= out_time:
                            half_day_afternoon = False
                            print(f"Exemption covers afternoon for {staff_id}, checking morning only")
                        else:
                            half_day_afternoon = True
                            print(f"Exemption does not cover entire afternoon, checking logs")
                else:  # hrs category
                    required_mins = (datetime.strptime(category_rules[5], '%H:%M:%S').hour * 60 +
                                    datetime.strptime(category_rules[5], '%H:%M:%S').minute)
                    exemption_duration = (exemption_end_dt - exemption_start_dt).total_seconds() / 60
                    if exemption_duration >= required_mins:
                        print(f"Exemption covers required hours for {staff_id}, setting late_mins=0, attendance=P")
                        final_late_mins = 0
                        final_attendance = 'P'
                    else:
                        half_day_afternoon = True
                        print(f"Exemption does not cover required hours, checking logs")

                # Process remaining logs if not fully covered
                if final_attendance != 'P' or half_day_afternoon:
                    try:
                        time_objs = [datetime.strptime(f"{exemption_date} {t}", "%Y-%m-%d %H:%M:%S") for t in filtered_logs]
                        print(f"Time objects for {staff_id}: {time_objs}")
                    except ValueError as e:
                        print(f"Error parsing time logs for {staff_id}: {e}")
                        time_objs = []
                    n = len(time_objs)

                    if not time_objs:
                        if half_day_afternoon and exemption_start_dt <= break_out and exemption_end_dt >= out_time:
                            final_attendance = 'H'
                            final_late_mins = 0
                            print(f"No logs outside exempted period, afternoon covered, marking half-day")
                        else:
                            final_attendance = 'A'
                            final_late_mins = 0
                            print(f"No logs outside exempted period, marking absent")
                    else:
                        if category_rules[7] == 'fixed':
                            in_time = category_rules[2]
                            break_in = category_rules[3]
                            break_out = category_rules[4]
                            out_time = category_rules[5]
                            allowed_break = int(category_rules[6])

                            try:
                                start_const = datetime.strptime(f"{exemption_date} {in_time}", "%Y-%m-%d %H:%M:%S")
                                break_in_const = datetime.strptime(f"{exemption_date} {break_in}", "%Y-%m-%d %H:%M:%S")
                                break_out_const = datetime.strptime(f"{exemption_date} {break_out}", "%Y-%m-%d %H:%M:%S")
                                end_const = datetime.strptime(f"{exemption_date} {out_time}", "%Y-%m-%d %H:%M:%S")
                                print(f"Constants for {staff_id}: start={start_const}, break_in={break_in_const}, break_out={break_out_const}, end={end_const}")
                            except ValueError as e:
                                print(f"Error parsing category times for {staff_id}: {e}")
                                continue

                            # Handle single log in break window
                            if n == 1:
                                single_log_time = time_objs[0]
                                if break_in_const <= single_log_time <= break_out_const and not any(t > break_out_const for t in time_objs):
                                    final_attendance = 'H'
                                    final_late_mins = 0
                                    print(f"Single log in break window for {staff_id} ({single_log_time.time()}) and no return after break_out, marking half-day")
                                    cursor.execute(
                                        "SELECT 1 FROM report WHERE staff_id = %s AND date = %s",
                                        (staff_id, exemption_date)
                                    )
                                    exists = cursor.fetchone()
                                    if exists:
                                        cursor.execute(
                                            "UPDATE report SET late_mins = %s, attendance = %s WHERE staff_id = %s AND date = %s",
                                            (final_late_mins, final_attendance, staff_id, exemption_date)
                                        )
                                        print(f"Updated report for {staff_id}: Date: {exemption_date}, Late Minutes: {final_late_mins}, Attendance: {final_attendance}")
                                    else:
                                        cursor.execute(
                                            "INSERT INTO report (staff_id, date, late_mins, attendance) VALUES (%s, %s, %s, %s)",
                                            (staff_id, exemption_date, final_late_mins, final_attendance)
                                        )
                                        print(f"Inserted report for {staff_id}: Date: {exemption_date}, Late Minutes: {final_late_mins}, Attendance: {final_attendance}")
                                    continue

                            # Morning check (if not covered by exemption)
                            if exemption_start_dt > start_const and time_objs and time_objs[0] > start_const:
                                late_minutes = (time_objs[0] - start_const).total_seconds() / 60
                                if late_minutes > 90:
                                    half_day_morning = True
                                    final_attendance = 'H'
                                    final_late_mins = 0
                                    print(f"Morning absence > 90 mins for {staff_id}: {late_minutes}")
                                elif late_minutes > 15:
                                    final_late_mins += late_minutes
                                    print(f"Morning late mins for {staff_id}: {late_minutes}")

                            # Second-half arrival check
                            if time_objs and not any(t <= break_out_const for t in time_objs):
                                print(f"No logs before break_out for {staff_id}, treating first log as break_out entry")
                                if time_objs[0] > break_out_const:
                                    late_minutes = (time_objs[0] - break_out_const).total_seconds() / 60
                                    if late_minutes > 90:
                                        half_day_afternoon = True
                                        final_attendance = 'H'
                                        final_late_mins = 0
                                        print(f"Second-half late > 90 mins for {staff_id}: {late_minutes}")
                                    else:
                                        final_late_mins += late_minutes
                                        print(f"Second-half late mins for {staff_id}: {late_minutes}")
                                else:
                                    print(f"Second-half on time for {staff_id}")

                            # Break check
                            break_mins = 0
                            i = 1
                            while i < n - 1:
                                try:
                                    exit_time = time_objs[i]
                                    entry_time = time_objs[i + 1]
                                    if break_in_const <= exit_time <= break_out_const and break_in_const <= entry_time <= break_out_const:
                                        break_duration = (entry_time - exit_time).total_seconds() / 60
                                        break_mins += break_duration
                                        print(f"Break {i//2 + 1} for {staff_id}: {break_duration:.2f} mins (from {exit_time} to {entry_time})")
                                        i += 2
                                    else:
                                        print(f"Skipping invalid break pair for {staff_id}: {exit_time} to {entry_time}")
                                        i += 1
                                except IndexError:
                                    print(f"IndexError in break calculation for {staff_id} at index {i}")
                                    break
                            print(f"Total break mins for {staff_id}: {break_mins:.2f}")

                            # Afternoon check (if not covered by exemption)
                            if not half_day_afternoon and time_objs and not any(t > break_out_const for t in time_objs):
                                half_day_afternoon = True
                                final_attendance = 'H'
                                final_late_mins = 0
                                print(f"No logs after break_out for {staff_id}, marking half-day")

                            # Early out check
                            if not half_day_afternoon and time_objs and time_objs[-1] < end_const:
                                early_minutes = (end_const - time_objs[-1]).total_seconds() / 60
                                print(f"Early out check: last_log={time_objs[-1].time()}, end_const={end_const.time()}, early_minutes={early_minutes}")
                                if early_minutes > 90:
                                    half_day_afternoon = True
                                    final_attendance = 'H'
                                    final_late_mins = 0
                                    print(f"Early out > 90 mins for {staff_id}: {early_minutes}")
                                else:
                                    final_late_mins += early_minutes
                                    print(f"Early out mins added to late_mins for {staff_id}: {early_minutes}")

                            # Excess break check
                            if not (half_day_morning or half_day_afternoon) and break_mins > allowed_break:
                                excess_break = break_mins - allowed_break
                                final_late_mins += excess_break
                                print(f"Excess break mins for {staff_id}: {excess_break:.2f}")

                            # Full absence check
                            print(f"Final check before report: half_day_morning={half_day_morning}, half_day_afternoon={half_day_afternoon}, attendance={final_attendance}, late_mins={final_late_mins}")
                            if half_day_morning and half_day_afternoon:
                                final_attendance = 'I'
                                final_late_mins = 0
                                print(f"Both sessions half-day for {staff_id}, marking two half-days with 'I'")

                        else:  # hrs category
                            start_const = time_objs[0] if time_objs else datetime.combine(exemption_date, datetime.min.time())
                            end_temp = datetime.strptime(f"{exemption_date} {category_rules[5]}", "%Y-%m-%d %H:%M:%S")
                            end_const = start_const + timedelta(hours=end_temp.hour, minutes=end_temp.minute)
                            allowed_break = int(category_rules[6])

                            total_duration = (datetime.combine(exemption_date, time_objs[-1].time()) -
                                            datetime.combine(exemption_date, time_objs[0].time())).total_seconds() / 60 if time_objs else 0
                            break_mins = 0
                            for i in range(1, n - 1, 2):
                                try:
                                    break_mins += (datetime.combine(exemption_date, time_objs[i+1].time()) -
                                                datetime.combine(exemption_date, time_objs[i].time())).total_seconds() / 60
                                except IndexError:
                                    print(f"IndexError in break calculation for {staff_id}")
                                    break

                            actual_work_mins = total_duration - break_mins
                            required_mins = (end_const - start_const).total_seconds() / 60
                            final_late_mins = max(0, required_mins - actual_work_mins)
                            print(f"Hrs category for {staff_id}: work_mins={actual_work_mins:.2f}, late_mins={final_late_mins}")

                            if time_objs and time_objs[-1] < end_const:
                                early_minutes = (end_const - time_objs[-1]).total_seconds() / 60
                                if early_minutes > 90:
                                    half_day_afternoon = True
                                    final_attendance = 'H'
                                    print(f"Early out > 90 mins for {staff_id}: {early_minutes}")

                            if half_day_afternoon and n == 1:
                                final_attendance = 'A'
                                final_late_mins = 0
                                print(f"Single log with early out for {staff_id}, marking absent")

                    # Round late_mins
                    if final_late_mins > 0:
                        fractional_part = final_late_mins - int(final_late_mins)
                        if fractional_part > 0.5:
                            final_late_mins = math.ceil(final_late_mins)
                        else:
                            final_late_mins = math.floor(final_late_mins)
                        print(f"Rounded late_mins for {staff_id}: {final_late_mins}")

            # Update or insert report (skip if Absent)
            if final_attendance != 'A':
                cursor.execute("SELECT 1 FROM report WHERE staff_id = %s AND date = %s", (staff_id, exemption_date))
                exists = cursor.fetchone()
                if exists:
                    cursor.execute(
                        "UPDATE report SET late_mins = %s, attendance = %s WHERE staff_id = %s AND date = %s",
                        (final_late_mins, final_attendance, staff_id, exemption_date)
                    )
                    print(f"Updated report for {staff_id} on {exemption_date}: late_mins={final_late_mins}, attendance={final_attendance}")
                else:
                    cursor.execute(
                        "INSERT INTO report (staff_id, date, late_mins, attendance) VALUES (%s, %s, %s, %s)",
                        (staff_id, exemption_date, final_late_mins, final_attendance)
                    )
                    print(f"Inserted report for {staff_id} on {exemption_date}: late_mins={final_late_mins}, attendance={final_attendance}")
            else:
                print(f"No report created for {staff_id} on {exemption_date} due to absence")

            processed_ids.append(exemption_id)

        # Mark exemptions as processed
        if processed_ids:
            try:
                if len(processed_ids) == 1:
                    cursor.execute("UPDATE exemptions SET processed = 1 WHERE exemptionId = %s", (processed_ids[0],))
                else:
                    cursor.execute("UPDATE exemptions SET processed = 1 WHERE exemptionId IN %s", (tuple(processed_ids),))
                print(f"Marked exemptions as processed: {processed_ids}")
            except mysql.connector.Error as err:
                print(f"Error marking exemptions as processed: {err}")

        conn.commit()
        print(f"--- Exemption processing complete ---")

    except mysql.connector.Error as err:
        print(f"Database error during exemption processing: {err}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    process_exemptions()