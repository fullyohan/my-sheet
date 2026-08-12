@router.post("/")
async def create_project(
    name: str = Form(...),
    status_mapping: str = Form(...),  # <- Status mapping au niveau du PROJET (JSON string)
    modules_metadata: str = Form(...),
    files: List[UploadFile] = File(None) 
):  
    modules_raw = json.loads(modules_metadata)
    status_map_data = json.loads(status_mapping)  # Mapping unique pour tout le projet
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
                
                if not modules_data.get(module_name):
                    modules_data[module_name] = {}   

                file_content = await file.read()

                # On utilise directement le status_mapping du PROJET pour les fichiers Jira
                modules_data[module_name][f"{extract_type}Entries"] = (
                    get_jira_data(file_content, status_map_data) 
                    if extract_type == "jira" else 
                    m.get(extract_type)(file_content)
                )

                destination = UPLOAD_DIR / project_id / module_name / file.filename 
                await save_upload_file(file, destination)

        # Enregistrement granulaire par module dans Redis
        for mod_id, data in modules_data.items():
            await r.set(f"projects:{project_id}:module:{mod_id}:data", json.dumps(data))

        # Récupération / Création des métadonnées du projet
        draft_raw = await r.get(f"projects:{project_id}:metadata")
        metadata = json.loads(draft_raw) if draft_raw else {"id": project_id, "name": name}
        
        metadata["status"] = "ACTIVE"
        metadata["statusMapping"] = status_map_data  # Stocké dans la clé metadata du projet
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


@router.put("/{project_id}", dependencies=[Depends(verify_valid_project)])
async def update_project(
    project_id: str,
    status_mapping: Optional[str] = Form(None),  # <- Transmis si mis à jour
    modules_metadata: str = Form(...),
    files: Optional[List[UploadFile]] = File(None)
):
    metadata_raw = await r.get(f"projects:{project_id}:metadata")
    metadata = json.loads(metadata_raw)
    modules_raw = json.loads(modules_metadata)
    
    # Utilise le nouveau mapping s'il est fourni, sinon garde l'existant dans le projet
    status_map_data = json.loads(status_mapping) if status_mapping else metadata.get("statusMapping", {})
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

                module_key = f"projects:{project_id}:module:{module_name}:data"
                existing_module_raw = await r.get(module_key)
                module_data = json.loads(existing_module_raw) if existing_module_raw else {}

                file_content = await file.read()
                module_data[f"{extract_type}Entries"] = (
                    get_jira_data(file_content, status_map_data)
                    if extract_type == "jira"
                    else m.get(extract_type)(file_content)
                )

                await r.set(module_key, json.dumps(module_data))

                await file.seek(0)
                destination = UPLOAD_DIR / slugify(project_name) / module_name / file.filename
                await save_upload_file(file, destination)

        metadata["statusMapping"] = status_map_data
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






@router.put("/{project_id}", dependencies=[Depends(verify_valid_project)])
async def update_project(
    project_id: str,
    status_mapping: str = Form(...),
    modules_metadata: str = Form(...),
    files: Optional[List[UploadFile]] = File(None)
):
    metadata_raw = await r.get(f"projects:{project_id}:metadata")
    if not metadata_raw:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Projet introuvable"
        )
        
    metadata = json.loads(metadata_raw)
    modules_raw = json.loads(modules_metadata)  # Ex: [{"id": "mod_123", "name": "Module A"}, ...]
    status_map_data = json.loads(status_mapping)

    project_name = metadata.get("name", project_id)
    project_dir = UPLOAD_DIR / slugify(project_name)

    try:
        # 1. ÉTAPE 1 : Sauvegarde des NOUVEAUX fichiers sur le disque s'il y en a
        if files:
            for file in files:
                if not file.filename or not file.filename.endswith(".xlsx"):
                    continue

                parts = file.filename.split("_")
                if len(parts) < 2:
                    continue
                
                # Ex: mod123_jira_2026.xlsx -> module_id = mod123
                module_id = parts[0]
                destination = project_dir / module_id / file.filename
                
                await file.seek(0)
                await save_upload_file(file, destination)

        # 2. ÉTAPE 2 : Recalcul global des données Redis pour TOUS les modules via leur ID
        for module_obj in modules_raw:
            module_id = module_obj["id"]
            
            module_dir = project_dir / module_id
            module_key = f"projects:{project_id}:module:{module_id}:data"
            
            # Réinitialisation à vide pour recalculer proprement sans résidus
            module_data = {}

            if module_dir.exists():
                for excel_file in module_dir.glob("*.xlsx"):
                    filename = excel_file.name
                    parts = filename.split("_")
                    if len(parts) < 2:
                        continue
                    
                    extract_type = parts[1]

                    with open(excel_file, "rb") as f:
                        file_content = f.read()

                    # Re-calcul avec le status_mapping à jour
                    if extract_type == "jira":
                        module_data["jiraEntries"] = get_jira_data(file_content, status_map_data)
                    elif extract_type in m:
                        module_data[f"{extract_type}Entries"] = m[extract_type](file_content)

            await r.set(module_key, json.dumps(module_data))

        # 3. ÉTAPE 3 : Mise à jour des métadonnées du projet
        metadata["statusMapping"] = status_map_data
        metadata["updatedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        metadata["modules"] = modules_raw

        await r.set(f"projects:{project_id}:metadata", json.dumps(metadata))

        return metadata

    except HTTPException:
        raise
    except Exception as e:
        print(f"Erreur update_project: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue lors de la modification ! Veuillez revoir les fichiers importés."
        )











@router.get("/{project_id}/{module_id}/overview/", dependencies=[Depends(verify_valid_project), Depends(verify_valid_module)])
async def get_overview(project_id: str, module_id: str):
    # 1. Récupération directe des données du module spécifique depuis Redis
    module_data = json.loads(await r.get(f"projects:{project_id}:module:{module_id}:data") or "{}")
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

    # ---------------------------------------------------------
    # CROISEMENT RM ✕ RESOURCES & CALCUL DU BUDGET / TEAMS
    # ---------------------------------------------------------
    resources = module_metadata.get("resources") or []
    
    # Mapping Nom -> TJM
    resource_tjm_map = {
        res.get("name"): float(res.get("tjm") or 0) 
        for res in resources if res.get("name")
    }

    incurred_budget = 0.0
    teams_summary = {}

    for entry in rm_entries:
        role = entry.get("Role") or "Inconnu"
        person_name = entry.get("Name") or entry.get("Resource") or entry.get("Nom")
        hours = float(entry.get("Incurred (hours)") or 0)

        tjm = resource_tjm_map.get(person_name, 0.0)
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

    # ---------------------------------------------------------
    # METRIQUES QA ET TIMELINE
    # ---------------------------------------------------------
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
