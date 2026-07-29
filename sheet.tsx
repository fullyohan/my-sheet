from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict

# ==========================================
# 1. SCHEMAS DE CRÉATION & MISE À JOUR (INPUTS)
# ==========================================

class ProjectCreate(BaseModel):
    name: str
    capacity_file: Any  # Reçoit UploadFile via le handler
    jira_file: Any      # Reçoit UploadFile via le handler
    leaves_file: Any    # Reçoit UploadFile via le handler


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    hasModules: Optional[bool] = None


class ModuleUpdate(BaseModel):
    name: Optional[str] = None


# ==========================================
# 2. SCHEMAS DE RÉPONSE (OUTPUTS)
# ==========================================

# --- Outpout de base pour Projets & Modules ---

class ModuleResponse(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class ProjectResponse(BaseModel):
    id: str
    name: str
    hasModules: bool
    modules: Optional[List[ModuleResponse]] = []

    class Config:
        from_attributes = True


# --- Overview Response Schemas ---

class CapacityMetrics(BaseModel):
    capacityRealHours: float
    consumedHours: float
    occupancyRatePct: int


class BacklogProgressMetrics(BaseModel):
    totalTickets: int
    ticketsDone: int
    progressPct: int


class WorkDistributionMetrics(BaseModel):
    featuresPct: int
    bugsPct: int
    maintenancePct: int


class OverviewResponse(BaseModel):
    success: bool = True
    teams: Optional[List[str]] = []
    capacity: CapacityMetrics
    backlogProgress: BacklogProgressMetrics
    workDistribution: WorkDistributionMetrics


# --- Capacity Grid Response Schemas ---

class SlotDetail(BaseModel):
    date: str
    capacity: float
    consumedHours: float
    activeTasks: List[Dict[str, Any]]
    leaveType: Optional[str] = None


class ResourceCapacity(BaseModel):
    resourceEmail: str
    resourceName: str
    team: str
    slots: List[SlotDetail]


class CapacityGridResponse(BaseModel):
    success: bool = True
    timeSlots: Optional[List[str]] = []
    teams: Optional[List[str]] = []
    resources: List[ResourceCapacity]
