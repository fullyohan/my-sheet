from datetime import datetime
import json
from pathlib import Path
import shutil
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status, Depends
from pydantic import BaseModel
from utils import redis_client as r, get_jira_data, get_leaves_data, get_rm_data, get_status_list, get_teams_list, slugify
from .schemas import *

router = APIRouter(prefix="/api/v1/projects", tags=["Projects"])

UPLOAD_DIR = Path("uploads/projects")


async def verify_if_project_exists(project_id: str) -> bool:
    # Changement: Utilisation du SET projects:index
    return await r.sismember("projects:index", project_id)


async def save_upload_file(upload_file: UploadFile, destination: Path):
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("wb") as buf:
            shutil.copyfileobj(upload_file.file, buf)
    except Exception as e:
        print("Erreur d'enregistrement fichier :", e)
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
    raw_meta = await r.get(f"projects:{project_id}:metadata")
    if not raw_meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Project metadata not found"
        )
    modules = [m.get("id") for m in json.loads(raw_meta).get("modules", [])]  
    if module_id not in modules:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Module not found"
        )


@router.get("/")
async def get_projects():
    # Changement: Lecture depuis le SET projects:index
    project_ids = await r.smembers("projects:index")
    projects = [] 
    for p_id in project_ids:
        raw_meta = await r.get(f"projects:{p_id}:metadata")
        if not raw_meta:
            continue
        meta = json.loads(raw_meta)
        if meta.get("status") != "ACTIVE":
            continue
        projects.append(meta)

    return {"projects": projects}


@router.get("/{project_id}", dependencies=[Depends(verify_valid_project)])
async def get_project(project_id: str):
    raw_data = await r.get(f"projects:{project_id}:metadata")
    return json.loads(raw_data)


@router.patch("/{project_id}/{module_id}/weather/", dependencies=[Depends(verify_valid_project), Depends(verify_valid_module)])
async def update_weather(new_weather: str, project_id: str, module_id: str):
    try:
        raw_meta = await r.get(f"projects:{project_id}:metadata")
        metadata = json.loads(raw_meta)
        
        # Mise à jour du weather sur le module correspondant dans les métadonnées
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


