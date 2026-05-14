import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

db_url = settings.database_url
if "POSTGRES_URL" in os.environ:
    db_url = os.environ["POSTGRES_URL"]
elif "STORAGE_URL" in os.environ:
    db_url = os.environ["STORAGE_URL"]

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
elif "VERCEL" in os.environ and db_url.startswith("sqlite:///"):
    db_url = "sqlite:////tmp/veltrix.db"




engine = create_engine(db_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
