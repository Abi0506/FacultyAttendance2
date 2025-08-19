from connection import check_log_info
from connection import db
from exemption import process_exemptions
from essl import process_logs


from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from zk import ZK
from datetime import timezone
import os.path
import schedule
import time
import datetime


SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
CALENDAR_ID = 'c_f65646ec47f509e6a093824790c28766188222d525707dfb817f80ac21e9e24c@group.calendar.google.com'


def get_holidays():
    """Fetches upcoming holiday dates from a specified Google Calendar."""
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"Error refreshing token: {e}")
                flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
                creds = flow.run_local_server(port=0)
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    try:
        service = build('calendar', 'v3', credentials=creds)
        now = datetime.now(timezone.utc).isoformat()
        
        events_result = service.events().list(
            calendarId=CALENDAR_ID, timeMin=now,
            maxResults=5, singleEvents=True, orderBy='startTime'
        ).execute()
        events = events_result.get('items', [])
        
       
        return [datetime.fromisoformat(event['start'].get('date')).date() for event in events if 'Holiday' in event.get('summary', '')]

    except Exception as e:
        print(f"Error fetching holidays from Google Calendar: {e}")
        return []


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
  
    
    holiday_dates = get_holidays()
    
    if datetime.datetime.today().weekday() != 6 and str(datetime.date.today()) not in holiday_dates : 
       
        schedule.every().day.at("10:30:00").do(get_attendance_list)
        schedule.every().day.at("15:44:00").do(get_attendance_list)
        schedule.every().day.at("16:36:00").do(get_attendance_list)
        schedule.every().day.at("22:30:00").do(get_attendance_list)
        schedule.every().day.at("16:37:00").do(process_logs)
        schedule.every().day.at("16:37:00").do(process_exemptions)

        while True:
            schedule.run_pending()
            time.sleep(1)


   
if __name__ == "__main__":
    logs_main()        