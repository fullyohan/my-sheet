import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from slugify import slugify

from utils import (
    get_jira_data,
    get_leaves_data,
    get_rm_data,
    get_status_list,
    get_teams_list,
)
from utils import redis_client as r
from .schemas import *

router = APIRouter(prefix="/api/v1/projects", tags=["Projects"])

UPLOAD_DIR = Path("uploads/projects")

m = {
    "rm": lambda file: get_rm_data(file),
    "leaves": lambda file: get_leaves_data(file),
}

# ==========================================
# HELPER FUNCTIONS & DEPENDENCIES
# ==========================================

async def verify_if_project_exists(project_id: str) -> bool:
    return await r.sismember("projects:all", project_id)

async def save_upload_file(upload_file: UploadFile, destination: Path) -> str:
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("wb") as buf:
            shutil.copyfileobj(upload_file.file, buf)
    except Exception as e:
        print("Erreur écriture fichier:", e)
    finally:
        await upload_file.close()

    return str(destination)

async def verify_valid_project(project_id: str):
    if not await verify_if_project_exists(project_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

async def verify_valid_module(project_id: str, module_id: str):
    await verify_valid_project(project_id)
    is_member = await r.sismember(f"project:{project_id}:modules", module_id)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found"
        )

# ==========================================
# ENDPOINTS
# ==========================================

@router.get("/")
async def get_projects():
    project_ids = await r.smembers("projects:all")
    projects = []
    
    for project_id in project_ids:
        meta_raw = await r.get(f"projects:{project_id}:metadata")
        if not meta_raw:
            continue
        meta = json.loads(meta_raw)
        if meta.get("status") == "ACTIVE":
            projects.append(meta)

    return {"projects": projects}


@router.get("/{project_id}", dependencies=[Depends(verify_valid_project)])
async def get_project(project_id: str):
    raw_data = await r.get(f"projects:{project_id}:metadata")
    return json.loads(raw_data)


@router.patch("/{project_id}/{module_id}/weather/", dependencies=[Depends(verify_valid_module)])
async def update_weather(new_weather: str, project_id: str, module_id: str):
    try:
        meta_raw = await r.get(f"projects:{project_id}:metadata")
        metadata = json.loads(meta_raw)
        
        # Mise à jour du weather spécifique au module dans le JSON des modules
        for mod in metadata.get("modules", []):
            if mod.get("id") == module_id:
                mod["weather"] = new_weather
                break

        await r.set(f"projects:{project_id}:metadata", json.dumps(metadata))
        return {"success": True}
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating weather"
        )


@router.get("/{project_id}/{module_id}/weather/", dependencies=[Depends(verify_valid_module)])
async def get_weather(project_id: str, module_id: str):
    try:
        meta_raw = await r.get(f"projects:{project_id}:metadata")
        metadata = json.loads(meta_raw)
        
        mod = next((m for m in metadata.get("modules", []) if m.get("id") == module_id), {})
        return {"weather": mod.get("weather", "unknown")}
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error getting weather"
        )


class DraftBody(BaseModel):
    name: str
    modules_names: List[str]


@router.post("/draft")
async def create_project_draft(payload: DraftBody):
    name = payload.name
    modules_names = payload.modules_names
    project_id = slugify(name)

    if await verify_if_project_exists(project_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already found"
        )

    modules_list = [{"id": slugify(mod_name), "name": mod_name} for mod_name in modules_names]

    project_data = {
        "id": project_id,
        "name": name,
        "status": "DRAFT",
        "modules": modules_list,
        "updatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    # TTL temporaire pour le draft
    await r.setex(f"projects:{project_id}:metadata", 3600, json.dumps(project_data))
    return project_data


@router.post("/get-teams")
async def get_teams(rm_file: UploadFile = File(...)):
    try:
        if not rm_file.filename.endswith(".xlsx"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {rm_file.filename} is invalid"
            )

        teams = get_teams_list(await rm_file.read())
        if not teams:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {rm_file.filename} is invalid"
            )

        return {"teams": [{"id": slugify(t), "tjm": "", "name": t} for t in teams if t]}
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/get-jira-status")
async def get_jira_status(jira_file: UploadFile = File(...)):
    if not jira_file.filename.endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File {jira_file.filename} is invalid"
        )

    jira_status = get_status_list(await jira_file.read())
    if not jira_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File {jira_file.filename} is invalid"
        )

    return {"jiraStatus": jira_status}