@router.get("/{project_id}/{module_id}/weather/", dependencies=[Depends(verify_valid_project), Depends(verify_valid_module)])
async def get_weather(project_id: str, module_id: str):
    try:
        raw_meta = await r.get(f"projects:{project_id}:metadata")
        metadata = json.loads(raw_meta)
        module_meta = next((m for m in metadata.get("modules", []) if m.get("id") == module_id), {})
        return {"weather": module_meta.get("weather", "unknown")} 
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching weather"
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
            detail="Project already exists"
        )

    project_data = {
        "id": project_id,
        "name": name,
        "status": "DRAFT",
        "modules": [{"id": slugify(mod_name), "name": mod_name} for mod_name in modules_names],
        "updatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    } 
  
    await r.setex(f"projects:{project_id}:metadata", 3600, json.dumps(project_data))
    return project_data


m = {
    "rm": lambda file: get_rm_data(file),
    "leaves": lambda file: get_leaves_data(file)
} 


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
    files: List[UploadFile] = File(None) 
):  
    modules_raw = json.loads(modules_metadata)
    project_id = slugify(name)
    modules_data = {} 

    try:
        if files:
            for file in files:
                if not file.filename.endswith(".xlsx"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File {file.filename} is in wrong format"
                    )
                module_name, extract_type, _ = file.filename.split("_")
                active_module_status_map = [mod.get("statusMapping") for mod in modules_raw if mod.get("id") == module_name][0]   
                
                if not modules_data.get(module_name):
                    modules_data[module_name] = {}   

                file_content = await file.read()
                modules_data[module_name][f"{extract_type}Entries"] = (
                    get_jira_data(file_content, active_module_status_map) 
                    if extract_type == "jira" else 
                    m.get(extract_type)(file_content)
                )

                destination = UPLOAD_DIR / project_id / module_name / file.filename 
                await save_upload_file(file, destination)

        # Enregistrement des données de chaque module sous sa propre clé Redis
        for mod_id, data in modules_data.items():
            await r.set(f"projects:{project_id}:module:{mod_id}:data", json.dumps(data))

        # Récupération/Création des métadonnées
        draft_raw = await r.get(f"projects:{project_id}:metadata")
        metadata = json.loads(draft_raw) if draft_raw else {"id": project_id, "name": name}
        
        metadata["status"] = "ACTIVE"
        metadata["updatedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S") 
        metadata["modules"] = modules_raw

        await r.set(f"projects:{project_id}:metadata", json.dumps(metadata))
        await r.sadd("projects:index", project_id)

        return metadata

    except Exception as e:
        print(e)
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

    # Utilisation d'un pipeline Redis pour garantir l'atomicité
    async with r.pipeline(transaction=True) as pipe:
        if project_id != new_id:
            if await r.sismember("projects:index", new_id):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Un projet avec ce nom existe déjà."
                )

            current_dir = UPLOAD_DIR / project_id
            target_dir = UPLOAD_DIR / new_id
            if current_dir.exists():
                current_dir.rename(target_dir)

            # Migration de la clé metadata & mise à jour du SET d'index
            pipe.delete(f"projects:{project_id}:metadata")
            pipe.srem("projects:index", project_id)
            pipe.sadd("projects:index", new_id)
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

                # Renommage des dossiers physiques
                old_mod_dir = target_dir / old_mod_id
                new_mod_dir = target_dir / new_mod_id
                if old_mod_dir.exists():
                    old_mod_dir.rename(new_mod_dir)

                # Transfert de la clé Redis du module
                old_module_data = await r.get(f"projects:{project_id}:module:{old_mod_id}:data")
                if old_module_data:
                    pipe.set(f"projects:{new_id}:module:{new_mod_id}:data", old_module_data)
                    pipe.delete(f"projects:{project_id}:module:{old_mod_id}:data")

            elif project_id != new_id:
                # Si seul le projet a changé de nom, migrer la clé du module vers le nouveau project_id
                mod_data = await r.get(f"projects:{project_id}:module:{new_mod_id}:data")
                if mod_data:
                    pipe.set(f"projects:{new_id}:module:{new_mod_id}:data", mod_data)
                    pipe.delete(f"projects:{project_id}:module:{new_mod_id}:data")

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
                pipe.delete(f"projects:{project_id}:module:{old_mod_id}:data")

        metadata["id"] = new_id  
        metadata["name"] = new_name   
        metadata["modules"] = updated_modules_list

        pipe.set(f"projects:{new_id}:metadata", json.dumps(metadata))
        await pipe.execute()

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
    project_name = metadata.get("name", project_id)

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

                module_name, extract_type, _ = file.filename.split("_")
                
                active_module_status_map = next(
                    (mod.get("statusMapping") for mod in modules_raw if mod.get("id") == module_name),
                    None
                )

                # Chargement des données existantes du module spécifique
                module_key = f"projects:{project_id}:module:{module_name}:data"
                existing_module_raw = await r.get(module_key)
                module_data = json.loads(existing_module_raw) if existing_module_raw else {}

                file_content = await file.read()
                module_data[f"{extract_type}Entries"] = (
                    get_jira_data(file_content, active_module_status_map)
                    if extract_type == "jira"
                    else m.get(extract_type)(file_content)
                )

                # Sauvegarde granulaire de ce module
                await r.set(module_key, json.dumps(module_data))

                await file.seek(0)
                destination = UPLOAD_DIR / slugify(project_name) / module_name / file.filename
                await save_upload_file(file, destination)

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
        raw_meta = await r.get(f"projects:{project_id}:metadata")
        
        async with r.pipeline(transaction=True) as pipe:
            if raw_meta:
                metadata = json.loads(raw_meta)
                # Suppression des clés Redis de chaque module
                for mod in metadata.get("modules", []):
                    pipe.delete(f"projects:{project_id}:module:{mod.get('id')}:data")

            pipe.delete(f"projects:{project_id}:metadata")
            pipe.srem("projects:index", project_id)
            await pipe.execute()

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
    # Changement clé: Lecture uniquement du module demandé
    module_data_raw = await r.get(f"projects:{project_id}:module:{module_id}:data")
    project_metadata_raw = await r.get(f"projects:{project_id}:metadata")

    module_data = json.loads(module_data_raw) if module_data_raw else {}
    project_metadata = json.loads(project_metadata_raw) if project_metadata_raw else {}

    modules_list = project_metadata.get("modules") or []
    module_metadata = next((m for m in modules_list if m.get("id") == module_id), {})

    tickets = [t for t in module_data.get("jiraEntries", []) if t.get("Clé de ticket") != "None"]
    
    rm_entries = module_data.get("rmEntries", [])
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
