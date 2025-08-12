import sys
from logs import connect_to_device 
from connection import db




def set_user_credentials(user_id, name):
    connection = db()
    cursor = connection.cursor()
    cursor.execute("SELECT ip_address FROM device")
    rows = cursor.fetchall()

  
    for (ip,) in rows:
        
        conn = connect_to_device("setting user credentials",ip)
    
        if not conn:
            return "Error: Device not connected"

        try:
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
    cursor.execute("SELECT ip_address FROM device")
    rows = cursor.fetchall()

  
    for (ip,) in rows:
        
        
        conn = connect_to_device("deleting user",ip)
        if not conn:
            return "Error: Device not connected"

        try:
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

# def migrate():
#     df = pd.read_excel("Faculty.xlsx")
#     filtered_df = df[df["department"] == "CSE" ]  
#     dicts = filtered_df.to_dict(orient="records")
    
#     try:    
            
#         for record in dicts:
#             user_id = record["fac_id"]
#             name = record["name"]
#             set_user_credentials(user_id=user_id, name=name ,password='')
#             time.sleep(1)

            
#     except Exception as e:
#         print(f"Error during migration: {e}")
#     finally:
        
#         print("Migration completed successfully!")      
  


# def delete_logs():
#     conn = connect_to_device("deleting logs")
#     if not conn:
#         return "Error: Device not connected"

#     try:
#         conn.clear_attendance()
#         return "Logs deleted successfully"

#     except Exception as e:
#         return "Error: Delete logs failed"

#     finally:
#         conn.disconnect()

if __name__ == "__main__":
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
    # elif func == 'delete_logs':
    #     print(delete_logs())