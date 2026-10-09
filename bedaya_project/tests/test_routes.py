import unittest
from bedaya import app
from services.api_client import call_api

class RouteTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_all_pages_and_assets(self):
        for path in ["/", "/login", "/questionnaire", "/dashboard", "/documents", "/assistant", "/incubators", "/funding", "/static/style.css", "/static/app.js"]:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.data)
                response.close()

    def test_demo_boundaries_and_missing_route(self):
        self.assertIn(b"not connected to SANAD", self.client.get("/login").data)
        self.assertIn(b"not real organizations", self.client.get("/incubators").data)
        self.assertEqual(self.client.get("/missing").status_code, 404)
        self.assertEqual(self.client.post("/api/roadmap").status_code, 404)
        self.assertFalse(call_api("documents")["available"])

if __name__ == "__main__":
    unittest.main()
