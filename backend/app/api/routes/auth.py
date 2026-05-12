from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import LoginRequest, RefreshRequest, SignupRequest, UserProfile
from app.services import auth_service

router = APIRouter()

@router.post("/signup")
def signup(payload: SignupRequest, response: Response, db: Session = Depends(get_db)) -> dict:
    return auth_service.signup(db, response, payload.email, payload.password, payload.role)


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> dict:
    return auth_service.login(db, response, payload.email, payload.password)


@router.post("/refresh")
def refresh(payload: RefreshRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    refresh_token = payload.refresh_token or request.cookies.get(settings.refresh_cookie_name)
    return auth_service.refresh(db, response, refresh_token)


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(settings.access_cookie_name)
    response.delete_cookie(settings.refresh_cookie_name)
    return {"status": "ok"}


@router.get("/me", response_model=UserProfile)
def me(user: User = Depends(get_current_user)) -> UserProfile:
    return UserProfile(id=user.id, email=user.email, role=user.role)
