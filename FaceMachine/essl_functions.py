import sys
from zk import ZK
from connection import db


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



def set_user_credentials(user_id, name):
    connection = db()
    cursor = connection.cursor()
    cursor.execute("SELECT ip_address FROM devices")
    rows = cursor.fetchall()

  
    for (ip,) in rows:
       
        try:
            conn = connect_to_device("setting user credentials",ip)
            if not conn:
                return "Error: Device not connected"

            if not user_id or not name:
                return "Error: Missing ID or name in a device"
            try:
                uid = int(user_id[1:])
            except ValueError:
                return "Error: Invalid ID format"
            
            password = name
            conn.set_user(
                uid=uid,                   
                user_id=str(user_id),       
                name=name,
                privilege=0,
                password=password
            )
            return f"User {user_id} added successfully"

        except Exception as e:
            return f"Error: Set credentials failed"

        finally:
            conn.disconnect()

   

def delete_user(user_id):
    connection = db()
    cursor = connection.cursor()
    cursor.execute("SELECT ip_address FROM devices")
    rows = cursor.fetchall()

  
    for (ip,) in rows:
        
        
        
        try:
            conn = connect_to_device("deleting user",ip)
            if not conn:
                return "Error: Device not connected"

            if not user_id:
                return "Error: Missing ID in a device"
            try:
                uid = int(user_id[1:])
            except ValueError:
                return "Error: Invalid ID format"
            
            conn.delete_user(uid=uid)
            return f"User {user_id} deleted successfully"

        except Exception as e:
            return "Error: Delete user failed"

        finally:
            conn.disconnect()

if __name__ == "__main__":
    print("Running ESSL functions script")
    func = sys.argv[1]
    if func == 'set_user_credentials':
        if len(sys.argv) < 4:
            print("Error: Missing ID or name")
        else:
            user_id = sys.argv[2]
            name = sys.argv[3]
            print(set_user_credentials(user_id, name))
    elif func == 'delete_user':
        if len(sys.argv) < 3:
            print("Error: Missing ID")
        else:
            user_id = sys.argv[2]
            print(delete_user(user_id))
