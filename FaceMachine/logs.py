
from get_attendance_list import get_attendance_list



from zk import ZK
import schedule
import time

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



def logs_main():
        
        get_attendance_list("")
      
        schedule.every(10).minutes.do(get_attendance_list,"")
      

        while True:
            schedule.run_pending()
            time.sleep(1)
        

logs_main()        