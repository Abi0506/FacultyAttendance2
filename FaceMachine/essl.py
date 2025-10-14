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

            # Handle exemptions
            cursor.execute(
                "SELECT exemptionType, exemptionSession, start_time, end_time FROM exemptions WHERE staffId = %s AND exemptionDate = %s AND exemptionStatus = %s",
                (staff_id, date, 'approved')
            )
            exemptions = cursor.fetchall()
            has_day_exemption = any(ex[0] == 'day' for ex in exemptions)
            time_exemptions = [(ex[2], ex[3]) for ex in exemptions if ex[0] == 'time']
            session_exemption = next((ex[1] for ex in exemptions if ex[0] == 'session'), None)

            if has_day_exemption:
                print(f"Day exemption found for {staff_id} on {date}, marking as present")
                try:
                    cursor.execute(
                        "INSERT INTO report (staff_id, date, late_mins, attendance) VALUES (%s, %s, %s, %s) "
                        "ON DUPLICATE KEY UPDATE late_mins = %s, attendance = %s",
                        (staff_id, date, 0, 'P', 0, 'P')
                    )
                    print(f"Inserted/Updated report for {staff_id} due to day exemption: Date: {date}, Late Minutes: 0, Attendance: P")
                except mysql.connector.Error as err:
                    print(f"Error inserting report for {staff_id} due to exemption: {err}")
                continue

            # Filter time exemptions
            if time_exemptions:
                print(f"Time exemptions for {staff_id}: {time_exemptions}")
                time_logs = [
                    t for t in time_logs
                    if not any(
                        start <= datetime.strptime(f"{date} {t}", "%Y-%m-%d %H:%M:%S").time() <= end
                        for start, end in time_exemptions
                    )
                ]

            # Handle odd number of logs
            options = []
            if len(time_logs) % 2 == 1:
                for removal_type in ['last', 'center']:
                    temp_time_logs = time_logs.copy()
                    if removal_type == 'last':
                        temp_time_logs = temp_time_logs[:-1]
                        print(f"Evaluating option (remove last) for {staff_id}: removed {original_logs[-1] if original_logs else None}")
                    else:  # center
                        center_index = len(temp_time_logs) // 2
                        removed_log = temp_time_logs.pop(center_index) if temp_time_logs else None
                        print(f"Evaluating option (remove center) for {staff_id}: removed {removed_log}")
                    
                    temp_time_logs = [t for t in temp_time_logs if t not in flagged_times]
                    if not temp_time_logs:
                        continue

                    # Process logs for this option
                    temp_late_mins = 0
                    temp_attendance = 'P'
                    temp_half_day_morning = False
                    temp_half_day_afternoon = False
                    temp_break_mins = 0
                    temp_morning_late_mins = 0
                    temp_afternoon_late_mins = 0

                    try:
                        temp_time_objs = [datetime.strptime(f"{date} {t}", "%Y-%m-%d %H:%M:%S") for t in temp_time_logs]
                    except ValueError as e:
                        print(f"Error parsing time logs for {staff_id} in option {removal_type}: {e}")
                        continue
                    n = len(temp_time_objs)

                    category_data = next((cat for cat in categories if cat[0] == category_id), None)
                    if not category_data:
                        print(f"No category data for {staff_id} in option {removal_type}")
                        continue

                    if is_fixed_hours := (category_data[7] == 'fixed'):
                        in_time = category_data[2]
                        break_in = category_data[3]
                        break_out = category_data[4]
                        out_time = category_data[5]
                        allowed_break = int(category_data[6])
                        in1 = category_data[8]
                        out2 = category_data[9]

                        try:
                            start_const = datetime.strptime(f"{date} {in_time}", "%Y-%m-%d %H:%M:%S")
                            break_in_const = datetime.strptime(f"{date} {break_in}", "%Y-%m-%d %H:%M:%S")
                            break_out_const = datetime.strptime(f"{date} {break_out}", "%Y-%m-%d %H:%M:%S")
                            end_const = datetime.strptime(f"{date} {out_time}", "%Y-%m-%d %H:%M:%S")
                            in1_const = datetime.strptime(f"{date} {in1}", "%Y-%m-%d %H:%M:%S")
                            out2_const = datetime.strptime(f"{date} {out2}", "%Y-%m-%d %H:%M:%S")
                            middle_time = break_in_const + (break_out_const - break_in_const) / 2
                        except ValueError as e:
                            print(f"Error parsing category times for {staff_id} in option {removal_type}: {e}")
                            continue

                        # Morning check
                        if temp_time_objs:
                            if temp_time_objs[0] > start_const:
                                late_minutes = (temp_time_objs[0] - start_const).total_seconds() / 60
                                if late_minutes > 90:
                                    temp_half_day_morning = True
                                    temp_morning_late_mins = 0
                                    temp_attendance = 'H'
                                elif late_minutes > 15:
                                    temp_morning_late_mins += late_minutes

                            if not any(t > in1_const for t in temp_time_objs):
                                temp_half_day_morning = True
                                temp_morning_late_mins = 0
                                temp_attendance = 'H'

                        # Break check
                        best_break_late_mins = float('inf')
                        best_break_duration = 0
                        best_temp_half_day_morning = temp_half_day_morning
                        best_temp_half_day_afternoon = temp_half_day_afternoon
                        best_temp_attendance = temp_attendance
                        best_temp_morning_late_mins = temp_morning_late_mins
                        best_temp_afternoon_late_mins = temp_afternoon_late_mins

                        # Initialize temporary break variables to prevent UnboundLocalError
                        temp_break_morning_late_mins = temp_morning_late_mins
                        temp_break_afternoon_late_mins = temp_afternoon_late_mins
                        temp_break_half_day_morning = temp_half_day_morning
                        temp_break_half_day_afternoon = temp_half_day_afternoon
                        temp_break_attendance = temp_attendance
                        temp_break_mins = 0

                        i = 1
                        while i < n - 1:
                            exit_time = temp_time_objs[i]
                            entry_time = temp_time_objs[i + 1]
                            break_duration = (entry_time - exit_time).total_seconds() / 60
                            temp_break_mins = 0
                            temp_break_morning_late_mins = temp_morning_late_mins
                            temp_break_afternoon_late_mins = temp_afternoon_late_mins
                            temp_break_half_day_morning = temp_half_day_morning
                            temp_break_half_day_afternoon = temp_half_day_afternoon
                            temp_break_attendance = temp_attendance

                            if exit_time >= end_const:
                                print(f"Break starts after out_time for {staff_id}, no late_mins added")
                            else:
                                effective_entry_time = min(entry_time, end_const)
                                capped_break_duration = (effective_entry_time - exit_time).total_seconds() / 60
                                if capped_break_duration > 0:
                                    morning_duration = (min(effective_entry_time, middle_time) - exit_time).total_seconds() / 60 if exit_time <= middle_time else 0
                                    afternoon_duration = (effective_entry_time - max(exit_time, middle_time)).total_seconds() / 60 if effective_entry_time > middle_time else 0
                                    excess_break = max(0, capped_break_duration - allowed_break)
                                    if morning_duration >= afternoon_duration:
                                        temp_break_morning_late_mins += excess_break
                                        if excess_break > 90:
                                            temp_break_half_day_morning = True
                                            temp_break_morning_late_mins = 0
                                            temp_break_attendance = 'H'
                                        print(f"Break aligned to first session for {staff_id}: {excess_break:.2f} mins added (morning_duration={morning_duration:.2f})")
                                    else:
                                        temp_break_afternoon_late_mins += excess_break
                                        if excess_break > 90:
                                            temp_break_half_day_afternoon = True
                                            temp_break_afternoon_late_mins = 0
                                            temp_break_attendance = 'H'
                                        print(f"Break aligned to second session for {staff_id}: {excess_break:.2f} mins added (afternoon_duration={afternoon_duration:.2f})")
                            
                            if break_in_const <= exit_time <= break_out_const and entry_time <= break_out_const:
                                temp_break_mins = break_duration
                                print(f"Break {i//2 + 1} for {staff_id}: Valid break {break_duration:.2f} mins")

                            total_temp_late_mins = temp_break_morning_late_mins + temp_break_afternoon_late_mins
                            if total_temp_late_mins < best_break_late_mins:
                                best_break_late_mins = total_temp_late_mins
                                best_break_duration = temp_break_mins
                                best_temp_half_day_morning = temp_break_half_day_morning
                                best_temp_half_day_afternoon = temp_break_half_day_afternoon
                                best_temp_attendance = temp_break_attendance
                                best_temp_morning_late_mins = temp_break_morning_late_mins
                                best_temp_afternoon_late_mins = temp_break_afternoon_late_mins

                            i += 2

                        temp_morning_late_mins = best_temp_morning_late_mins
                        temp_afternoon_late_mins = best_temp_afternoon_late_mins
                        temp_break_mins = best_break_duration
                        temp_half_day_morning = best_temp_half_day_morning
                        temp_half_day_afternoon = best_temp_half_day_afternoon
                        temp_attendance = best_temp_attendance

                        # Afternoon check
                        if temp_time_objs and not any(t > out2_const for t in temp_time_objs):
                            temp_half_day_afternoon = True
                            temp_afternoon_late_mins = 0
                            temp_attendance = 'H'

                        # Early out check
                        if temp_time_objs and temp_time_objs[-1] < end_const and not temp_half_day_afternoon:
                            early_minutes = (end_const - temp_time_objs[-1]).total_seconds() / 60
                            if early_minutes > 90:
                                temp_half_day_afternoon = True
                                temp_afternoon_late_mins = 0
                                temp_attendance = 'H'
                            else:
                                temp_afternoon_late_mins += early_minutes

                        # Two half-days
                        if temp_half_day_morning and temp_half_day_afternoon:
                            temp_attendance = 'I'
                            temp_morning_late_mins = 0
                            temp_afternoon_late_mins = 0

                        temp_late_mins = temp_morning_late_mins + temp_afternoon_late_mins

                    options.append((int(temp_half_day_morning) + int(temp_half_day_afternoon), temp_late_mins, temp_attendance, temp_time_logs, removal_type))

            else:
                options.append((0, 0, 'P', time_logs, 'none'))

            # Handle no logs case
            if not time_logs:
                print(f"No logs for {staff_id} on {date}, marking as absent")
                try:
                    cursor.execute(
                        "INSERT INTO report (staff_id, date, late_mins, attendance) VALUES (%s, %s, %s, %s) "
                        "ON DUPLICATE KEY UPDATE late_mins = %s, attendance = %s",
                        (staff_id, date, 0, 'I', 0, 'I')
                    )
                    print(f"Inserted/Updated report for {staff_id}: Date: {date}, Late Minutes: 0, Attendance: I")
                except mysql.connector.Error as err:
                    print(f"Error inserting report for {staff_id}: {err}")
                continue

            # Select best option
            if options:
                options.sort()
                num_half_days, late_mins, attendance, time_logs, removal_type = options[0]
                print(f"Selected option ({removal_type}) for {staff_id}: num_half_days={num_half_days}, late_mins={late_mins}, attendance={attendance}")
            else:
                print(f"No valid logs for {staff_id} after processing options")
                try:
                    cursor.execute(
                        "INSERT INTO report (staff_id, date, late_mins, attendance) VALUES (%s, %s, %s, %s) "
                        "ON DUPLICATE KEY UPDATE late_mins = %s, attendance = %s",
                        (staff_id, date, 0, 'I', 0, 'I')
                    )
                    print(f"Inserted/Updated report for {staff_id}: Date: {date}, Late Minutes: 0, Attendance: I")
                except mysql.connector.Error as err:
                    print(f"Error inserting report for {staff_id}: {err}")
                continue

            try:
                time_objs = [datetime.strptime(f"{date} {t}", "%Y-%m-%d %H:%M:%S") for t in time_logs]
                print(f"Time objects for {staff_id}: {time_objs}")
            except ValueError as e:
                print(f"Error parsing time logs for {staff_id}: {e}")
                continue
            n = len(time_objs)

            category_data = next((cat for cat in categories if cat[0] == category_id), None)
            if not category_data:
                print(f"No category data found for staff {staff_id}")
                continue
            print(f"Category data for {staff_id}: {category_data}")

            half_day_morning = False
            half_day_afternoon = False
            morning_late_mins = 0
            afternoon_late_mins = 0
            late_mins = 0

            if is_holiday or datetime.strptime(date, "%Y-%m-%d").weekday() == 6:
                if not time_logs:
                    print(f"No logs for {staff_id} on holiday or Sunday ({date}), skipping report")
                    continue

            if is_fixed_hours := (category_data[7] == 'fixed'):
                in_time = category_data[2]
                break_in = category_data[3]
                break_out = category_data[4]
                out_time = category_data[5]
                allowed_break = int(category_data[6])
                in1 = category_data[8]
                out2 = category_data[9]

                try:
                    start_const = datetime.strptime(f"{date} {in_time}", "%Y-%m-%d %H:%M:%S")
                    break_in_const = datetime.strptime(f"{date} {break_in}", "%Y-%m-%d %H:%M:%S")
                    break_out_const = datetime.strptime(f"{date} {break_out}", "%Y-%m-%d %H:%M:%S")
                    end_const = datetime.strptime(f"{date} {out_time}", "%Y-%m-%d %H:%M:%S")
                    in1_const = datetime.strptime(f"{date} {in1}", "%Y-%m-%d %H:%M:%S")
                    out2_const = datetime.strptime(f"{date} {out2}", "%Y-%m-%d %H:%M:%S")
                    middle_time = break_in_const + (break_out_const - break_in_const) / 2
                    print(f"Constants for {staff_id}: start={start_const}, break_in={break_in_const}, break_out={break_out_const}, end={end_const}, in1={in1_const}, out2={out2_const}, middle_time={middle_time}")
                except ValueError as e:
                    print(f"Error parsing category times for {staff_id}: {e}")
                    continue
                    continue

                # Morning check
                if time_objs:
                    if session_exemption != 'morning' and time_objs[0] > start_const:
                        late_minutes = (time_objs[0] - start_const).total_seconds() / 60
                        if late_minutes > 90:
                            half_day_morning = True
                            morning_late_mins = 0
                            attendance = 'H'
                            print(f"Morning absence > 90 mins for {staff_id}: {late_minutes}")
                        elif late_minutes > 15:
                            morning_late_mins += late_minutes
                            print(f"Morning late mins for {staff_id}: {late_minutes}")

                    if session_exemption != 'morning' and not any(t > in1_const for t in time_objs):
                        half_day_morning = True
                        morning_late_mins = 0
                        attendance = 'H'
                        print(f"No logs after in1 for {staff_id}, marking morning half-day")

                # Break check
                break_mins = 0
                best_late_mins = float('inf')
                best_break_duration = 0
                best_half_day_morning = half_day_morning
                best_half_day_afternoon = half_day_afternoon
                best_attendance = attendance
                best_morning_late_mins = morning_late_mins
                best_afternoon_late_mins = afternoon_late_mins
                selected_break = None

                # Initialize temporary break variables
                temp_morning_late_mins = morning_late_mins
                temp_afternoon_late_mins = afternoon_late_mins
                temp_half_day_morning = half_day_morning
                temp_half_day_afternoon = half_day_afternoon
                temp_attendance = attendance
                temp_break_mins = 0

                i = 1
                while i < n - 1:
                    try:
                        exit_time = time_objs[i]
                        entry_time = time_objs[i + 1]
                        break_duration = (entry_time - exit_time).total_seconds() / 60
                        temp_morning_late_mins = morning_late_mins
                        temp_afternoon_late_mins = afternoon_late_mins
                        temp_half_day_morning = half_day_morning
                        temp_half_day_afternoon = half_day_afternoon
                        temp_attendance = attendance
                        temp_break_mins = 0

                        print(f"Evaluating break {i//2 + 1} for {staff_id}: {break_duration:.2f} mins (from {exit_time} to {entry_time})")

                        if exit_time >= end_const:
                            print(f"Break starts after out_time for {staff_id}, no late_mins added")
                        else:
                            effective_entry_time = min(entry_time, end_const)
                            capped_break_duration = (effective_entry_time - exit_time).total_seconds() / 60
                            if capped_break_duration > 0:
                                morning_duration = (min(effective_entry_time, middle_time) - exit_time).total_seconds() / 60 if exit_time <= middle_time else 0
                                afternoon_duration = (effective_entry_time - max(exit_time, middle_time)).total_seconds() / 60 if effective_entry_time > middle_time else 0
                                excess_break = max(0, capped_break_duration - allowed_break)
                                if morning_duration >= afternoon_duration:
                                    temp_morning_late_mins += excess_break
                                    print(f"Break aligned to first session for {staff_id}: {excess_break:.2f} mins added to morning_late_mins (morning_duration={morning_duration:.2f})")
                                    if excess_break > 90:
                                        temp_half_day_morning = True
                                        temp_morning_late_mins = 0
                                        temp_attendance = 'H'
                                        print(f"Break aligned to first session > 90 mins for {staff_id}, marking morning half-day, resetting morning_late_mins")
                                else:
                                    temp_afternoon_late_mins += excess_break
                                    print(f"Break aligned to second session for {staff_id}: {excess_break:.2f} mins added to afternoon_late_mins (afternoon_duration={afternoon_duration:.2f})")
                                    if excess_break > 90:
                                        temp_half_day_afternoon = True
                                        temp_afternoon_late_mins = 0
                                        temp_attendance = 'H'
                                        print(f"Break aligned to second session > 90 mins for {staff_id}, marking afternoon half-day, resetting afternoon_late_mins")

                        if break_in_const <= exit_time <= break_out_const and entry_time <= break_out_const:
                            temp_break_mins = break_duration
                            print(f"Break {i//2 + 1} for {staff_id}: Valid break {break_duration:.2f} mins")

                        total_temp_late_mins = temp_morning_late_mins + temp_afternoon_late_mins
                        if total_temp_late_mins < best_late_mins:
                            best_late_mins = total_temp_late_mins
                            best_break_duration = temp_break_mins
                            best_half_day_morning = temp_half_day_morning
                            best_half_day_afternoon = temp_half_day_afternoon
                            best_attendance = temp_attendance
                            best_morning_late_mins = temp_morning_late_mins
                            best_afternoon_late_mins = temp_afternoon_late_mins
                            selected_break = (i//2 + 1, exit_time, entry_time, break_duration)

                        i += 2
                    except IndexError:
                        print(f"IndexError in break calculation for {staff_id} at index {i}")
                        break

                if selected_break:
                    break_mins = best_break_duration
                    half_day_morning = best_half_day_morning
                    half_day_afternoon = best_half_day_afternoon
                    attendance = best_attendance
                    morning_late_mins = best_morning_late_mins
                    afternoon_late_mins = best_afternoon_late_mins
                    print(f"Selected break {selected_break[0]} for {staff_id}: {selected_break[3]:.2f} mins (from {selected_break[1]} to {selected_break[2]})")
                else:
                    print(f"No valid break pairs for {staff_id}")
                print(f"Total valid break mins for {staff_id}: {break_mins:.2f}")

                # Afternoon check
                if time_objs and session_exemption != 'afternoon' and not any(t > out2_const for t in time_objs):
                    half_day_afternoon = True
                    afternoon_late_mins = 0
                    attendance = 'H'
                    print(f"No logs after out2 for {staff_id}, marking half-day, resetting afternoon_late_mins")

                # Early out check
                if time_objs and session_exemption != 'afternoon' and time_objs[-1] < end_const and not half_day_afternoon:
                    early_minutes = (end_const - time_objs[-1]).total_seconds() / 60
                    print(f"Early out check: last_log={time_objs[-1].time()}, end_const={end_const.time()}, early_minutes={early_minutes}")
                    if early_minutes > 90:
                        half_day_afternoon = True
                        afternoon_late_mins = 0
                        attendance = 'H'
                        print(f"Early out > 90 mins for {staff_id}, marking afternoon half-day, resetting afternoon_late_mins")
                    else:
                        afternoon_late_mins += early_minutes
                        print(f"Early out mins added to afternoon_late_mins for {staff_id}: {early_minutes}")

                # Two half-days
                if half_day_morning and half_day_afternoon:
                    attendance = 'I'
                    morning_late_mins = 0
                    afternoon_late_mins = 0
                    print(f"Both sessions half-day for {staff_id}, marking as 'I', resetting all late_mins")

                late_mins = morning_late_mins + afternoon_late_mins

            else:
                if not time_objs:
                    try:
                        cursor.execute(
                            "INSERT INTO report (staff_id, date, late_mins, attendance) VALUES (%s, %s, %s, %s) "
                            "ON DUPLICATE KEY UPDATE late_mins = %s, attendance = %s",
                            (staff_id, date, 0, 'I', 0, 'I')
                        )
                        print(f"Inserted/Updated report for {staff_id}: Date: {date}, Late Minutes: 0, Attendance: I")
                    except mysql.connector.Error as err:
                        print(f"Error inserting report for {staff_id}: {err}")
                    continue

                start_const = time_objs[0]
                end_temp = datetime.strptime(f"{date} {category_data[5]}", "%Y-%m-%d %H:%M:%S")
                end_const = start_const + timedelta(hours=end_temp.hour, minutes=end_temp.minute)
                allowed_break = int(category_data[6])

                if time_objs[-1] < end_const:
                    early_minutes = (end_const - time_objs[-1]).total_seconds() / 60
                    if early_minutes > 90:
                        half_day_afternoon = True
                        afternoon_late_mins = 0
                        attendance = 'H'
                        print(f"Early out > 90 mins for {staff_id}, marking half-day, resetting afternoon_late_mins")
                    else:
                        afternoon_late_mins += early_minutes
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
                    afternoon_late_mins += excess_break
                    print(f"Excess break mins for {staff_id}: {excess_break:.2f}")

                if half_day_afternoon and n == 1:
                    attendance = 'H'
                    afternoon_late_mins = 0
                    print(f"Single log with early out for {staff_id}, marking half-day")

                late_mins = afternoon_late_mins

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
    process_logs("")