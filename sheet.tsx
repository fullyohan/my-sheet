import json
from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from schemas import ProjectResponse
from utils import redis_client, save_extracted_data

router = APIRouter(prefix="/api/v1/projects", tags=["Projects"])


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    name: Optional[str] = Form(None),
    capacity_file: Optional[UploadFile] = File(None),
    jira_file: Optional[UploadFile] = File(None),
    leaves_file: Optional[UploadFile] = File(None),
):
    """Mise à jour d'un projet : soit 3 nouveaux fichiers, soit 0 (simple nom/ID)."""

    # 1. Vérification de l'existence du projet
    existing_raw = redis_client.hget("projects:metadata", project_id)
    if not existing_raw:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable"
        )

    # 2. Validation de la règle du "Tout ou Rien" (3 fichiers OU 0)
    files = [capacity_file, jira_file, leaves_file]
    provided_files = [f for f in files if f is not None]

    if len(provided_files) not in (0, 3):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous devez fournir les 3 fichiers (capacity, jira, leaves) ou aucun.",
        )

    has_files = len(provided_files) == 3

    # 3. Validation des extensions si les 3 fichiers sont présents
    if has_files:
        for file in provided_files:
            if not file.filename.endswith(".xlsx"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Le fichier {file.filename} doit être au format .xlsx",
                )

    try:
        # -------------------------------------------------------------
        # CAS 1 : LES 3 FICHIERS SONT PRÉSENTS
        # -------------------------------------------------------------
        if has_files:
            capacity_bytes = await capacity_file.read()
            jira_bytes = await jira_file.read()
            leaves_bytes = await leaves_file.read()

            # Relance l'extraction et re-sauvegarde dans Redis
            updated_project_meta = save_extracted_data(
                old_id=project_id,
                name=name,
                capacity_bytes=capacity_bytes,
                jira_bytes=jira_bytes,
                leaves_bytes=leaves_bytes,
            )

        # -------------------------------------------------------------
        # CAS 2 : 0 FICHIER (Changement de Nom / ID uniquement)
        # -------------------------------------------------------------
        else:
            project_data = json.loads(existing_raw)

            # Si un nouveau nom est renseigné et différent
            if name and name.strip() and name.strip() != project_data.get("name"):
                new_name = name.strip()
                new_id = new_name.lower().replace(" ", "-")  # slugify simple

                # Mettre à jour l'objet
                project_data["id"] = new_id
                project_data["name"] = new_name

                # Nettoyage et mise à jour Redis (Ancien ID -> Nouvel ID)
                redis_client.hdel("projects:metadata", project_id)

                old_data_key = f"projects:{project_id}"
                new_data_key = f"projects:{new_id}"
                if redis_client.exists(old_data_key):
                    redis_client.rename(old_data_key, new_data_key)

                redis_client.hset(
                    "projects:metadata", new_id, json.dumps(project_data)
                )
                updated_project_meta = project_data
            else:
                # Rien n'a changé
                updated_project_meta = project_data

        return updated_project_meta

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la mise à jour : {str(e)}",
        )
