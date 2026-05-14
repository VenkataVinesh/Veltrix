import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

db_url = settings.database_url
if "VERCEL" in os.environ and db_url.startswith("sqlite:///"):
    db_url = "sqlite:////tmp/veltrix.db"

engine = create_engine(db_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
