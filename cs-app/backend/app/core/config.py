import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

DATABASE_URL = os.getenv("CS_DATABASE_URL", f"sqlite:///{BASE_DIR / 'cs.db'}")

SECRET_KEY = os.getenv("CS_SECRET_KEY", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("CS_ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

CORS_ORIGINS = os.getenv("CS_CORS_ORIGINS", "http://localhost:5173").split(",")
