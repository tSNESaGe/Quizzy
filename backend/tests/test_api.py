# backend/tests/test_api.py
import unittest
import httpx
import os
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

BASE_URL = "http://localhost:8000/api"

class TestQuizAPI(unittest.TestCase):
    """Test the Quiz API endpoints"""
    
    def setUp(self):
        self.token = None
    
    async def get_token(self):
        """Get authentication token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BASE_URL}/auth/token",
                data={
                    "username": os.getenv("ADMIN_USERNAME", "admin"),
                    "password": os.getenv("ADMIN_PASSWORD", "adminpassword123")
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return data["access_token"]
            else:
                raise Exception(f"Failed to get token: {response.text}")
    
    async def test_health_check(self):
        """Test the health check endpoint"""
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{BASE_URL}/health")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "healthy")
    
    async def test_quiz_generation(self):
        """Test quiz generation"""
        if not self.token:
            self.token = await self.get_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BASE_URL}/quizzes/generate",
                json={
                    "topic": "Python Programming",
                    "num_questions": 5,
                    "use_default_prompt": True
                },
                headers={"Authorization": f"Bearer {self.token}"}
            )
            
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(len(data["questions"]), 5)
    
    def test_all(self):
        """Run all tests"""
        loop = asyncio.get_event_loop()
        loop.run_until_complete(self.test_health_check())
        loop.run_until_complete(self.test_quiz_generation())

if __name__ == "__main__":
    unittest.main()