@router.post("/")
async def create_project(
    name: str = Form(...),
    modules_metadata: str = Form(...),
    files: Optional[List[UploadFile]] = File(None)
):
    project_id = slugify(name)
    modules_raw = json.loads(modules_metadata)

    try:
        # 1. Traitement et stockage granulaire par module
        if files:
            for file in files:
                if not file.filename or not file.filename.endswith(".xlsx"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File {file.filename} is in wrong format"
                    )

                module_id, extract_type, _ = file.filename.split("_")

                active_module_status_map = next(
                    (mod.get("statusMapping") for mod in modules_raw if mod.get("id") == module_id),
                    None
                )

                # Récupération des données existantes du module
                module_data_raw = await r.get(f"project:{project_id}:module:{module_id}:data")
                module_data = json.loads(module_data_raw) if module_data_raw else {}

                file_bytes = await file.read()
                module_data[f"{extract_type}Entries"] = (
                    get_jira_data(file_bytes, active_module_status_map)
                    if extract_type == "jira"
                    else m.get(extract_type)(file_bytes)
                )

                # Enregistrement isolé pour ce module
                await r.set(f"project:{project_id}:module:{module_id}:data", json.dumps(module_data))

                # Rewind et sauvegarde disque
                await file.seek(0)
                destination = UPLOAD_DIR / project_id / module_id / file.filename
                await save_upload_file(file, destination)

        # 2. Sauvegarde de la liste des modules dans le SET
        for mod in modules_raw:
            mod_id = mod.get("id")
            if mod_id:
                await r.sadd(f"project:{project_id}:modules", mod_id)

        # 3. Métadonnées globales du projet
        metadata = {
            "id": project_id,
            "name": name,
            "status": "ACTIVE",
            "updatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "modules": modules_raw
        }

        await r.set(f"projects:{project_id}:metadata", json.dumps(metadata))
        await r.sadd("projects:all", project_id)

        return metadata

    except Exception as e:
        print(e, getattr(e, '__traceback__', None) and e.__traceback__.tb_lineno)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue ! Veuillez revoir les fichiers importés."
        )


class ModuleItemSchema(BaseModel):
    name: str
    old_name: Optional[str] = None


class QuickUpdateProjectSchema(BaseModel):
    name: str
    modules: List[ModuleItemSchema]


