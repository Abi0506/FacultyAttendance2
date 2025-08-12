
from connection import db_connection
from zk import ZK
from connection import check_log_info
from connection import db

from datetime import timezone
import os.path
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from essl import process_logs
import schedule
import time
import datetime


SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']

def holiday():
    lst = []
    creds = None
    
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    else:
        flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
        creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    
    service = build('calendar', 'v3', credentials=creds)

    
    calendar_id = 'c_f65646ec47f509e6a093824790c28766188222d525707dfb817f80ac21e9e24c@group.calendar.google.com'

 
    now = datetime.datetime.now(timezone.utc).isoformat()

  
    events_result = service.events().list(
        calendarId=calendar_id,
        timeMin=now,
        maxResults=20,
        singleEvents=True,
        orderBy='startTime'
    ).execute()
   
    events = events_result.get('items', [])

    if not events:
        print("No upcoming events found.")
        return

    print(f"\n📅 Upcoming Events from {calendar_id}:\n")
    for event in events:
        start = event['start'].get('dateTime', event['start'].get('date'))
        if "Holiday" in event.get('summary', ''):
            lst.append(start)
        print(f"{start} → {event.get('summary', 'No Title')}")
    
    return lst



def connect_to_device(reason , DEVICE_IP ):
    PORT = 4370
    

    zk = ZK(DEVICE_IP, port=PORT, timeout=5, password=0, force_udp=False, ommit_ping=False)
    try:
        conn = zk.connect()
        print("Connected to device successfully for reason:", reason)
        return conn
    except Exception as e:
        print(f"Connection failed: {e}")
        return False




def get_attendance_list():
     
        connection = db()
        cursor = connection.cursor()
        cursor.execute("SELECT ip_address FROM device")
        rows = cursor.fetchall()

  
        for (ip,) in rows:
        
            conn = connect_to_device("getting attendance list" , ip)
            if not conn:
                print("connection failed")
            try :
                conn.disable_device()
                logs = conn.get_attendance()
                conn.enable_device()

                if not logs:
                    print("No attendance logs found.")
                    return
                
                else:
                    for log in logs:
                        check_log_info(log)

                conn.disconnect()

            except Exception as e:
                print(f"Error getting attendance logs: {e}")
            finally:    
                
                print("Disconnected from device.") 
        cursor.close()
        connection.close()            

def logs_main():
  
    
    holiday_dates = holiday()
    
    if datetime.datetime.today().weekday() != 6 and str(datetime.date.today()) not in holiday_dates : 
       
        schedule.every().day.at("10:30:00").do(get_attendance_list)
        schedule.every().day.at("15:44:00").do(get_attendance_list)
        schedule.every().day.at("16:36:00").do(get_attendance_list)
        schedule.every().day.at("22:30:00").do(get_attendance_list)
        schedule.every().day.at("16:37:00").do(process_logs)
        while True:
            schedule.run_pending()
            time.sleep(1)


   
if __name__ == "__main__":
    logs_main()        