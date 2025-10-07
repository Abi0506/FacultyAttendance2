from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

import os
from datetime import timezone, datetime

SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
CALENDAR_ID = 'c_f65646ec47f509e6a093824790c28766188222d525707dfb817f80ac21e9e24c@group.calendar.google.com'

# Use the directory of this file as base
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH = os.path.join(BASE_DIR, 'credentials.json')
TOKEN_PATH = os.path.join(BASE_DIR, 'token.json')

def get_holidays():
    """Fetches upcoming holiday dates from a specified Google Calendar."""
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

    try:
        service = build('calendar', 'v3', credentials=creds)
        now = datetime.now(timezone.utc).isoformat()
        
        events_result = service.events().list(
            calendarId=CALENDAR_ID,
            timeMin=now,
            maxResults=5,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        events = events_result.get('items', [])
        
        # Return only dates marked as 'Holiday'
        return [
            datetime.fromisoformat(event['start'].get('date')).date()
            for event in events
            if 'Holiday' in event.get('summary', '')
        ]

    except Exception as e:
        print(f"Error fetching holidays from Google Calendar: {e}")
        return []
