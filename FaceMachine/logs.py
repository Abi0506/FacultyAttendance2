from connection import check_log_info
from connection import db
from exemption import process_exemptions
from essl import process_logs




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




def get_attendance_list():
     
        connection = db()
        cursor = connection.cursor()
        cursor.execute("SELECT ip_address FROM devices where maintenance = %s",(0,))
        rows = cursor.fetchall()

  
        for (ip,) in rows:
        
           
            try :
                conn = connect_to_device("getting attendance list" , ip)
                if not conn:
                    print("connection failed")
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
  
        # get_attendance_list()
        # process_logs()
        # process_exemptions()
        schedule.every(10).minutes.do(get_attendance_list)
        schedule.every().day.at("22:30:00").do(process_logs)
        schedule.every().day.at("23:30:00").do(process_exemptions)

        while True:
            schedule.run_pending()
            time.sleep(1)


logs_main() 

        