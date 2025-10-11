import sys
from zk import ZK
from connection import db
import random


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


# def get_uid():
#     connection = db()
#     cursor = connection.cursor()
#     cursor.execute("SELECT ip_address FROM devices where maintenance = %s",(0,))
#     rows = cursor.fetchall()
#     print(rows)
  
#     for (ip,) in rows:
       
      
#         conn = connect_to_device("setting user credentials",ip)
#         uid = conn.get_users()
#         for i in uid:
#             print(i)

# def del_user():
#     connection = db()
#     cursor = connection.cursor()
#     cursor.execute("SELECT ip_address FROM devices where maintenance = %s",(0,))
#     rows = cursor.fetchall()
#     print(rows)
  
#     for (ip,) in rows:
       
      
#         conn = connect_to_device("setting user credentials",ip)
#         uid = conn.delete_user(uid = 11367)
#         conn.disconnect()
         



def set_user_credentials(user_id, name):
    connection = db()
    cursor = connection.cursor()
    cursor.execute("SELECT ip_address FROM devices where maintenance = %s",(0,))
    rows = cursor.fetchall()
    print(rows)
    conn = connect_to_device("setting user credentials",ip)
    if not conn:
        return "Error: Device not connected"
    existing_uids = {user.uid for user in conn.get_users()}
    uid = random.randint(1000, 32767)
    while uid in existing_uids:
        uid = random.randint(1000, 32767)
    for (ip,) in rows:
       
        try:
            conn = connect_to_device("setting user credentials",ip)

            if not conn:
                return "Error: Device not connected"
          
            if not user_id or not name:
                return "Error: Missing ID or name in a device"
        
            print(uid , user_id , name )
            password = str(user_id)
            
            conn.set_user(
                uid=uid,                   
                user_id=str(user_id),       
                name=name,
                privilege=0,
                password=password
            )
           
        except Exception as e:
            return f"Error: Set credentials failed"

        finally:
            conn.disconnect()

   

def delete_user(user_id):
    connection = db()
    cursor = connection.cursor()
    cursor.execute("SELECT ip_address FROM devices where maintenance = %s",(0,))
    rows = cursor.fetchall()

  
    for (ip,) in rows:
        
        
        
        try:
            conn = connect_to_device("deleting user",ip)
            if not conn:
                return "Error: Device not connected"

            if not user_id:
                return "Error: Missing ID in a device"
            
            users = conn.get_users()
            for user in users:
                if(user.user_id == user_id):
                    uid = user.uid
                    break
            if(uid):

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
    
