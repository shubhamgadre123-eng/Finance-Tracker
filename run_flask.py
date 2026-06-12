import os

from flask import Flask, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_DIR = os.path.join(BASE_DIR, "new changes")

app = Flask(__name__)


@app.route("/")
def index():
    """
    Serve the main Finance Tracker SPA that was originally in HTML/JS.
    """
    return send_from_directory(HTML_DIR, "Finance Tracker 1.html")


@app.route("/<path:path>")
def static_proxy(path: str):
    """
    Fallback to serve any additional assets from the same directory
    (if you later add CSS/JS/image files next to the HTML).
    """
    return send_from_directory(HTML_DIR, path)


if __name__ == "__main__":
    # Run the whole app via Python (Flask)
    app.run(host="0.0.0.0", port=8000, debug=True)

