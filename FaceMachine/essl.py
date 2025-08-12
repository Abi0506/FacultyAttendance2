import mysql.connector
from datetime import datetime, timedelta
from connection import db as db_connect

def insert_log(cursor, staffs, logs, date):
    print("Inserting log")
    cursor.execute("SELECT * FROM category")
    categories = cursor.fetchall()

    for staff_id, category_id in staffs:
       
        category_data = next((cat for cat in categories if cat[0] == category_id), None)
        if not category_data:
            continue

        time_logs = [log_time for log_staff_id, log_time in logs if log_staff_id == staff_id]
        time_logs.sort()

        late_mins = 0
        break_mins = 0
        attendance = 'P'

        if time_logs:
            time_objs = [datetime.strptime(f"{date} {t}", "%Y-%m-%d %H:%M:%S") for t in time_logs]
            n = len(time_objs)

           
            in_time = category_data[2]
            out_time = category_data[5]
            allowed_break = int(category_data[6])

            if in_time != '0':
                start_const = datetime.strptime(f"{date} {in_time}", "%Y-%m-%d %H:%M:%S")
                end_const = datetime.strptime(f"{date} {out_time}", "%Y-%m-%d %H:%M:%S")
            else:
                start_const = time_objs[0]
                end_temp = datetime.strptime(f"{date} {out_time}", "%Y-%m-%d %H:%M:%S")
                end_const = start_const + timedelta(hours=end_temp.hour, minutes=end_temp.minute)

            if time_objs[0] > start_const:
                
                late_mins += (time_objs[0] - start_const).total_seconds() / 60
                late_mins += 15
                print("start late mins:",late_mins)

            if time_objs[-1] < end_const:
                late_mins += (end_const - time_objs[-1]).total_seconds() / 60
                print("end late mins:",late_mins)

            for i in range(1, n - 1, 2):
                try:
                    exit_time = time_objs[i]
                    entry_time = time_objs[i + 1]
                    break_mins += (entry_time - exit_time).total_seconds() / 60
                    print("break_mins " ,i ,break_mins)
                except IndexError:
                    continue

            if break_mins > allowed_break:
                late_mins += break_mins - allowed_break
                print("Late break mins:",late_mins)
        else:
            attendance = 'A'

        try:
            print("Executing query")
            cursor.execute("""
                INSERT INTO report (staff_id, date, late_mins, attendance)
                VALUES (%s, %s, %s, %s)
            """, (staff_id, date, round(late_mins, 2), attendance))
        except mysql.connector.Error as err:
            print(f"Error inserting log for {staff_id}: {err}")


def process_logs():
    conn = db_connect()

    if not conn:
        print("Database connection failed.")
        return

    cursor = conn.cursor()
    today = datetime.now().date()

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

        insert_log(cursor, staffs, logs, today)
        conn.commit()
    except mysql.connector.Error as err:
        print(f"Error: {err}")
    finally:
        cursor.close()
        conn.close()