@router.patch("/{project_id}", dependencies=[Depends(verify_valid_project)])
async def quick_update_project(project_id: str, payload: QuickUpdateProjectSchema):
    metadata_raw = await r.get(f"projects:{project_id}:metadata")
    metadata = json.loads(metadata_raw)

    new_name = payload.name
    new_id = slugify(new_name)

    # Si le projet change de nom (et donc de slug/ID)
    if project_id != new_id:
        if await verify_if_project_exists(new_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un projet avec ce nom existe déjà."
            )

        current_dir = UPLOAD_DIR / project_id
        target_dir = UPLOAD_DIR / new_id

        if current_dir.exists():
            current_dir.rename(target_dir)

        # Migration des modules dans Redis
        old_modules = await r.smembers(f"project:{project_id}:modules")
        for mod_id in old_modules:
            mod_data = await r.get(f"project:{project_id}:module:{mod_id}:data")
            if mod_data:
                await r.set(f"project:{new_id}:module:{mod_id}:data", mod_data)
                await r.delete(f"project:{project_id}:module:{mod_id}:data")
            await r.sadd(f"project:{new_id}:modules", mod_id)

        await r.delete(f"project:{project_id}:modules")
        await r.delete(f"projects:{project_id}:metadata")
        await r.srem("projects:all", project_id)
        await r.sadd("projects:all", new_id)
    else:
        target_dir = UPLOAD_DIR / project_id

    old_modules_dict = {m["id"]: m for m in metadata.get("modules", [])}
    migrated_old_ids = set()
    active_new_ids = set()
    updated_modules_list = []

    for mod in payload.modules:
        new_mod_id = slugify(mod.name)
        old_mod_id = slugify(mod.old_name) if mod.old_name else new_mod_id

        active_new_ids.add(new_mod_id)

        if old_mod_id != new_mod_id and old_mod_id in old_modules_dict:
            migrated_old_ids.add(old_mod_id)

            old_mod_dir = target_dir / old_mod_id
            new_mod_dir = target_dir / new_mod_id
            if old_mod_dir.exists():
                old_mod_dir.rename(new_mod_dir)

            # Migration données module dans Redis
            mod_data = await r.get(f"project:{new_id}:module:{old_mod_id}:data")
            if mod_data:
                await r.set(f"project:{new_id}:module:{new_mod_id}:data", mod_data)
                await r.delete(f"project:{new_id}:module:{old_mod_id}:data")

            await r.srem(f"project:{new_id}:modules", old_mod_id)

        await r.sadd(f"project:{new_id}:modules", new_mod_id)

        (target_dir / new_mod_id).mkdir(parents=True, exist_ok=True)

        prev_id = old_mod_id if old_mod_id in old_modules_dict else new_mod_id
        module_backup = old_modules_dict.get(prev_id, {}).copy()

        module_backup["id"] = new_mod_id
        module_backup["name"] = mod.name

        updated_modules_list.append(module_backup)

    # Nettoyage des modules supprimés
    for old_mod_id in list(old_modules_dict.keys()):
        if old_mod_id not in active_new_ids and old_mod_id not in migrated_old_ids:
            mod_dir = target_dir / old_mod_id
            if mod_dir.exists():
                shutil.rmtree(mod_dir)

            await r.delete(f"project:{new_id}:module:{old_mod_id}:data")
            await r.srem(f"project:{new_id}:modules", old_mod_id)

    metadata["id"] = new_id
    metadata["name"] = new_name
    metadata["modules"] = updated_modules_list
    metadata["updatedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    await r.set(f"projects:{new_id}:metadata", json.dumps(metadata))

    return {"id": new_id, "metadata": metadata}


@router.put("/{project_id}", dependencies=[Depends(verify_valid_project)])
async def update_project(
    project_id: str,
    modules_metadata: str = Form(...),
    files: Optional[List[UploadFile]] = File(None)
):
    metadata_raw = await r.get(f"projects:{project_id}:metadata")
    metadata = json.loads(metadata_raw)
    modules_raw = json.loads(modules_metadata)

    try:
        if files:
            for file in files:
                if not file.filename:
                    continue

                if not file.filename.endswith(".xlsx"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File {file.filename} is in wrong format"
                    )

                module_id, extract_type, _ = file.filename.split("_")

                active_module_status_map = next(
                    (mod.get("statusMapping") for mod in modules_raw if mod.get("id") == module_id),
                    None
                )

                # Mise à jour granulaire du module
                existing_mod_data_raw = await r.get(f"project:{project_id}:module:{module_id}:data")
                module_data = json.loads(existing_mod_data_raw) if existing_mod_data_raw else {}

                file_content = await file.read()

                module_data[f"{extract_type}Entries"] = (
                    get_jira_data(file_content, active_module_status_map)
                    if extract_type == "jira"
                    else m.get(extract_type)(file_content)
                )

                await r.set(f"project:{project_id}:module:{module_id}:data", json.dumps(module_data))

                await file.seek(0)
                destination = UPLOAD_DIR / project_id / module_id / file.filename
                await save_upload_file(file, destination)

        # Mise à jour des clés modules dans le SET au cas où un module a été ajouté
        for mod in modules_raw:
            mod_id = mod.get("id")
            if mod_id:
                await r.sadd(f"project:{project_id}:modules", mod_id)

        metadata["updatedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        metadata["modules"] = modules_raw

        await r.set(f"projects:{project_id}:metadata", json.dumps(metadata))

        return metadata

    except HTTPException:
        raise
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue lors de la modification ! Veuillez revoir les fichiers importés."
        )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_valid_project)])
async def delete_project(project_id: str):
    try:
        # 1. Récupération et suppression de tous les modules associés
        modules = await r.smembers(f"project:{project_id}:modules")
        for mod_id in modules:
            await r.delete(f"project:{project_id}:module:{mod_id}:data")

        await r.delete(f"project:{project_id}:modules")
        await r.delete(f"projects:{project_id}:metadata")
        await r.srem("projects:all", project_id)

        # 2. Nettoyage sur disque
        project_dir = UPLOAD_DIR / project_id
        if project_dir.exists() and project_dir.is_dir():
            shutil.rmtree(project_dir)

        return None

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Une erreur est survenue lors de la suppression du projet : {e}"
        )


