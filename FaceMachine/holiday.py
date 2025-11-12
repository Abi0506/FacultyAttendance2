from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import json
import os , sys
from datetime import timezone, datetime


SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
CALENDAR_ID = 'c_f65646ec47f509e6a093824790c28766188222d525707dfb817f80ac21e9e24c@group.calendar.google.com'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH = os.path.join(BASE_DIR, 'credentials.json')
TOKEN_PATH = os.path.join(BASE_DIR, 'token.json')


# ---- Helper: Authenticate ----
def get_credentials():
    """Get valid Google API credentials, refreshing or re-authorizing if needed."""
    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"Error refreshing token: {e}")
                flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
                creds = flow.run_local_server(port=0)
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_PATH, 'w') as token:
            token.write(creds.to_json())

    return creds


# ---- Function 1: Get upcoming holidays ----
def get_holidays(max_results=5):
    """Fetch the next N upcoming holidays from the calendar."""
    creds = get_credentials()

    try:
        service = build('calendar', 'v3', credentials=creds)
        now = datetime.now(timezone.utc).isoformat()

        events_result = service.events().list(
            calendarId=CALENDAR_ID,
            timeMin=now,
            maxResults=max_results,
            singleEvents=True,
            orderBy='startTime'
        ).execute()

        events = events_result.get('items', [])
        holidays = [
            {
                "date": event['start'].get('date'),
                "summary": event.get('summary', '')
            }
            for event in events if 'Holiday' in event.get('summary', '')
        ]

        return holidays

    except Exception as e:
        print(f"Error fetching upcoming holidays: {e}")
        return []


# ---- Function 2: Get holidays between start and end date ----
def get_holidays_between(start_date: str, end_date: str):
    """
    Fetch all holidays between the given start and end date (YYYY-MM-DD format).
    """
    creds = get_credentials()

    try:
        service = build('calendar', 'v3', credentials=creds)

        events_result = service.events().list(
            calendarId=CALENDAR_ID,
            timeMin=f"{start_date}T00:00:00Z",
            timeMax=f"{end_date}T23:59:59Z",
            singleEvents=True,
            orderBy='startTime'
        ).execute()

        events = events_result.get('items', [])
        holidays = [
            {
                "date": event['start'].get('date'),
                "summary": event.get('summary', '')
            }
            for event in events if 'Holiday' in event.get('summary', '')
        ]
       
        return holidays

    except Exception as e:
        print(f"Error fetching holidays between dates: {e}")
        return []


if __name__ == "__main__":
     if len(sys.argv) == 3:
        start_date, end_date = sys.argv[1], sys.argv[2]
        try:
            holidays = get_holidays_between(start_date, end_date)
           
            print(json.dumps(holidays))
        except Exception as e:
          
            print(json.dumps({"error": str(e)}))



