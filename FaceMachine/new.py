from logs import connect_to_device

def get_user_data():
    conn = connect_to_device("", "10.10.33.250")
    if not conn:
        print("Failed to connect to device.")
        return
    try:
        faces = conn.get_users()
        print("User data:", faces)
    except Exception as e:
        print(f"Error fetching user data: {e}")
    finally:
        conn.disconnect()

get_user_data()        