@router.get("/{project_id}/{module_id}/overview/", dependencies=[Depends(verify_valid_project), Depends(verify_valid_module)])
async def get_overview(project_id: str, module_id: str):
    # Récupération uniquement du module ciblé !
    module_data_raw = await r.get(f"project:{project_id}:module:{module_id}:data")
    project_metadata_raw = await r.get(f"projects:{project_id}:metadata")

    module_data = json.loads(module_data_raw) if module_data_raw else {}
    project_metadata = json.loads(project_metadata_raw) if project_metadata_raw else {}

    modules_list = project_metadata.get("modules") or []
    module_metadata = next((m for m in modules_list if m.get("id") == module_id), {})

    tickets = [t for t in module_data.get("jiraEntries", []) if t.get("Clé de ticket") != "None"]

    rm_entries = module_data.get("rmEntries") or []
    total_rm = len(rm_entries)

    change_requests = [
        t for t in tickets 
        if "ChangeRequest" in (t.get("Tags") or []) and t.get("Type de ticket") == "Story"
    ]

    not_cr = [t for t in tickets if t not in change_requests] 
    cr_count = len(change_requests)
    not_cr_count = len(not_cr)
    dev_cr_count = len([cr for cr in change_requests if cr.get("État") in ["En test", "En production"]])

    get_pct_by_status = lambda status_name: round((len([t for t in not_cr if t.get("État") == status_name]) * 100 / not_cr_count), 1) if not_cr_count else 0.0

    get_ticket_sp = lambda status_list: sum(
        float(t.get("Champs personnalisés (Story Points)") or 0) 
        for t in tickets if t.get("État") in status_list
    )

    get_team_members = lambda role_name: [r for r in rm_entries if r.get("Role") == role_name]
    get_team_total_hours = lambda members: sum(float(r.get("Incurred (hours)") or 0) for r in members)

    teams = module_metadata.get("teams") or []
    incurred_budget = 0.0

    for t in teams:
        members = get_team_members(t.get("name"))
        team_count = len(members)
        
        t["count"] = team_count
        t["pct"] = round(team_count * 100 / total_rm, 1) if total_rm else 0.0
        
        hours = get_team_total_hours(members)
        tjm = float(t.get("tjm") or 0)
        incurred_budget += hours * tjm

    qa_data = module_metadata.get("qa") or {}
    test_runs = qa_data.get("testRuns") or []
    metrics = qa_data.get("metrics") or {}

    total_ok = sum(int(r.get("nbOk") or 0) for r in test_runs)
    total_bloquant = sum(int(r.get("nbKoBloquant") or 0) for r in test_runs)
    total_majeur = sum(int(r.get("nbKoMajeur") or 0) for r in test_runs)
    total_mineur = sum(int(r.get("nbKoMineur") or 0) for r in test_runs)

    total_tests = total_ok + total_bloquant + total_majeur + total_mineur

    start_date = module_metadata.get("startDate")
    mvp_end_date = module_metadata.get("mvpEndDate")
    project_total_sp = float(module_metadata.get("totalSp") or 0)
    total_budget = float(module_metadata.get("allocatedBudget") or 0)

    timeline_pct = 0.0
    if start_date and mvp_end_date:
        try:
            d_start = datetime.strptime(start_date, "%Y-%m-%d")
            d_end = datetime.strptime(mvp_end_date, "%Y-%m-%d")
            total_days = (d_end - d_start).total_seconds()
            if total_days > 0:
                elapsed_days = (datetime.now() - d_start).total_seconds()
                timeline_pct = round(max(0, min(100, elapsed_days * 100 / total_days)), 1)
        except ValueError:
            pass

    return {
        "startDate": start_date,
        "mvpEndDate": mvp_end_date,
        "crEndDate": module_metadata.get("crEndDate"),
        "teams": teams,
        "backlogProgress": {
            "cr": {
                "count": cr_count,
                "unestimatedCount": len([cr for cr in change_requests if not cr.get("Champs personnalisés (Story Points)")]),
                "devCount": dev_cr_count,
                "devProgressPct": round(dev_cr_count * 100 / cr_count, 1) if cr_count else 0.0
            },
            "workDistribution": {
                "inWritingPct": get_pct_by_status("En écriture"),
                "readyPct": get_pct_by_status("Prêt"),
                "inDevPct": get_pct_by_status("En développement"),
                "inTestPct": get_pct_by_status("En test"),
                "inProdPct": get_pct_by_status("En prod"),
            }
        },
        "qaProgress": {
            "testPct": {
                "directValidationPct": round((total_ok * 100 / total_tests), 1) if total_tests else 0.0,
                "reworkBloquantPct": round((total_bloquant * 100 / total_tests), 1) if total_tests else 0.0,
                "reworkMajeurPct": round((total_majeur * 100 / total_tests), 1) if total_tests else 0.0,
                "reworkMineurPct": round((total_mineur * 100 / total_tests), 1) if total_tests else 0.0,
            },
            "metrics": {
                "securityHotspots": float(metrics.get("securityHotspots") or 0.0),
                "coverage": float(metrics.get("coverage") or 0.0),
                "duplicatedLines": float(metrics.get("duplicatedLines") or 0.0),
                "maintainabilityRating": metrics.get("maintainabilityRating") or "N/A",
                "reliabilityRating": metrics.get("reliabilityRating") or "N/A",
                "securityRating": metrics.get("securityRating") or "N/A"
            }
        },
        "projectProgress": {
            "timelinePct": timeline_pct,
            "consumedPct": round(incurred_budget * 100 / total_budget, 1) if total_budget else 0.0,
            "writtingPct": round(get_ticket_sp(["En test", "En production", "Prêt", "En développement"]) * 100 / project_total_sp, 1) if project_total_sp else 0.0,
            "devPct": round(get_ticket_sp(["En test", "En production"]) * 100 / project_total_sp, 1) if project_total_sp else 0.0
        },
    }
