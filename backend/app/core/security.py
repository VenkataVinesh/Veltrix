from datetime import datetime, timedelta, timezone
from typing import Literal
import hashlib
import secrets

from jose import jwt, JWTError

from app.core.config import settings


def hash_password(password: str) -> str:
    """Hash password using PBKDF2 - no external crypto dependencies needed."""
    salt = secrets.token_hex(32)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"pbkdf2_sha256${salt}${pwd_hash.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    """Verify PBKDF2 password hash."""
    try:
        if not password_hash.startswith("pbkdf2_sha256$"):
            return False
        parts = password_hash.split("$")
        if len(parts) != 3:
            return False
        salt = parts[1]
        stored_hash = parts[2]
        pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return pwd_hash.hex() == stored_hash
    except Exception:
        return False


def create_token(subject: str, role: str, token_type: Literal["access", "refresh"]) -> str:
    expires_delta = timedelta(minutes=settings.access_expires_min if token_type == "access" else settings.refresh_expires_days * 24 * 60)
    payload = {
        "sub": subject,
        "role": role,
        "type": token_type,
        "exp": datetime.now(tz=timezone.utc) + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except Exception as error:
        raise ValueError("Invalid token") from error
