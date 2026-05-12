from typing import Generic, TypeVar

from sqlalchemy.orm import Session

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    def __init__(self, db: Session, model: type[ModelType]) -> None:
        self.db = db
        self.model = model

    def get(self, entity_id: int) -> ModelType | None:
        return self.db.query(self.model).filter(self.model.id == entity_id).first()

    def list(self, offset: int = 0, limit: int = 50):
        return self.db.query(self.model).offset(offset).limit(limit).all()

    def create(self, **kwargs) -> ModelType:
        obj = self.model(**kwargs)
        self.db.add(obj)
        self.db.flush()
        return obj

    def delete(self, obj: ModelType) -> None:
        self.db.delete(obj)
