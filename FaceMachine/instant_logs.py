from essl import process_logs
from get_attendance_list import get_attendance_list

def get_instant_report(date):
    
    try:
        result = process_logs(date)
        return f"Instant attendance processed for {date}: {result}"
    except Exception as e:
        return f"Error while processing attendance for {date}: {str(e)}"


def get_instant_list(date):
 
    try:
        result = get_attendance_list(date)
        return f"Attendance list generated for {date}: {result}"
    except Exception as e:
        return f"Error while generating list for {date}: {str(e)}"


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
      
        sys.exit(1)

    func_name = sys.argv[1]
    date = sys.argv[2]
    print(f"Function: {func_name}, Date: {date}")

    if func_name == "report":
        get_instant_report(date)
    elif func_name == "list":
        get_instant_list(date)
    else:
        print(f"Unknown function: {func_name}")
        sys.exit(1)
