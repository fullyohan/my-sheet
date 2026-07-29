from fastapi import APIRouter, HTTPException, status
from typing import List
from schemas import ProjectUpdate, ProjectResponse, ModuleUpdate, ModuleResponse

router = APIRouter(prefix="/api/v1", tags=["Projects & Modules"])

# -------------------------------------------------------------------
# PROJETS
# -------------------------------------------------------------------

@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, payload: ProjectUpdate):
    """
    Mise à jour partielle d'un projet (nom, statut modules).
    """
    # 1. Chercher le projet dans la BDD
    # project = db.query(Project).filter(Project.id == project_id).first()
    
    # Fake verification
    project_exists = True 
    if not project_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Projet introuvable"
        )
    
    # 2. Appliquer les modifications reçues
    # if payload.name is not None:
    #     project.name = payload.name
    # if payload.hasModules is not None:
    #     project.hasModules = payload.hasModules
    
    # db.commit()
    # db.refresh(project)
    
    return {
        "id": project_id,
        "name": payload.name or "Projet Modifié",
        "hasModules": payload.hasModules if payload.hasModules is not None else False,
        "modules": []
    }


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str):
    """
    Suppression d'un projet et de ses dépendances.
    """
    # project = db.query(Project).filter(Project.id == project_id).first()
    project_exists = True
    
    if not project_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Projet introuvable"
        )
    
    # db.delete(project)
    # db.commit()
    
    # Un status 204 No Content ne retourne pas de body
    return None

# -------------------------------------------------------------------
# MODULES (Optionnel)
# -------------------------------------------------------------------

@router.patch("/projects/{project_id}/modules/{module_id}", response_model=ModuleResponse)
async def update_module(project_id: str, module_id: str, payload: ModuleUpdate):
    """
    Mise à jour d'un module spécifique au sein d'un projet.
    """
    # module = db.query(Module).filter(Module.id == module_id, Module.project_id == project_id).first()
    module_exists = True
    if not module_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Module introuvable"
        )
    
    return {
        "id": module_id,
        "name": payload.name or "Module Modifié"
    }


@router.delete("/projects/{project_id}/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_module(project_id: str, module_id: str):
    """
    Suppression d'un module spécifique.
    """
    # module = db.query(Module).filter(Module.id == module_id, Module.project_id == project_id).first()
    module_exists = True
    if not module_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Module introuvable"
        )
    
    # db.delete(module)
    # db.commit()
    
    return None
