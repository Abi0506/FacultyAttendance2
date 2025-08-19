import mysql.connector
import datetime 

def db():
    try:
        mydb = mysql.connector.connect(
                host="localhost",
                user="root",
                password="root",
                database="faculty_data_logs",
                use_pure=True   
            )
        return mydb
    except mysql.connector.Error as err:
        print(f"Error: {err}")
        return None


def check_log_info(log):
    if not log.user_id or not log.timestamp:
        print(f"Log missing user_id or timestamp: {log}")
        return False

    # Fix: handle both str and datetime.datetime
    if isinstance(log.timestamp, str):
        dt = datetime.datetime.strptime(log.timestamp, "%Y-%m-%d %H:%M:%S")
    else:
        dt = log.timestamp

    date_value = dt.date()
    time_value = dt.time()

    if date_value < datetime.datetime.now().date():
        return False

    mydb = db()
    cursor = mydb.cursor()

    # Fix: Use SELECT to check for existing log
    select_query = """
        SELECT staff_id FROM logs
        WHERE staff_id = %s AND time = %s AND date = %s
    """
    cursor.execute(select_query, (log.user_id, time_value, date_value))
    fetch_result = cursor.fetchall()

    if fetch_result:
        print(f"Log already exists for User ID: {log.user_id}, Timestamp: {log.timestamp}")
        return False
    else:
        print(f"Log does not exist, inserting: User ID: {log.user_id}, Timestamp: {log.timestamp}")
        insert_query = """
            INSERT INTO logs (staff_id, time, date)
            VALUES (%s, %s, %s)
        """
        cursor.execute(insert_query, (log.user_id, time_value, date_value))
        mydb.commit()
        return True
    
