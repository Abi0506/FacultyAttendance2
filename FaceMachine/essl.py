import mysql.connector
from datetime import datetime, timedelta
import math
from connection import db as db_connect
from holiday import get_holidays



def insert_log(cursor, staff_id, category_id, logs, date, is_holiday, categories):
    """Process logs and insert attendance records for a single staff member."""
    if not logs:
        return
    print(f"Inserting log for staff_id: {staff_id}, category_id: {category_id}")
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

        # Handle odd number of logs
        options = []
        if len(time_logs) % 2 == 1 and len(time_logs) > 1:
            for removal_type in ['last', 'center']:
                temp_time_logs = time_logs.copy()
                if removal_type == 'last':
                    temp_time_logs = temp_time_logs[:-1]
                    print(f"Evaluating option (remove last) for {staff_id}: removed {original_logs[-1] if original_logs else None}")
                else:
                    center_index = len(temp_time_logs) // 2
                    removed_log = temp_time_logs.pop(center_index) if temp_time_logs else None
                    print(f"Evaluating option (remove center) for {staff_id}: removed {removed_log}")
                
                temp_time_logs = [t for t in temp_time_logs if t not in flagged_times]
                if not temp_time_logs:
                    continue

                temp_late_mins = 0
                temp_attendance = 'P'
                temp_half_day_morning = False
                temp_half_day_afternoon = False
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
                    print(f"No category data for {staff_id} (category_id: {category_id}) in option {removal_type}")
                    continue
                if category_data[7] == 'fixed' and not all(category_data[i] for i in [2, 3, 4, 5, 6, 8, 9]):
                    print(f"Incomplete category data for {staff_id} (category_id: {category_id}): {category_data}")
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
                        print(f"Error parsing category times for {staff_id} (category_id: {category_id}) in option {removal_type}: {e}")
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

                    # Break check (select one break with lowest late_mins)
                    best_break_late_mins = float('inf')
                    best_break_duration = 0
                    best_temp_half_day_morning = temp_half_day_morning
                    best_temp_half_day_afternoon = temp_half_day_afternoon
                    best_temp_attendance = temp_attendance
                    best_temp_morning_late_mins = temp_morning_late_mins
                    best_temp_afternoon_late_mins = temp_afternoon_late_mins

                    temp_break_morning_late_mins = temp_morning_late_mins
                    temp_break_afternoon_late_mins = temp_afternoon_late_mins
                    temp_break_half_day_morning = temp_half_day_morning
                    temp_break_half_day_afternoon = False
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
                        temp_break_half_day_afternoon = False
                        temp_break_attendance = temp_attendance

                        # Calculate late minutes for out-of-bounds break
                        break_late_mins = 0
                        if exit_time < break_in_const:
                            break_late_mins += (break_in_const - exit_time).total_seconds() / 60
                            print(f"Break starts before break_in for {staff_id}: {break_late_mins:.2f} mins added (exit_time={exit_time}, break_in={break_in_const})")
                        if entry_time > break_out_const:
                            break_late_mins += (entry_time - break_out_const).total_seconds() / 60
                            print(f"Break ends after break_out for {staff_id}: {(entry_time - break_out_const).total_seconds() / 60:.2f} mins added (entry_time={entry_time}, break_out={break_out_const})")

                        # Align break to morning or afternoon
                        if break_late_mins > 0:
                            if exit_time <= middle_time:
                                temp_break_morning_late_mins += break_late_mins
                                if break_late_mins > 90:
                                    temp_break_half_day_morning = True
                                    temp_break_morning_late_mins = 0
                                    temp_break_attendance = 'H'
                                print(f"Break aligned to morning for {staff_id}: {break_late_mins:.2f} mins added")
                            else:
                                temp_break_afternoon_late_mins += break_late_mins
                                if break_late_mins > 90:
                                    temp_break_half_day_afternoon = True
                                    temp_break_afternoon_late_mins = 0
                                    temp_break_attendance = 'H'
                                print(f"Break aligned to afternoon for {staff_id}: {break_late_mins:.2f} mins added")

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

                    if temp_time_objs and not any(t > out2_const for t in temp_time_objs):
                        temp_half_day_afternoon = True
                        temp_afternoon_late_mins = 0
                        temp_attendance = 'H'

                    if temp_time_objs and temp_time_objs[-1] < end_const and not temp_half_day_afternoon:
                        early_minutes = (end_const - temp_time_objs[-1]).total_seconds() / 60
                        if early_minutes > 90:
                            temp_half_day_afternoon = True
                            temp_afternoon_late_mins = 0
                            temp_attendance = 'H'
                        else:
                            temp_afternoon_late_mins += early_minutes

                    if temp_half_day_morning and temp_half_day_afternoon:
                        temp_attendance = 'I'
                        temp_morning_late_mins = 0
                        temp_afternoon_late_mins = 0

                    temp_late_mins = temp_morning_late_mins + temp_afternoon_late_mins

                options.append((int(temp_half_day_morning) + int(temp_half_day_afternoon), temp_late_mins, temp_attendance, temp_time_logs, removal_type))

        else:
            options.append((0, 0, 'P', time_logs, 'none'))

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
            return

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
            return

        try:
            time_objs = [datetime.strptime(f"{date} {t}", "%Y-%m-%d %H:%M:%S") for t in time_logs]
            print(f"Time objects for {staff_id}: {time_objs}")
        except ValueError as e:
            print(f"Error parsing time logs for {staff_id}: {e}")
            return
        n = len(time_objs)

        category_data = next((cat for cat in categories if cat[0] == category_id), None)
        if not category_data:
            print(f"No category data found for staff {staff_id} (category_id: {category_id})")
            return
        if category_data[7] == 'fixed' and not all(category_data[i] for i in [2, 3, 4, 5, 6, 8, 9]):
            print(f"Incomplete category data for {staff_id} (category_id: {category_id}): {category_data}")
            return
        print(f"Category data for {staff_id}: {category_data}")

        attendance = 'P'
        half_day_morning = False
        half_day_afternoon = False
        morning_late_mins = 0
        afternoon_late_mins = 0
        late_mins = 0

        if is_holiday or datetime.strptime(date, "%Y-%m-%d").weekday() == 6:
            if not time_logs:
                print(f"No logs for {staff_id} on holiday or Sunday ({date}), skipping report")
                return

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
                print(f"Constants for {staff_id} (category_id: {category_id}): start={start_const}, break_in={break_in_const}, break_out={break_out_const}, end={end_const}, in1={in1_const}, out2={out2_const}, middle_time={middle_time}")
            except ValueError as e:
                print(f"Error parsing category times for {staff_id} (category_id: {category_id}): {e}")
                return

            if n == 1:
                log_time = time_objs[0]
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
                print(f"Single log for {staff_id} (category_id: {category_id}): {log_time.time()}, closest to {closest_name} ({times_to_compare[[n[0] for n in times_to_compare].index(closest_name)][1].time()}), diff={min_diff:.2f} mins")

                if closest_name == 'in_time' and log_time > start_const:
                    late_minutes = (log_time - start_const).total_seconds() / 60
                    if late_minutes > 90:
                        half_day_morning = True
                        morning_late_mins = 0
                        attendance = 'H'
                        print(f"Single log late > 90 mins for {staff_id} compared to in_time: {late_minutes:.2f}")
                    elif late_minutes > 15:
                        morning_late_mins = late_minutes
                        print(f"Single log late mins for {staff_id} compared to in_time: {late_minutes:.2f}")
                elif closest_name == 'in1' and log_time < in1_const:
                    early_minutes = (in1_const - log_time).total_seconds() / 60
                    if early_minutes > 90:
                        half_day_morning = True
                        morning_late_mins = 0
                        attendance = 'H'
                        print(f"Single log early > 90 mins for {staff_id} compared to in1: {early_minutes:.2f}")
                    else:
                        morning_late_mins = early_minutes
                        print(f"Single log early mins for {staff_id} compared to in1: {early_minutes:.2f}")
                elif closest_name in ['out2', 'out_time'] and log_time < end_const:
                    early_minutes = (end_const - log_time).total_seconds() / 60
                    if early_minutes > 90:
                        half_day_afternoon = True
                        afternoon_late_mins = 0
                        attendance = 'H'
                        print(f"Single log early > 90 mins for {staff_id} compared to {closest_name}: {early_minutes:.2f}")
                    else:
                        afternoon_late_mins = early_minutes
                        print(f"Single log early mins for {staff_id} compared to {closest_name}: {early_minutes:.2f}")
                late_mins = morning_late_mins + afternoon_late_mins

            elif n >= 2:
                if time_objs[0] > start_const:
                    late_minutes = (time_objs[0] - start_const).total_seconds() / 60
                    if late_minutes > 90:
                        half_day_morning = True
                        morning_late_mins = 0
                        attendance = 'H'
                        print(f"Morning absence > 90 mins for {staff_id}: {late_minutes}")
                    elif late_minutes > 15:
                        morning_late_mins += late_minutes
                        print(f"Morning late mins for {staff_id}: {late_minutes}")

                if not any(t > in1_const for t in time_objs):
                    half_day_morning = True
                    morning_late_mins = 0
                    attendance = 'H'
                    print(f"No logs after in1 for {staff_id}, marking morning half-day")

                # Break check (select one break with lowest late_mins)
                break_mins = 0
                best_late_mins = float('inf')
                best_break_duration = 0
                best_half_day_morning = half_day_morning
                best_half_day_afternoon = False
                best_attendance = attendance
                best_morning_late_mins = morning_late_mins
                best_afternoon_late_mins = afternoon_late_mins
                selected_break = None

                temp_morning_late_mins = morning_late_mins
                temp_afternoon_late_mins = afternoon_late_mins
                temp_half_day_morning = half_day_morning
                temp_half_day_afternoon = False
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
                        temp_half_day_afternoon = False
                        temp_attendance = attendance
                        temp_break_mins = 0

                        print(f"Evaluating break {i//2 + 1} for {staff_id}: {break_duration:.2f} mins (from {exit_time} to {entry_time})")

                        # Calculate late minutes for out-of-bounds break
                        break_late_mins = 0
                        if exit_time < break_in_const:
                            break_late_mins += (break_in_const - exit_time).total_seconds() / 60
                            print(f"Break starts before break_in for {staff_id}: {break_late_mins:.2f} mins added (exit_time={exit_time}, break_in={break_in_const})")
                        if entry_time > break_out_const:
                            break_late_mins += (entry_time - break_out_const).total_seconds() / 60
                            print(f"Break ends after break_out for {staff_id}: {(entry_time - break_out_const).total_seconds() / 60:.2f} mins added (entry_time={entry_time}, break_out={break_out_const})")

                        # Align break to morning or afternoon
                        if break_late_mins > 0:
                            if exit_time <= middle_time:
                                temp_morning_late_mins += break_late_mins
                                print(f"Break aligned to morning for {staff_id}: {break_late_mins:.2f} mins added")
                                if break_late_mins > 90:
                                    temp_half_day_morning = True
                                    temp_morning_late_mins = 0
                                    temp_attendance = 'H'
                                    print(f"Break aligned to morning > 90 mins for {staff_id}, marking morning half-day")
                            else:
                                temp_afternoon_late_mins += break_late_mins
                                print(f"Break aligned to afternoon for {staff_id}: {break_late_mins:.2f} mins added")
                                if break_late_mins > 90:
                                    temp_half_day_afternoon = True
                                    temp_afternoon_late_mins = 0
                                    temp_attendance = 'H'
                                    print(f"Break aligned to afternoon > 90 mins for {staff_id}, marking afternoon half-day")

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

                if time_objs and not any(t > out2_const for t in time_objs):
                    half_day_afternoon = True
                    afternoon_late_mins = 0
                    attendance = 'H'
                    print(f"No logs after out2 for {staff_id}, marking half-day")

                if time_objs and time_objs[-1] < end_const and not half_day_afternoon:
                    early_minutes = (end_const - time_objs[-1]).total_seconds() / 60
                    print(f"Early out check: last_log={time_objs[-1].time()}, end_const={end_const.time()}, early_minutes={early_minutes}")
                    if early_minutes > 90:
                        half_day_afternoon = True
                        afternoon_late_mins = 0
                        attendance = 'H'
                        print(f"Early out > 90 mins for {staff_id}, marking afternoon half-day")
                    else:
                        afternoon_late_mins += early_minutes
                        print(f"Early out mins added to afternoon_late_mins for {staff_id}: {early_minutes}")

                if half_day_morning and half_day_afternoon:
                    attendance = 'I'
                    morning_late_mins = 0
                    afternoon_late_mins = 0
                    print(f"Both sessions half-day for {staff_id}, marking as 'I'")

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
                return

            start_const = time_objs[0]
            end_temp = datetime.strptime(f"{date} {category_data[5]}", "%Y-%m-%d %H:%M:%S")
            end_const = start_const + timedelta(hours=end_temp.hour, minutes=end_temp.minute)
            allowed_break = int(category_data[6])

            if n == 1:
                if time_objs[0] < end_const:
                    early_minutes = (end_const - time_objs[0]).total_seconds() / 60
                    if early_minutes > 90:
                        half_day_afternoon = True
                        afternoon_late_mins = 0
                        attendance = 'H'
                        print(f"Single log early > 90 mins for {staff_id} (non-fixed): {early_minutes:.2f}")
                    else:
                        afternoon_late_mins = early_minutes
                        print(f"Single log early mins for {staff_id} (non-fixed): {early_minutes:.2f}")
                late_mins = afternoon_late_mins

            else:
                if time_objs[-1] < end_const:
                    early_minutes = (end_const - time_objs[-1]).total_seconds() / 60
                    if early_minutes > 90:
                        half_day_afternoon = True
                        afternoon_late_mins = 0
                        attendance = 'H'
                        print(f"Early out > 90 mins for {staff_id}, marking half-day")
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
            cursor.fetchall()  # Consume all results to prevent 'Unread result found'
            exists = cursor.rowcount > 0

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
    """Process logs for a given date or current date."""
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
       
        cursor.execute("SELECT staff_id, category FROM staff")
        staffs = cursor.fetchall()
        print(f"Staffs fetched: {staffs}")

        cursor.execute("SELECT * FROM category")
        categories = cursor.fetchall()
        print(f"Categories fetched: {categories}")

        for staff_id, category_id in staffs:
            cursor.execute(
                """
                SELECT logs.staff_id, logs.time
                FROM logs
                JOIN staff ON logs.staff_id = staff.staff_id
                WHERE logs.date = %s AND logs.staff_id = %s
                """,
                (today, staff_id)
            )
            logs = cursor.fetchall()
            print(f"Logs fetched for {staff_id}: {logs}")

            insert_log(cursor, staff_id, category_id, logs, today, is_holiday, categories)
        conn.commit()

    except mysql.connector.Error as err:
        print(f"Error: {err}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    process_logs("")