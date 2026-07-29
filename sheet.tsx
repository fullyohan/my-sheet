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
    # 1. Vérification de l'existence
    existing_raw = redis_client.hget("projects:metadata", project_id)
    if not existing_raw:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable"
        )

    # 2. Validation 0 ou 3 fichiers
    provided_files = [
        f
        for f in [capacity_file, jira_file, leaves_file]
        if f is not None
    ]
    if len(provided_files) not in (0, 3):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous devez fournir les 3 fichiers ou aucun.",
        )

    has_files = len(provided_files) == 3
    old_project_data = json.loads(existing_raw)
    target_name = (
        name.strip()
        if (name and name.strip())
        else old_project_data.get("name")
    )

    try:
        # -------------------------------------------------------------
        # CAS 1 : 3 FICHIERS -> save_extracted_data fait tout le boulot
        # -------------------------------------------------------------
        if has_files:
            capacity_bytes = await capacity_file.read()
            jira_bytes = await jira_file.read()
            leaves_bytes = await leaves_file.read()

            # La fonction gère la ré-extraction, le slug et le hset
            updated_project_meta = save_extracted_data(
                target_name, capacity_bytes, jira_bytes, leaves_bytes
            )

            # Si le slug a changé, on nettoie juste l'ancienne entrée
            new_id = updated_project_meta.get("id")
            if new_id != project_id:
                redis_client.hdel("projects:metadata", project_id)
                redis_client.delete(f"projects:{project_id}")

        # -------------------------------------------------------------
        # CAS 2 : 0 FICHIER -> Simple renommage du slug / metadata
        # -------------------------------------------------------------
        else:
            new_id = target_name.lower().replace(" ", "-")  # Ou ta logique de slug

            if new_id != project_id:
                # Transférer les données et supprimer l'ancien
                redis_client.hdel("projects:metadata", project_id)

                if redis_client.exists(f"projects:{project_id}"):
                    redis_client.rename(
                        f"projects:{project_id}", f"projects:{new_id}"
                    )

            old_project_data["id"] = new_id
            old_project_data["name"] = target_name

            redis_client.hset(
                "projects:metadata", new_id, json.dumps(old_project_data)
            )
            updated_project_meta = old_project_data

        return updated_project_meta

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la mise à jour : {str(e)}",
        )
