import mysql.connector
from datetime import datetime, timedelta
import math
from connection import db as db_connect
from holiday import get_holidays

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

def process_exemptions(today = None):
 
    conn = db_connect()
    if not conn:
        print("Database connection failed.")
        return

    cursor = conn.cursor()
    current_date = datetime.now().date()

    try:
        # Fetch all unprocessed approved exemptions
        if not today:
            cursor.execute(
            "SELECT * FROM exemptions WHERE exemptionStatus = 'processing' AND processed = 0"
            )
        else:
            cursor.execute(
                "SELECT * FROM exemptions WHERE (exemptionStatus = 'approved' OR exemptionStatus = 'processing') AND exemptionDate = %s", (today,)
            )
        exemptions_to_process = cursor.fetchall()
        print(f"Exemptions to process: {exemptions_to_process}")
        if not exemptions_to_process:
            print("No unprocessed approved exemptions found.")
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
            session_key = exemption[4] if len(exemption) > 4 else None  # exemptionSession

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
            half_day_morning = False
            half_day_afternoon = False
            break_mins = 0

            if exemption_type == 'day':
                print(f"Day exemption for {staff_id}: late_mins set to 0, attendance set to P")
            else:
                # Fetch logs and flagged times
                cursor.execute("SELECT time FROM logs WHERE staff_id = %s AND date = %s", (staff_id, exemption_date))
                staff_logs = sorted([row[0] if isinstance(row[0], str) else str(row[0]) for row in cursor.fetchall()])
                cursor.execute(
                    "SELECT time FROM attendance_flags WHERE staff_id = %s AND date = %s",
                    (staff_id, exemption_date)
                )
                flagged_times_raw = cursor.fetchall()
                flagged_times = {str(t[0]) for t in flagged_times_raw}
                print(f"Flagged times for {staff_id} on {exemption_date}: {flagged_times}")

                # Filter out flagged logs
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

                # Determine logs within exempted period
                exemption_start_dt = datetime.combine(exemption_date, exemption_start_time)
                exemption_end_dt = datetime.combine(exemption_date, exemption_end_time)
                logs_in_exemption = [
                    t for t in staff_logs
                    if exemption_start_dt <= datetime.strptime(f"{exemption_date} {t}", "%Y-%m-%d %H:%M:%S") <= exemption_end_dt
                ]
                print(f"Logs within exempted period for {staff_id}: {logs_in_exemption}")

                # Process logs based on number in exempted period
                filtered_logs = staff_logs
                if len(logs_in_exemption) == 1:
                    # Use the single log's time as exemption_end_dt
                    single_log_time = datetime.strptime(f"{exemption_date} {logs_in_exemption[0]}", "%Y-%m-%d %H:%M:%S")
                    exemption_end_dt = single_log_time
                    filtered_logs = staff_logs  # Keep all logs
                    print(f"Single log in exempted period for {staff_id}: {logs_in_exemption[0]}, setting exemption_end_dt to {exemption_end_dt}")
                elif len(logs_in_exemption) > 1:
                    # Filter out logs within exempted period
                    filtered_logs = [
                        t for t in staff_logs
                        if not (exemption_start_dt <= datetime.strptime(f"{exemption_date} {t}", "%Y-%m-%d %H:%M:%S") <= exemption_end_dt)
                    ]
                    print(f"Multiple logs in exempted period, filtered logs for {staff_id}: {filtered_logs}")
                else:
                    print(f"No logs in exempted period for {staff_id}, keeping all logs")

                # Process remaining logs
                if category_rules[7] == 'fixed':
                    in_time = category_rules[2]
                    break_in = category_rules[3]
                    break_out = category_rules[4]
                    out_time = category_rules[5]
                    allowed_break = int(category_rules[6])
                    in1 = category_rules[8]
                    out2 = category_rules[9]

                    try:
                        start_const = datetime.strptime(f"{exemption_date} {in_time}", "%Y-%m-%d %H:%M:%S")
                        break_in_const = datetime.strptime(f"{exemption_date} {break_in}", "%Y-%m-%d %H:%M:%S")
                        break_out_const = datetime.strptime(f"{exemption_date} {break_out}", "%Y-%m-%d %H:%M:%S")
                        end_const = datetime.strptime(f"{exemption_date} {out_time}", "%Y-%m-%d %H:%M:%S")
                        in1_const = datetime.strptime(f"{exemption_date} {in1}", "%Y-%m-%d %H:%M:%S")
                        out2_const = datetime.strptime(f"{exemption_date} {out2}", "%Y-%m-%d %H:%M:%S")
                        middle_time = break_in_const + (break_out_const - break_in_const) / 2
                        print(f"Constants for {staff_id}: start={start_const}, break_in={break_in_const}, break_out={break_out_const}, end={end_const}, in1={in1_const}, out2={out2_const}, middle_time={middle_time}")
                    except ValueError as e:
                        print(f"Error parsing category times for {staff_id}: {e}")
                        continue

                    # Check if exemption covers the entire workday
                    if exemption_start_dt <= start_const and exemption_end_dt >= end_const:
                        print(f"Exemption covers entire workday for {staff_id}, setting late_mins=0, attendance=P")
                        final_late_mins = 0
                        final_attendance = 'P'
                    else:
                        # Check if exemption covers afternoon
                        if exemption_start_dt <= break_out_const and exemption_end_dt >= end_const:
                            half_day_afternoon = False
                            print(f"Exemption covers afternoon for {staff_id}, checking morning only")
                        else:
                            half_day_afternoon = True
                            print(f"Exemption does not cover entire afternoon, checking logs")

                        # Handle odd number of logs
                        options = []
                        if len(filtered_logs) % 2 == 1 and len(filtered_logs) > 1:
                            for removal_type in ['last', 'center']:
                                temp_time_logs = filtered_logs.copy()
                                if removal_type == 'last':
                                    temp_time_logs = temp_time_logs[:-1]
                                    print(f"Evaluating option (remove last) for {staff_id}: removed {filtered_logs[-1]}")
                                else:
                                    center_index = len(temp_time_logs) // 2
                                    removed_log = temp_time_logs.pop(center_index) if temp_time_logs else None
                                    print(f"Evaluating option (remove center) for {staff_id}: removed {removed_log}")

                                try:
                                    temp_time_objs = [datetime.strptime(f"{exemption_date} {t}", "%Y-%m-%d %H:%M:%S") for t in temp_time_logs]
                                except ValueError as e:
                                    print(f"Error parsing time logs for {staff_id} in option {removal_type}: {e}")
                                    continue
                                n = len(temp_time_objs)

                                temp_late_mins = 0
                                temp_attendance = 'P'
                                temp_half_day_morning = False
                                temp_half_day_afternoon = half_day_afternoon
                                temp_morning_late_mins = 0
                                temp_afternoon_late_mins = 0
                                temp_break_mins = 0

                                # Single log handling
                                if n == 1:
                                    log_time = temp_time_objs[0]
                                    times_to_compare = [
                                        ('in_time', start_const),
                                        ('out_time', end_const),
                                        ('in1', in1_const),
                                        ('out2', out2_const)
                                    ]
                                    time_diffs = [
                                        (name, abs((log_time - ref_time).total_seconds() / 60))
                                        for name, ref_time in times_to_compare
                                    ]
                                    closest_time = min(time_diffs, key=lambda x: x[1])
                                    closest_name, min_diff = closest_time
                                    print(f"Single log for {staff_id}: {log_time.time()}, closest to {closest_name}, diff={min_diff:.2f} mins")

                                    if closest_name == 'in_time' and log_time > start_const and exemption_start_dt > start_const:
                                        late_minutes = (log_time - start_const).total_seconds() / 60
                                        if late_minutes > 90:
                                            temp_half_day_morning = True
                                            temp_morning_late_mins = 0
                                            temp_attendance = 'H'
                                            print(f"Single log late > 90 mins for {staff_id}: {late_minutes:.2f}")
                                        elif late_minutes > 16:
                                            temp_morning_late_mins = late_minutes
                                            print(f"Single log late mins for {staff_id}: {late_minutes:.2f}")
                                    elif closest_name == 'in1' and log_time < in1_const:
                                        early_minutes = (in1_const - log_time).total_seconds() / 60
                                        if early_minutes > 90:
                                            temp_half_day_morning = True
                                            temp_morning_late_mins = 0
                                            temp_attendance = 'H'
                                            print(f"Single log early > 90 mins for {staff_id}: {early_minutes:.2f}")
                                        else:
                                            temp_morning_late_mins = early_minutes
                                            print(f"Single log early mins for {staff_id}: {early_minutes:.2f}")
                                    elif closest_name in ['out2', 'out_time'] and log_time < end_const:
                                        early_minutes = (end_const - log_time).total_seconds() / 60
                                        if early_minutes > 90:
                                            temp_half_day_afternoon = True
                                            temp_afternoon_late_mins = 0
                                            temp_attendance = 'H'
                                            print(f"Single log early > 90 mins for {staff_id}: {early_minutes:.2f}")
                                        else:
                                            temp_afternoon_late_mins = early_minutes
                                            print(f"Single log early mins for {staff_id}: {early_minutes:.2f}")
                                    temp_late_mins = temp_morning_late_mins + temp_afternoon_late_mins
                                else:
                                    # Morning check
                                    if temp_time_objs and exemption_start_dt > start_const:
                                        if temp_time_objs[0] > start_const:
                                            late_minutes = (temp_time_objs[0] - start_const).total_seconds() / 60
                                            if late_minutes > 90:
                                                temp_half_day_morning = True
                                                temp_morning_late_mins = 0
                                                temp_attendance = 'H'
                                                print(f"Morning absence > 90 mins for {staff_id}: {late_minutes}")
                                            elif late_minutes > 16:
                                                temp_morning_late_mins += late_minutes
                                                print(f"Morning late mins for {staff_id}: {late_minutes}")

                                    if temp_time_objs and not any(t > in1_const for t in temp_time_objs):
                                        temp_half_day_morning = True
                                        temp_morning_late_mins = 0
                                        temp_attendance = 'H'
                                        print(f"No logs after in1 for {staff_id}, marking morning half-day")

                                    # Break check
                                    breaks = []
                                    i = 1
                                    while i < n - 1:
                                        try:
                                            exit_time = temp_time_objs[i]
                                            entry_time = temp_time_objs[i + 1]
                                            break_duration = (entry_time - exit_time).total_seconds() / 60
                                            print(f"Evaluating break {i//2 + 1} for {staff_id}: {break_duration:.2f} mins (from {exit_time} to {entry_time})")

                                            # Skip breaks after end_time
                                            if exit_time > end_const:
                                                print(f"Break starts after out_time for {staff_id}, no late_mins added")
                                                i += 2
                                                continue

                                            # Calculate valid duration
                                            valid_start = max(exit_time, break_in_const)
                                            valid_end = min(entry_time, break_out_const)
                                            valid_duration = max(0, (valid_end - valid_start).total_seconds() / 60) if valid_start <= valid_end else 0
                                            is_valid = valid_duration > 0 and entry_time <= break_out_const
                                            print(f"Break {i//2 + 1} valid duration: {valid_duration:.2f} mins (from {valid_start} to {valid_end})")

                                            breaks.append((i//2 + 1, exit_time, entry_time, break_duration, valid_duration))
                                            i += 2
                                        except IndexError:
                                            print(f"IndexError in break calculation for {staff_id} at index {i}")
                                            break

                                    # Select break with greatest valid duration
                                    if breaks:
                                        valid_breaks = [(num, exit_time, entry_time, break_dur, valid_dur) for num, exit_time, entry_time, break_dur, valid_dur in breaks if valid_dur > 0]
                                        if valid_breaks:
                                            selected_break = max(valid_breaks, key=lambda x: x[4])  # Max by valid_duration
                                            temp_break_mins = min(selected_break[4], allowed_break)  # Cap at allowed_break
                                            print(f"Selected break {selected_break[0]} for {staff_id}: valid {selected_break[4]:.2f} mins, capped at {temp_break_mins:.2f} mins")
                                            # Calculate late minutes for selected break
                                            break_late_mins = 0
                                            if selected_break[1] < break_in_const:
                                                break_late_mins += (break_in_const - selected_break[1]).total_seconds() / 60
                                                print(f"Selected break starts before break_in for {staff_id}: {break_late_mins:.2f} mins added")
                                            if selected_break[2] > break_out_const:
                                                break_late_mins += (selected_break[2] - break_out_const).total_seconds() / 60
                                                print(f"Selected break ends after break_out for {staff_id}: {break_late_mins:.2f} mins added")
                                            # Add excess break time
                                            if selected_break[4] > allowed_break:
                                                excess_break = selected_break[4] - allowed_break
                                                break_late_mins += excess_break
                                                print(f"Excess break time for {staff_id}: {excess_break:.2f} mins added")
                                            if break_late_mins > 0:
                                                if selected_break[1] <= middle_time:
                                                    temp_morning_late_mins += break_late_mins
                                                    print(f"Selected break late mins aligned to morning for {staff_id}: {break_late_mins:.2f} mins added")
                                                else:
                                                    temp_afternoon_late_mins += break_late_mins
                                                    print(f"Selected break late mins aligned to afternoon for {staff_id}: {break_late_mins:.2f} mins added")

                                        # Add full durations of other breaks within end_time
                                        for break_num, exit_time, _, break_duration, _ in breaks:
                                            if not valid_breaks or break_num != selected_break[0]:
                                                if exit_time <= middle_time:
                                                    temp_morning_late_mins += break_duration
                                                    print(f"Other break {break_num} aligned to morning for {staff_id}: {break_duration:.2f} mins added to late_mins")
                                                else:
                                                    temp_afternoon_late_mins += break_duration
                                                    print(f"Other break {break_num} aligned to afternoon for {staff_id}: {break_duration:.2f} mins added to late_mins")
                                    else:
                                        print(f"No breaks within end_time for {staff_id}")

                                    # Afternoon check
                                    if not temp_half_day_afternoon and temp_time_objs and not any(t > out2_const for t in temp_time_objs):
                                        temp_half_day_afternoon = True
                                        temp_afternoon_late_mins = 0
                                        temp_attendance = 'H'
                                        print(f"No logs after out2 for {staff_id}, marking afternoon half-day")

                                    if not temp_half_day_afternoon and temp_time_objs and temp_time_objs[-1] < end_const:
                                        early_minutes = (end_const - temp_time_objs[-1]).total_seconds() / 60
                                        print(f"Early out check: last_log={temp_time_objs[-1].time()}, end_const={end_const.time()}, early_minutes={early_minutes}")
                                        if early_minutes > 90:
                                            temp_half_day_afternoon = True
                                            temp_afternoon_late_mins = 0
                                            temp_attendance = 'H'
                                            print(f"Early out > 90 mins for {staff_id}, marking afternoon half-day")
                                        else:
                                            temp_afternoon_late_mins += early_minutes
                                            print(f"Early out mins added to afternoon_late_mins for {staff_id}: {early_minutes}")

                                    # Apply half-day if late_mins exceed 90
                                    if temp_morning_late_mins > 90:
                                        temp_half_day_morning = True
                                        temp_morning_late_mins = 0
                                        temp_attendance = 'H'
                                        print(f"Morning late_mins > 90 for {staff_id}, marking morning half-day")
                                    if temp_afternoon_late_mins > 90:
                                        temp_half_day_afternoon = True
                                        temp_afternoon_late_mins = 0
                                        temp_attendance = 'H'
                                        print(f"Afternoon late_mins > 90 for {staff_id}, marking afternoon half-day")

                                    temp_late_mins = temp_morning_late_mins + temp_afternoon_late_mins
                                    if temp_half_day_morning and temp_half_day_afternoon:
                                        temp_attendance = 'I'
                                        temp_morning_late_mins = 0
                                        temp_afternoon_late_mins = 0
                                        temp_late_mins = 0
                                        print(f"Both sessions half-day for {staff_id}, marking as 'I'")

                                options.append((int(temp_half_day_morning) + int(temp_half_day_afternoon), temp_late_mins, temp_attendance, temp_time_logs, removal_type, temp_break_mins))
                        else:
                            options.append((0, 0, 'P', filtered_logs, 'none', 0))

                        if not filtered_logs:
                            if half_day_afternoon and exemption_start_dt <= break_out_const and exemption_end_dt >= end_const:
                                final_attendance = 'H'
                                final_late_mins = 0
                                print(f"No logs outside exempted period, afternoon covered, marking half-day")
                            else:
                                final_attendance = 'I'
                                final_late_mins = 0
                                print(f"No logs outside exempted period, marking as 'I'")
                        elif options:
                            options.sort()
                            num_half_days, final_late_mins, final_attendance, filtered_logs, removal_type, break_mins = options[0]
                            print(f"Selected option ({removal_type}) for {staff_id}: num_half_days={num_half_days}, late_mins={final_late_mins}, attendance={final_attendance}")
                        else:
                            final_attendance = 'I'
                            final_late_mins = 0
                            print(f"No valid logs after processing options for {staff_id}, marking as 'I'")

                        # Round late_mins
                        if final_late_mins > 0:
                            fractional_part = final_late_mins - int(final_late_mins)
                            if fractional_part > 0.5:
                                final_late_mins = math.ceil(final_late_mins)
                            else:
                                final_late_mins = math.floor(final_late_mins)
                            print(f"Rounded late_mins for {staff_id}: {final_late_mins}")

                else:  # hrs category
                    try:
                        time_objs = [datetime.strptime(f"{exemption_date} {t}", "%Y-%m-%d %H:%M:%S") for t in filtered_logs]
                        print(f"Time objects for {staff_id}: {time_objs}")
                    except ValueError as e:
                        print(f"Error parsing time logs for {staff_id}: {e}")
                        time_objs = []
                    n = len(time_objs)

                    if not time_objs:
                        final_attendance = 'I'
                        final_late_mins = 0
                        print(f"No logs outside exempted period, marking as 'I'")
                    else:
                        start_const = time_objs[0]
                        end_temp = datetime.strptime(f"{exemption_date} {category_rules[5]}", "%Y-%m-%d %H:%M:%S")
                        end_const = start_const + timedelta(hours=end_temp.hour, minutes=end_temp.minute)
                        allowed_break = int(category_rules[6])

                        total_duration = (time_objs[-1] - time_objs[0]).total_seconds() / 60 if time_objs else 0
                        break_mins = 0
                        for i in range(1, n - 1, 2):
                            try:
                                break_mins += (time_objs[i + 1] - time_objs[i]).total_seconds() / 60
                                print(f"Break {i//2 + 1} for {staff_id}: {(time_objs[i + 1] - time_objs[i]).total_seconds() / 60:.2f} mins")
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
                                final_late_mins = 0
                                print(f"Early out > 90 mins for {staff_id}: {early_minutes}")

                        if half_day_afternoon and n == 1:
                            final_attendance = 'I'
                            final_late_mins = 0
                            print(f"Single log with early out for {staff_id}, marking as 'I'")

                        # Round late_mins
                        if final_late_mins > 0:
                            fractional_part = final_late_mins - int(final_late_mins)
                            if fractional_part > 0.5:
                                final_late_mins = math.ceil(final_late_mins)
                            else:
                                final_late_mins = math.floor(final_late_mins)
                            print(f"Rounded late_mins for {staff_id}: {final_late_mins}")

            # Update or insert report
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
    process_exemptions("")