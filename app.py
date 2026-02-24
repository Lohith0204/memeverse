from collections import deque

from flask import Flask, jsonify, render_template
import requests

app = Flask(__name__)

MEME_API_URL = "https://meme-api.com/gimme"
MEME_API_TIMEOUT_SECONDS = 6
RECENT_MEME_CACHE_SIZE = 5
FETCH_RETRY_LIMIT = 6

recent_memes = deque(maxlen=RECENT_MEME_CACHE_SIZE)


def fetch_unique_meme():
    for _ in range(FETCH_RETRY_LIMIT):
        response = requests.get(MEME_API_URL, timeout=MEME_API_TIMEOUT_SECONDS)
        response.raise_for_status()
        payload = response.json()

        meme_url = payload.get("url")
        subreddit = payload.get("subreddit")
        title = payload.get("title")

        if not meme_url or not subreddit or not title:
            raise ValueError("Unexpected response payload from meme provider")

        if meme_url in recent_memes:
            continue

        recent_memes.append(meme_url)
        return {
            "meme": meme_url,
            "subreddit": subreddit,
            "title": title,
        }

    raise RuntimeError("Could not fetch a new meme after several attempts")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/meme")
def meme():
    try:
        meme_data = fetch_unique_meme()
        return jsonify(meme_data)
    except requests.exceptions.Timeout:
        return jsonify({"error": "Meme service timed out. Please try again."}), 504
    except requests.exceptions.RequestException:
        return jsonify({"error": "Failed to reach meme service."}), 502
    except Exception:
        return jsonify({"error": "Unable to load meme right now."}), 500


if __name__ == "__main__":
    app.run(debug=True)