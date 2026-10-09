import json
import os
import unittest
from unittest.mock import patch, MagicMock
from bedaya import app
from services.api_client import request_chat

class ChatTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_invalid_input_never_calls_service(self):
        with patch("bedaya.request_chat") as service:
            for body in [{}, {"message": " "}, {"message": "x" * 1001}, {"message": "hi", "history": 123}]:
                self.assertEqual(self.client.post("/api/chat", json=body).status_code, 400)
            service.assert_not_called()

    def test_history_is_bounded_and_private_extra_fields_removed(self):
        answer = {"answer": "Example answer", "source": "mock"}
        with patch("bedaya.request_chat", return_value=(answer, 200)) as service:
            turns = [{"role": "user", "content": str(i)} for i in range(20)]
            response = self.client.post("/api/chat", json={"message": " hello ", "history": turns, "profile": {"private": "ignored"}, "lang": "ar"})
            self.assertEqual(response.status_code, 200)
            sent = service.call_args.args[0]
            self.assertEqual(sent["message"], "hello")
            self.assertEqual(len(sent["history"]), 10)
            self.assertNotIn("profile", sent)
            self.assertEqual(sent["lang"], "ar")

    def test_missing_config_is_honest_offline_state(self):
        with patch.dict(os.environ, {"BEDAYA_API_BASE_URL": ""}):
            response = self.client.post("/api/chat", json={"message": "hello"})
        self.assertEqual(response.status_code, 503)
        self.assertIn("not connected", response.json["error"])
        self.assertNotIn("answer", response.json)

    def test_confirmed_m5_endpoint_and_source_preserved(self):
        upstream = MagicMock()
        upstream.__enter__.return_value.read.return_value = json.dumps({"answer": "From the team service", "source": "llm", "sources": [], "lang": "en"}).encode()
        with patch.dict(os.environ, {"BEDAYA_API_BASE_URL": "http://127.0.0.1:3000"}), patch("urllib.request.urlopen", return_value=upstream) as call:
            result, status = request_chat({"message": "hello", "history": []})
            self.assertEqual(status, 200)
            self.assertEqual(result["source"], "llm")
            self.assertEqual(call.call_args.args[0].full_url, "http://127.0.0.1:3000/api/ai/chat")

    def test_bad_upstream_response(self):
        upstream = MagicMock()
        upstream.__enter__.return_value.read.return_value = b'{"answer":"Missing source"}'
        with patch.dict(os.environ, {"BEDAYA_API_BASE_URL": "http://127.0.0.1:3000"}), patch("urllib.request.urlopen", return_value=upstream):
            self.assertEqual(request_chat({"message": "hello"})[1], 502)

    def test_service_timeout(self):
        with patch.dict(os.environ, {"BEDAYA_API_BASE_URL": "http://127.0.0.1:3000"}), patch("urllib.request.urlopen", side_effect=TimeoutError):
            result, status = request_chat({"message": "hello"})
            self.assertEqual(status, 503)
            self.assertNotIn("answer", result)
