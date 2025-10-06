from connection import check_log_info
from connection import db

from zk import ZK


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




def get_attendance_list(date1):
     
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
                        check_log_info(log,date1)

                conn.disconnect()

            except Exception as e:
                print(f"Error getting attendance logs: {e}")
            finally:    
                
                print("Disconnected from device.") 
        cursor.close()
        connection.close()   