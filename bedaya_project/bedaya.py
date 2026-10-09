"""Bedaya's thin Flask UI layer. All demo interactions stay in the browser."""
import os
from flask import Flask, render_template, request, jsonify
from services.mock_data import ROADMAP, INCUBATORS
from services.api_client import request_chat
app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html", page="home")

@app.route("/<page>")
def screen(page):
    if page not in {"login", "questionnaire", "dashboard", "documents", "assistant", "incubators", "funding"}:
        return render_template("error.html", page="error"), 404
    return render_template(page + ".html", page=page, roadmap=ROADMAP, incubators=INCUBATORS)

@app.post("/api/chat")
def chat():
    """Thin adapter to Member 5's service; it contains no AI logic."""
    if request.content_length and request.content_length > 64 * 1024:
        return jsonify(error="Message request is too large."), 413
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify(error="Send a JSON message."), 400
    message = body.get("message")
    if not isinstance(message, str) or not message.strip() or len(message) > 1000:
        return jsonify(error="Enter a question between 1 and 1000 characters."), 400
    history = body.get("history", [])
    if not isinstance(history, list):
        return jsonify(error="Conversation history must be a list."), 400
    clean_history = []
    for turn in history[-10:]:
        if not isinstance(turn, dict) or turn.get("role") not in {"user", "assistant"} or not isinstance(turn.get("content"), str):
            return jsonify(error="Conversation history is not valid."), 400
        clean_history.append({"role": turn["role"], "content": turn["content"][:4000]})
    payload = {"message": message.strip(), "history": clean_history}
    if body.get("lang") in {"ar", "en"}:
        payload["lang"] = body["lang"]
    result, status = request_chat(payload)
    return jsonify(result), status


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=False)
