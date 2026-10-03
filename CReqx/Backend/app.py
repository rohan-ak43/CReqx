"""
CReqx backend entrypoint.

    python app.py            # dev server
    gunicorn app:app          # production (see requirements.txt)

CORS is scoped to the frontend dev origin via an env var rather than left
wide open — tighten CREQX_ALLOWED_ORIGIN before deploying.
"""
from __future__ import annotations

import logging
import os

from flask import Flask

from ML.api import ml_bp

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def create_app() -> Flask:
    app = Flask(__name__)
    app.register_blueprint(ml_bp, url_prefix="/api/ml")

    allowed_origin = os.environ.get("CREQX_ALLOWED_ORIGIN", "http://localhost:5173")

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = allowed_origin
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        return response

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG", "0") == "1", port=int(os.environ.get("PORT", 5000)))
