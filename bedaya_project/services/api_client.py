"""Proposed integration boundary. No network requests are implemented.
Member 4/5 must confirm these contracts before replacing the mock UI.
Never send files or private input without a reviewed, explicit user action.
"""
import os
API_BASE_URL = os.environ.get("BEDAYA_API_BASE_URL", "")
PROPOSED_ENDPOINTS = {
    "roadmap": ("POST", "/api/roadmap"),
    "chat": ("POST", "/api/chat"),
    "documents": ("POST", "/api/documents/analyze"),
    "incubators": ("GET", "/api/incubators"),
}
def call_api(feature, payload=None):
    """Safe fallback until a teammate supplies the confirmed API contract."""
    if feature not in PROPOSED_ENDPOINTS:
        raise ValueError("Unknown feature")
    return {"available": False, "demo": True,
            "message": "Service is not connected. Continue using the local demo."}


# Member 5's confirmed contract on branch M5_Ameen (commit 00a3d02).
# Configure the service origin, e.g. http://127.0.0.1:3000, on the Flask server.
# Model keys remain on Member 5's service; the browser never receives them.
CHAT_ENDPOINT = "/api/ai/chat"


def request_chat(payload):
    """Forward a chat request only after the user presses Send.

    No questionnaire data, identities, or files are automatically forwarded.
    Returns (JSON response, HTTP status). No fabricated answer on failure.
    """
    import json
    from urllib.error import HTTPError, URLError
    from urllib.parse import urlparse
    from urllib.request import Request, urlopen

    base_url = os.environ.get("BEDAYA_API_BASE_URL", "").strip().rstrip("/")
    parsed = urlparse(base_url)
    if not base_url:
        return {"error": "Member 5's chatbot is not connected yet. Ask them to start their service and provide its address."}, 503
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        return {"error": "The chatbot service address is not configured correctly."}, 503

    req = Request(base_url + CHAT_ENDPOINT,
                  data=json.dumps(payload).encode("utf-8"),
                  headers={"Content-Type": "application/json", "Accept": "application/json"},
                  method="POST")
    try:
        with urlopen(req, timeout=15) as response:
            # Bound response size before parsing external data.
            raw = response.read(512 * 1024 + 1)
        if len(raw) > 512 * 1024:
            return {"error": "The chatbot returned an oversized response. Please try again."}, 502
        result = json.loads(raw)
        if (not isinstance(result, dict) or not isinstance(result.get("answer"), str)
                or not result["answer"].strip()
                or result.get("source") not in {"mock", "llm", "cache", "fallback"}):
            return {"error": "The chatbot returned an unexpected response. Ask Member 5 to check the API."}, 502
        # Keep only confirmed fields used by the UI.
        result = {key: result[key] for key in
                  ("answer", "lang", "kind", "sources", "offices", "source", "disclaimer") if key in result}
        return result, 200
    except HTTPError:
        return {"error": "Member 5's service could not process this question. Try again or ask them to check its logs."}, 502
    except (URLError, TimeoutError, OSError):
        return {"error": "Member 5's chatbot service is offline or taking too long. Check that it is running, then try again."}, 503
    except (ValueError, UnicodeError):
        return {"error": "The chatbot response could not be read. Ask Member 5 to check the API."}, 502
