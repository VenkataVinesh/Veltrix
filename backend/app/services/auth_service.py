from fastapi import HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_token, hash_password, verify_password, decode_token
from app.db.models import User


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(settings.access_cookie_name, access_token, httponly=True, samesite="lax", secure=False)
    response.set_cookie(settings.refresh_cookie_name, refresh_token, httponly=True, samesite="lax", secure=False)


def signup(db: Session, response: Response, email: str, password: str, role: str) -> dict:
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    user = User(email=email, password_hash=hash_password(password), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    access = create_token(user.email, user.role, "access")
    refresh = create_token(user.email, user.role, "refresh")
    _set_auth_cookies(response, access, refresh)
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


def login(db: Session, response: Response, email: str, password: str) -> dict:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access = create_token(user.email, user.role, "access")
    refresh = create_token(user.email, user.role, "refresh")
    _set_auth_cookies(response, access, refresh)
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


def refresh(db: Session, response: Response, refresh_token: str) -> dict:
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    access = create_token(user.email, user.role, "access")
    next_refresh = create_token(user.email, user.role, "refresh")
    _set_auth_cookies(response, access, next_refresh)
    return {"access_token": access, "refresh_token": next_refresh, "token_type": "bearer"}
