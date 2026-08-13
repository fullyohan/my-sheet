from datetime import datetime
import json
from pathlib import Path
import shutil
from typing import List, Optional, Dict, Any
from fastapi import (
    APIRouter, 
    HTTPException, 
    UploadFile, 
    File, 
    Form, 
    status, 
    Depends
)
from pydantic import BaseModel, Field
from utils import (
    redis_client as r, 
    get_jira_data, 
    get_leaves_data, 
    get_rm_data, 
    get_status_list, 
    get_ressources_list, 
    slugify, 
    logger
)

router = APIRouter(prefix="/api/v1/projects", tags=["Projects"])
UPLOAD_DIR = Path("uploads/projects")


# ==========================================
# 1. SCHÉMAS PYDANTIC (Models)
# ==========================================

class ModuleMetadataSchema(BaseModel):
    id: str
    name: str
    weather: Optional[str] = "unknown"
    startDate: Optional[str] = None
    mvpEndDate: Optional[str] = None
    crEndDate: Optional[str] = None
    totalSp: Optional[float] = 0
    allocatedBudget: Optional[float] = 0
    velocity: Optional[float] = 0
    ressources: Optional[List[Dict[str, Any]]] = []
    qa: Optional[Dict[str, Any]] = {}


class ProjectMetadataSchema(BaseModel):
    id: str
    name: str
    status: str
    statusMapping: Optional[Dict[str, Any]] = None
    modules: List[ModuleMetadataSchema] = []
    updatedAt: str


class ProjectListResponse(BaseModel):
    projects: List[ProjectMetadataSchema]


class WeatherUpdateSchema(BaseModel):
    weather: str


class WeatherResponse(BaseModel):
    weather: str


class DraftBody(BaseModel):
    name: str
    modules_names: List[str]


class RessourceItem(BaseModel):
    id: str
    tjm: str
    name: str


class RessourcesResponse(BaseModel):
    ressources: List[RessourceItem]


class JiraStatusResponse(BaseModel):
    jiraStatus: List[str]


class ModuleItemSchema(BaseModel):
    name: str
    old_name: Optional[str] = None


class QuickUpdateProjectSchema(BaseModel):
    name: str
    modules: List[ModuleItemSchema]


class QuickUpdateResponse(BaseModel):
    id: str
    metadata: ProjectMetadataSchema


# --- Schémas pour la route Overview ---

class TeamOverview(BaseModel):
    name: str
    count: int
    pct: float
    totalHours: float


class BacklogCROverview(BaseModel):
    count: int
    unestimatedCount: int
    devCount: int
    devProgressPct: float
    jh: float


class WorkDistributionOverview(BaseModel):
    inWritingPct: float
    readyPct: float
    inDevPct: float
    inTestPct: float
    inProdPct: float


class BacklogProgressOverview(BaseModel):
    cr: BacklogCROverview
    workDistribution: WorkDistributionOverview


class TestPctOverview(BaseModel):
    directValidationPct: float
    reworkBloquantPct: float
    reworkMajeurPct: float
    reworkMineurPct: float


class QAMetricsOverview(BaseModel):
    securityHotspots: float
    coverage: float
    duplicatedLines: float
    maintainabilityRating: str
    reliabilityRating: str
    securityRating: str


class QAProgressOverview(BaseModel):
    testPct: TestPctOverview
    metrics: QAMetricsOverview


class ProjectProgressOverview(BaseModel):
    timelinePct: float
    consumedPct: float
    writtingPct: float
    devPct: float


class OverviewResponse(BaseModel):
    startDate: Optional[str] = None
    mvpEndDate: Optional[str] = None
    crEndDate: Optional[str] = None
    teams: List[TeamOverview]
    backlogProgress: BacklogProgressOverview
    qaProgress: QAProgressOverview
    projectProgress: ProjectProgressOverview


# ==========================================
# 2. MIDDLEWARES & HELPERS DE VÉRIFICATION
# ==========================================

async def verify_if_project_exists(project_id: str) -> bool:
    logger.debug(f"Vérification de l'existence du projet : {project_id}")
    return await r.sismember("projects:index", project_id)


