class ModuleItemSchema(BaseModel):
    name: str
    old_name: Optional[str] = None

class QuickUpdateProjectSchema(BaseModel):
    name: str
    modules: List[ModuleItemSchema]


@router.patch("/{project_slug}")
async def quick_update_project(project_slug: str, payload: QuickUpdateProjectSchema):
    # 1. Chargement des données existantes
    metadata_raw = redis_client.get(f"projects:{project_slug}:metadata")
    if not metadata_raw:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Projet introuvable"
        )

    metadata = json.loads(metadata_raw)
    existing_data_raw = redis_client.get(f"projects:{project_slug}:data")
    existing_data = json.loads(existing_data_raw) if existing_data_raw else {}

    new_name = payload.name
    new_slug = slugify(new_name)

    # 2. Renommage global du projet (Dossier + Clés Redis)
    if project_slug != new_slug:
        if redis_client.exists(f"projects:{new_slug}:metadata"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un projet avec ce nom existe déjà."
            )

        current_dir = UPLOAD_DIR / project_slug
        target_dir = UPLOAD_DIR / new_slug

        if current_dir.exists():
            current_dir.rename(target_dir)

        # Suppression des anciennes clés Redis du projet
        redis_client.delete(f"projects:{project_slug}:metadata")
        redis_client.delete(f"projects:{project_slug}:data")
        redis_client.lrem("projects:all", 0, project_slug)
        redis_client.rpush("projects:all", new_slug)
    else:
        target_dir = UPLOAD_DIR / project_slug

    # Map des métadonnées existantes des modules par leur ID actuel
    old_modules_dict = {m["id"]: m for m in metadata.get("modules", [])}

    migrated_old_ids = set()
    active_new_ids = set()
    updated_modules_list = []

    # 3. Traitement de chaque module
    for mod in payload.modules:
        new_mod_id = slugify(mod.name)
        old_mod_id = slugify(mod.old_name) if mod.old_name else new_mod_id

        active_new_ids.add(new_mod_id)

        # Renommage du module : Dossier + Redis Data
        if old_mod_id != new_mod_id and old_mod_id in old_modules_dict:
            migrated_old_ids.add(old_mod_id)

            old_mod_dir = target_dir / old_mod_id
            new_mod_dir = target_dir / new_mod_id
            if old_mod_dir.exists():
                old_mod_dir.rename(new_mod_dir)

            if old_mod_id in existing_data:
                existing_data[new_mod_id] = existing_data.pop(old_mod_id)

        # Création du dossier du module s'il est nouveau
        (target_dir / new_mod_id).mkdir(parents=True, exist_ok=True)

        # Backup & update du module : Clone complet des propriétés
        prev_id = old_mod_id if old_mod_id in old_modules_dict else new_mod_id
        module_backup = old_modules_dict.get(prev_id, {}).copy()

        module_backup["id"] = new_mod_id
        module_backup["name"] = mod.name

        updated_modules_list.append(module_backup)

    # 4. Suppression des modules retirés
    for old_mod_id in list(old_modules_dict.keys()):
        if old_mod_id not in active_new_ids and old_mod_id not in migrated_old_ids:
            mod_dir = target_dir / old_mod_id
            if mod_dir.exists():
                shutil.rmtree(mod_dir)

            existing_data.pop(old_mod_id, None)

    # 5. Sauvegarde finale avec MISE À JOUR DE L'ID ET DU NOM DANS METADATA
    metadata["id"] = new_slug      # <-- L'ID du projet dans la metadata reflète désormais le new_slug
    metadata["name"] = new_name    # Nouveau nom d'affichage
    metadata["modules"] = updated_modules_list

    # Sauvegarde sous la nouvelle clé Redis du projet
    redis_client.set(f"projects:{new_slug}:metadata", json.dumps(metadata))
    redis_client.set(f"projects:{new_slug}:data", json.dumps(existing_data))

    return {"status": "success", "slug": new_slug, "metadata": metadata}
















function EditProjectModal({ project, isOpen, onClose }) {
  const [name, setName] = useState(project.name)
  const [modules, setModules] = useState(project.modules || [])
  const router = useRouter()

  // Ajouter un module dans l'état local
  const handleAddModule = () => {
    const newId = `module_${Date.now()}`
    setModules([...modules, { id: newId, name: "Nouveau Module" }])
  }

  // Supprimer un module dans l'état local
  const handleRemoveModule = (id) => {
    setModules(modules.filter((m) => m.id !== id))
  }

  // Action 1 : Enregistrer (Fast Update via PATCH)
  const handleQuickSave = async () => {
    const res = await fetch(`/api/projects/${project.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, modules }),
    })
    if (res.ok) {
      onClose()
      // Rafraîchir la liste des projets sur l'accueil
    }
  }

  // Action 2 : Modifier plus (Redirection vers le Setup)
  const handleGoToSetup = async () => {
    // Facultatif : On peut sauvegarder d'abord les changements de structure
    await handleQuickSave()
    // Puis on redirige vers la page de setup avec edit-mode=true
    router.push(`/setup?edit-mode=true&slug=${project.slug}`)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2>Modifier le projet</h2>
      
      {/* Input Nom du Projet */}
      <input value={name} onChange={(e) => setName(e.target.value)} />

      {/* Liste des modules */}
      <div className="module-list">
        {modules.map((mod) => (
          <div key={mod.id} className="flex items-center gap-2">
            <span>{mod.name || mod.id}</span>
            <button onClick={() => handleRemoveModule(mod.id)}>🗑️</button>
          </div>
        ))}
        <button onClick={handleAddModule}>+ Ajouter un module</button>
      </div>

      {/* Boutons d'action sous la modal */}
      <div className="modal-actions">
        <button onClick={handleQuickSave}>Enregistrer</button>
        <button onClick={handleGoToSetup}>Modifier plus / Compléter le setup ➔</button>
      </div>
    </Modal>
  )
}
