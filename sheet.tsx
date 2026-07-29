from pydantic import BaseModel
from typing import Optional, List

# --- MODULE SCHEMAS ---
class ModuleUpdate(BaseModel):
    name: Optional[str] = None

class ModuleResponse(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True

# --- PROJECT SCHEMAS ---
class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    hasModules: Optional[bool] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    hasModules: bool
    modules: Optional[List[ModuleResponse]] = []

    class Config:
        from_attributes = True
