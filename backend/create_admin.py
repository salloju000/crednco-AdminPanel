import requests
import base64
import sys
import os

def create_admin(user_id):
    print(f"Creating admin user: {user_id}...")
    try:
        # We need an Origin header to pass the CSRF protection middleware!
        headers = {"Origin": "http://localhost:5173"}
        res = requests.post("http://localhost:8001/create-user", json={"user_id": user_id}, headers=headers)
        
        if res.status_code == 400:
            print(f"Error: {res.json().get('detail')}")
            return
            
        res.raise_for_status()
        data = res.json()
        
        # Extract the base64 string
        qr_b64 = data.get("qr_code_base64")
        if qr_b64:
            # Decode and save as image
            with open(f"{user_id}_qrcode.png", "wb") as fh:
                fh.write(base64.b64decode(qr_b64))
            
            print("✅ Success!")
            print(f"Message: {data.get('message')}")
            print(f"QR Code saved as: {os.path.abspath(f'{user_id}_qrcode.png')}")
            print("Open this file in VSCode or File Explorer and scan it with Google Authenticator!")
        else:
            print("Unexpected response:", data)

    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to localhost:8001. Is the admin backend server running?")

if __name__ == "__main__":
    username = "admin"
    if len(sys.argv) > 1:
        username = sys.argv[1]
    create_admin(username)
