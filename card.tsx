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
    status_mapping: str = Form(...),  # <- Obligatoire (Requis par Form)
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
    modules_raw = json.loads(modules_metadata)
    
    # Décodage direct du JSON
    try:
        status_map_data = json.loads(status_mapping)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le champ status_mapping doit être une chaîne JSON valide."
        )

    project_name = metadata.get("name", project_id)
    project_dir = UPLOAD_DIR / slugify(project_name)

    try:
        # 1. ÉTAPE 1 : Écriture des NOUVEAUX fichiers sur le disque s'il y en a
        if files:
            for file in files:
                if not file.filename:
                    continue

                if not file.filename.endswith(".xlsx"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Le fichier {file.filename} n'est pas au bon format (.xlsx attendu)"
                    )

                parts = file.filename.split("_")
                if len(parts) < 2:
                    continue
                
                module_name = parts[0]
                destination = project_dir / module_name / file.filename
                
                await file.seek(0)
                await save_upload_file(file, destination)

        # 2. ÉTAPE 2 : Recalcul global des données Redis pour TOUS les modules
        for module_name in modules_raw:
            module_dir = project_dir / module_name
            module_key = f"projects:{project_id}:module:{module_name}:data"
            
            existing_module_raw = await r.get(module_key)
            module_data = json.loads(existing_module_raw) if existing_module_raw else {}

            if module_dir.exists():
                for excel_file in module_dir.glob("*.xlsx"):
                    filename = excel_file.name
                    parts = filename.split("_")
                    if len(parts) < 2:
                        continue
                    
                    extract_type = parts[1]

                    with open(excel_file, "rb") as f:
                        file_content = f.read()

                    # Re-calcul systématique avec le status_mapping à jour
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