async def save_upload_file(upload_file: UploadFile, destination: Path):
    try:
        logger.info(f"Enregistrement du fichier uploadé vers : {destination}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        await upload_file.seek(0)
        with destination.open("wb") as buf:
            shutil.copyfileobj(upload_file.file, buf)
        logger.debug(f"Fichier enregistré avec succès : {destination}")
    except Exception as e:
        logger.error(f"Erreur d'enregistrement fichier {destination.name} : {e}", exc_info=True)
    finally:
        await upload_file.seek(0)
    return str(destination)


async def verify_valid_project(project_id: str):
    logger.info(f"Vérification de la validité du projet ID : {project_id}")
    if not await verify_if_project_exists(project_id):
        logger.warning(f"Projet introuvable : {project_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Project not found"
        )


async def verify_valid_module(project_id: str, module_id: str):
    logger.info(f"Vérification du module {module_id} pour le projet {project_id}")
    await verify_valid_project(project_id)
    raw_meta = await r.get(f"projects:{project_id}:metadata")
    if not raw_meta:
        logger.warning(f"Métadonnées introuvables pour le projet : {project_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Project metadata not found"
        )
    modules = [m.get("id") for m in json.loads(raw_meta).get("modules", [])]  
    if module_id not in modules:
        logger.warning(f"Module {module_id} introuvable dans le projet {project_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Module not found"
        )


# ==========================================
# 3. ROUTES API
# ==========================================

@router.get("/", response_model=ProjectListResponse)
async def get_projects():
    logger.info("Récupération de la liste de tous les projets actifs.")
    project_ids = await r.smembers("projects:index")
    projects = [] 
    for p_id in project_ids:
        raw_meta = await r.get(f"projects:{p_id}:metadata")
        if not raw_meta:
            logger.debug(f"Métadonnées vides pour le projet indexé : {p_id}")
            continue
        meta = json.loads(raw_meta)
        if meta.get("status") != "ACTIVE":
            continue
        projects.append(meta)

    logger.debug(f"Nombre de projets actifs trouvés : {len(projects)}")
    return {"projects": projects}


@router.get("/{project_id}", response_model=ProjectMetadataSchema)
async def get_project(project_id: str):
    logger.info(f"Récupération des détails pour le projet : {project_id}")
    raw_data = await r.get(f"projects:{project_id}:metadata")
    if not raw_data:
        logger.warning(f"Aucune métadonnée trouvée pour le projet : {project_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return json.loads(raw_data)


@router.patch("/{project_id}/{module_id}/weather/", dependencies=[Depends(verify_valid_project), Depends(verify_valid_module)])
async def update_weather(project_id: str, module_id: str, payload: WeatherUpdateSchema):
    logger.info(f"Mise à jour de la météo pour le projet {project_id}, module {module_id} -> {payload.weather}")
    try:
        raw_meta = await r.get(f"projects:{project_id}:metadata")
        metadata = json.loads(raw_meta)
     
        for mod in metadata.get("modules", []):
            if mod.get("id") == module_id:
                mod["weather"] = payload.weather
                break

        await r.set(f"projects:{project_id}:metadata", json.dumps(metadata))
        logger.info(f"Météo mise à jour avec succès pour {project_id}/{module_id}")
        return {"success": True} 
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour de la météo pour {project_id}/{module_id} : {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating weather"
        )


@router.get("/{project_id}/{module_id}/weather/", response_model=WeatherResponse, dependencies=[Depends(verify_valid_project), Depends(verify_valid_module)])
async def get_weather(project_id: str, module_id: str):
    logger.info(f"Récupération de la météo pour le projet {project_id}, module {module_id}")
    try:
        raw_meta = await r.get(f"projects:{project_id}:metadata")
        metadata = json.loads(raw_meta)
        module_meta = next((m for m in metadata.get("modules", []) if m.get("id") == module_id), {})
        weather_value = module_meta.get("weather", "unknown")
        logger.debug(f"Météo récupérée : {weather_value}")
        return {"weather": weather_value} 
    except Exception as e:
        logger.error(f"Erreur lors de la récupération de la météo pour {project_id}/{module_id} : {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching weather"
        )


@router.post("/draft", response_model=ProjectMetadataSchema, status_code=status.HTTP_201_CREATED)
async def create_project_draft(payload: DraftBody):
    logger.info(f"Création d'un brouillon de projet avec le nom : {payload.name}")
    name = payload.name
    modules_names = payload.modules_names
    project_id = slugify(name)

    if await verify_if_project_exists(project_id):
        logger.warning(f"Conflit : Le projet draft '{project_id}' existe déjà.")
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
    logger.info(f"Brouillon de projet créé avec succès (ID: {project_id})")
    return project_data


@router.post("/get-ressources", response_model=RessourcesResponse)
async def get_ressources(rm_file: UploadFile = File(...)):
    logger.info(f"Extraction des ressources à partir du fichier : {rm_file.filename}")
    try:
        if not rm_file.filename.endswith(".xlsx"):
            logger.warning(f"Format de fichier invalide pour les ressources : {rm_file.filename}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {rm_file.filename} is invalid"
            )
        
        ressources = get_ressources_list(await rm_file.read())
        if not ressources:
            logger.warning(f"Aucune ressource trouvée dans le fichier : {rm_file.filename}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {rm_file.filename} is invalid"
            )
        
        logger.info(f"Extraction réussie de {len(ressources)} ressources.")
        return {"ressources": [{"id": slugify(r), "tjm": "", "name": r} for r in ressources if r]} 
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur inattendue dans get_ressources : {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/get-jira-status", response_model=JiraStatusResponse)
async def get_jira_status(jira_files: List[UploadFile] = File(...)):
    logger.info(f"Extraction des statuts Jira pour {len(jira_files)} fichiers.")
    jira_status = [] 
    for jira_file in jira_files:
        if not jira_file.filename.endswith(".xlsx"):
            logger.warning(f"Format invalide pour le fichier Jira : {jira_file.filename}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {jira_file.filename} is invalid"
            )
        status_list = get_status_list(await jira_file.read())
        for s in status_list:
            jira_status.append(s)

    if not jira_status:
        logger.warning("Aucun statut Jira trouvé dans les fichiers présentés.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid Jira status found in uploaded files"
        )

    unique_statuses = list(set(jira_status))
    logger.info(f"Extraction des statuts Jira terminée. Total uniques : {len(unique_statuses)}")
    return {"jiraStatus": unique_statuses} 


@router.post("/", response_model=ProjectMetadataSchema, status_code=status.HTTP_201_CREATED)
async def create_project(
    name: str = Form(...),
    status_mapping: str = Form(...),
    modules_metadata: str = Form(...),
    files: Optional[List[UploadFile]] = File(None) 
):  
    logger.info(f"Création complète du projet : '{name}'")
    try:
        modules_raw = json.loads(modules_metadata)
        status_map_data = json.loads(status_mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Format JSON invalide dans les champs Form.")

    project_id = slugify(name)
    modules_data = {} 

    try:
        if files:
            logger.debug(f"Traitement de {len(files)} fichiers joints pour la création.")
            for file in files:
                if not file.filename.endswith(".xlsx"):
                    logger.warning(f"Fichier rejeté (mauvais format) : {file.filename}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File {file.filename} is in wrong format"
                    )
                
                module_name, extract_type, _ = file.filename.split("_")
                
                if not modules_data.get(module_name):
                    modules_data[module_name] = {}   

                file_content = await file.read()

                modules_data[module_name][f"{extract_type}Entries"] = (
                    get_jira_data(file_content, status_map_data) 
                    if extract_type == "jira" else 
                    get_rm_data(file_content)
                )

                destination = UPLOAD_DIR / project_id / module_name / file.filename 
                await save_upload_file(file, destination)

        for mod_id, data in modules_data.items():
            await r.set(f"projects:{project_id}:modules:{mod_id}:data", json.dumps(data))

        draft_raw = await r.get(f"projects:{project_id}:metadata")
        metadata = json.loads(draft_raw) if draft_raw else {"id": project_id, "name": name}
        
        metadata["status"] = "ACTIVE"
        metadata["statusMapping"] = status_map_data
        metadata["updatedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S") 
        metadata["modules"] = modules_raw

        await r.set(f"projects:{project_id}:metadata", json.dumps(metadata))
        await r.sadd("projects:index", project_id)

        logger.info(f"Projet '{name}' (ID: {project_id}) créé et activé avec succès.")
        return metadata

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la création du projet '{name}' : {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue ! Veuillez revoir les fichiers importés."
        )


@router.patch("/{project_id}", response_model=QuickUpdateResponse, dependencies=[Depends(verify_valid_project)])
async def quick_update_project(project_id: str, payload: QuickUpdateProjectSchema):
    logger.info(f"Mise à jour rapide (Quick Update) pour le projet ID : {project_id}")
    metadata_raw = await r.get(f"projects:{project_id}:metadata")
    metadata = json.loads(metadata_raw)

    new_name = payload.name
    new_id = slugify(new_name)

    async with r.pipeline(transaction=True) as pipe:
        if project_id != new_id:
            logger.info(f"Changement d'ID de projet détecté : de {project_id} vers {new_id}")
            if await r.sismember("projects:index", new_id):
                logger.warning(f"Conflit de renommage : un projet nommé '{new_id}' existe déjà.")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Un projet avec ce nom existe déjà."
                )

            current_dir = UPLOAD_DIR / project_id
            target_dir = UPLOAD_DIR / new_id
            if current_dir.exists():
                current_dir.rename(target_dir)

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
                logger.debug(f"Migration du module {old_mod_id} vers {new_mod_id}")

                old_mod_dir = target_dir / old_mod_id
                new_mod_dir = target_dir / new_mod_id
                if old_mod_dir.exists():
                    old_mod_dir.rename(new_mod_dir)

                old_module_data = await r.get(f"projects:{project_id}:modules:{old_mod_id}:data")
                if old_module_data:
                    pipe.set(f"projects:{new_id}:modules:{new_mod_id}:data", old_module_data)
                    pipe.delete(f"projects:{project_id}:modules:{old_mod_id}:data")

            elif project_id != new_id:
                mod_data = await r.get(f"projects:{project_id}:modules:{new_mod_id}:data")
                if mod_data:
                    pipe.set(f"projects:{new_id}:modules:{new_mod_id}:data", mod_data)
                    pipe.delete(f"projects:{project_id}:modules:{old_mod_id}:data")

            (target_dir / new_mod_id).mkdir(parents=True, exist_ok=True)

            prev_id = old_mod_id if old_mod_id in old_modules_dict else new_mod_id
            module_backup = old_modules_dict.get(prev_id, {}).copy()
            module_backup["id"] = new_mod_id
            module_backup["name"] = mod.name

            updated_modules_list.append(module_backup)

        for old_mod_id in list(old_modules_dict.keys()):
            if old_mod_id not in active_new_ids and old_mod_id not in migrated_old_ids:
                logger.info(f"Suppression du module obsolète : {old_mod_id}")
                mod_dir = target_dir / old_mod_id
                if mod_dir.exists():
                    shutil.rmtree(mod_dir)
                pipe.delete(f"projects:{project_id}:modules:{old_mod_id}:data")

        metadata["id"] = new_id  
        metadata["name"] = new_name   
        metadata["modules"] = updated_modules_list

        pipe.set(f"projects:{new_id}:metadata", json.dumps(metadata))
        await pipe.execute()

    logger.info(f"Mise à jour rapide réussie pour le projet (Nouvel ID: {new_id})")
    return {"id": new_id, "metadata": metadata}


@router.put("/{project_id}", response_model=ProjectMetadataSchema, dependencies=[Depends(verify_valid_project)])
async def update_project(
    project_id: str,
    status_mapping: str = Form(...),
    modules_metadata: str = Form(...),
    files: Optional[List[UploadFile]] = File(None)
):
    logger.info(f"Mise à jour complète du projet ID : {project_id}")
    metadata_raw = await r.get(f"projects:{project_id}:metadata")
    if not metadata_raw:
        logger.warning(f"Projet introuvable lors de la mise à jour : {project_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Projet introuvable"
        )
        
    metadata = json.loads(metadata_raw)
    try:
        modules_raw = json.loads(modules_metadata)
        status_map_data = json.loads(status_mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="JSON invalide dans le Form Data")

    project_dir = UPLOAD_DIR / project_id

    try:
        if files:
            logger.debug(f"Traitement de {len(files)} fichiers lors de la mise à jour.")
            for file in files:
                if not file.filename or not file.filename.endswith(".xlsx"):
                    continue

                module_id, extract_type, _ = file.filename.split("_")
                destination = project_dir / module_id / file.filename
                
                await file.seek(0)
                await save_upload_file(file, destination)

    
        for module in modules_raw:
            module_id = module["id"]
            
            module_dir = project_dir / module_id
            module_key = f"projects:{project_id}:modules:{module_id}:data"
            
            module_data = {}
           
            if module_dir.exists():
                for excel_file in module_dir.glob("*.xlsx"):
                    extract_type = excel_file.name.split("_")[1]   
                    with open(excel_file, "rb") as f:
                        file_content = f.read()

                    if extract_type == "jira":
                        module_data["jiraEntries"] = get_jira_data(file_content, status_map_data)
                    else:
                        module_data["rmEntries"] = get_rm_data(file_content)

            await r.set(module_key, json.dumps(module_data))

        metadata["statusMapping"] = status_map_data
        metadata["updatedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        metadata["modules"] = modules_raw

        await r.set(f"projects:{project_id}:metadata", json.dumps(metadata))

        logger.info(f"Mise à jour complète réussie pour le projet : {project_id}")
        return metadata

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur update_project pour {project_id} : {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue lors de la modification ! Veuillez revoir les fichiers importés."
        )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_valid_project)])
async def delete_project(project_id: str):
    logger.info(f"Demande de suppression du projet ID : {project_id}")
    try:
        raw_meta = await r.get(f"projects:{project_id}:metadata")
        
        async with r.pipeline(transaction=True) as pipe:
            if raw_meta:
                metadata = json.loads(raw_meta)
                for mod in metadata.get("modules", []):
                    pipe.delete(f"projects:{project_id}:modules:{mod.get('id')}:data")

            pipe.delete(f"projects:{project_id}:metadata")
            pipe.srem("projects:index", project_id)
            await pipe.execute()

        project_dir = UPLOAD_DIR / project_id
        if project_dir.exists() and project_dir.is_dir():
            shutil.rmtree(project_dir)
            logger.info(f"Dossier du projet supprimé du disque : {project_dir}")

        logger.info(f"Projet {project_id} supprimé avec succès.")
        return None

    except Exception as e:
        logger.error(f"Erreur lors de la suppression du projet {project_id} : {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Une erreur est survenue lors de la suppression du projet : {e}"
        )


@router.get("/{project_id}/{module_id}/overview/", response_model=OverviewResponse, dependencies=[Depends(verify_valid_project), Depends(verify_valid_module)])
async def get_overview(project_id: str, module_id: str):
    logger.info(f"Génération de l'overview pour le projet {project_id}, module {module_id}")
    module_data = json.loads(await r.get(f"projects:{project_id}:modules:{module_id}:data") or "{}")
    project_metadata = json.loads(await r.get(f"projects:{project_id}:metadata") or "{}")

    modules_list = project_metadata.get("modules") or []
    module_metadata = next((m for m in modules_list if m.get("id") == module_id), {})

    tickets = [t for t in module_data.get("jiraEntries") or [] if t.get("Clé de ticket") != "None"]
    
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

    ressources = module_metadata.get("ressources") or []
    
    ressource_tjm_map = {
        res.get("name"): float(res.get("tjm") or 0) 
        for res in ressources if res.get("name")
    }

    incurred_budget = 0.0
    teams_summary = {}

    for entry in rm_entries:
        role = entry.get("Role")
        person_name = entry.get("Team Member")
        hours = entry.get("Incurred (hours)") or 0

        tjm = ressource_tjm_map.get(person_name, 0.0)
        incurred_budget += hours * tjm

        if role not in teams_summary:
            teams_summary[role] = {
                "name": role,
                "count": 0,
                "hours": 0.0
            }
        teams_summary[role]["count"] += 1
        teams_summary[role]["hours"] += hours

    teams = []
    for role, data in teams_summary.items():
        count = data["count"]
        teams.append({
            "name": role,
            "count": count,
            "pct": round(count * 100 / total_rm, 1) if total_rm else 0.0,
            "totalHours": round(data["hours"], 1)
        })

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
    velocity = module_metadata.get("velocity", 0.0)
    timeline_pct = 0.0
    
    if start_date and mvp_end_date:
        try:
            d_start = datetime.strptime(start_date, "%Y-%m-%d")
            d_end = datetime.strptime(mvp_end_date, "%Y-%m-%d")
            total_days = (d_end - d_start).total_seconds()
            if total_days > 0:
                elapsed_days = (datetime.now() - d_start).total_seconds()
                timeline_pct = round(max(0, min(100, elapsed_days * 100 / total_days)), 1)
        except ValueError as ve:
            logger.warning(f"Erreur de format de date lors du calcul de la timeline pour {project_id}/{module_id} : {ve}")

    logger.debug(f"Overview générée avec succès pour {project_id}/{module_id}")
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
                "devProgressPct": round(dev_cr_count * 100 / cr_count, 1) if cr_count else 0.0,
                "jh": sum(float(cr.get("Champs personnalisés (Story Points)") or 0) for cr in change_requests) / velocity if velocity else 0
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
                "maintainabilityRating": str(metrics.get("maintainabilityRating") or "N/A"),
                "reliabilityRating": str(metrics.get("reliabilityRating") or "N/A"),
                "securityRating": str(metrics.get("securityRating") or "N/A")
            }
        },
        "projectProgress": {
            "timelinePct": timeline_pct,
            "consumedPct": round(incurred_budget * 100 / total_budget, 1) if total_budget else 0.0,
            "writtingPct": round(get_ticket_sp(["En test", "En production", "Prêt", "En développement"]) * 100 / project_total_sp, 1) if project_total_sp else 0.0,
            "devPct": round(get_ticket_sp(["En test", "En production"]) * 100 / project_total_sp, 1) if project_total_sp else 0.0
        },
    }
