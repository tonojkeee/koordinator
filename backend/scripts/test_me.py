import asyncio
import sys
import os
import httpx

async def test_me_endpoint():
    # We'll try to login and then call /auth/me
    base_url = "http://localhost:8000"
    
    async with httpx.AsyncClient() as client:
        try:
            # Login as admin
            print("Logging in as admin...")
            login_res = await client.post(
                f"{base_url}/auth/login",
                data={"username": "admin", "password": "adminpassword"} # Assuming this is the admin password from common local setups or previous context
            )
            
            if login_res.status_code != 200:
                print(f"Login failed: {login_res.text}")
                return
            
            token = login_res.json()["access_token"]
            
            # Call /auth/me
            print("Calling /auth/me...")
            me_res = await client.get(
                f"{base_url}/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if me_res.status_code == 200:
                user_data = me_res.json()
                print(f"--- /auth/me Response ---")
                print(f"Username: {user_data.get('username')}")
                print(f"Email:    {user_data.get('email')}")
                print(f"-------------------------")
            else:
                print(f"Failed to get /auth/me: {me_res.text}")
                
        except Exception as e:
            print(f"Error: {e}. Is the backend running?")

if __name__ == "__main__":
    asyncio.run(test_me_endpoint())
