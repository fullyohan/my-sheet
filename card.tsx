import json
import shutil
from typing import Optional, List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from slugify import slugify

# --- SCHÉMAS PYDANTIC ---
class ModuleItemSchema(BaseModel):
    id: str
    old_id: Optional[str] = None  # Transmis par le front si l'ID/slug du module change
    name: Optional[str] = None

class QuickUpdateProjectSchema(BaseModel):
    name: str
    modules: List[ModuleItemSchema]


# --- ENDPOINT ---
@router.patch("/{project_slug}")
async def quick_update_project(project_slug: str, payload: QuickUpdateProjectSchema):
    # 1. Vérification de l'existence du projet
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

    # 2. Renommage du projet (dossier + clés Redis)
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

        redis_client.delete(f"projects:{project_slug}:metadata")
        redis_client.delete(f"projects:{project_slug}:data")
        redis_client.lrem("projects:all", 0, project_slug)
        redis_client.rpush("projects:all", new_slug)
    else:
        target_dir = UPLOAD_DIR / project_slug

    # 3. Traitement des modules (Ajout, Renommage, Migration)
    old_modules_dict = {m["id"]: m for m in metadata.get("modules", [])}
    renamed_modules_map = {}

    for mod in payload.modules:
        # A. Si l'ID du module a changé (renommage)
        if mod.old_id and mod.old_id != mod.id and mod.old_id in old_modules_dict:
            renamed_modules_map[mod.old_id] = mod.id

            # Migration du dossier du module
            old_mod_dir = target_dir / mod.old_id
            new_mod_dir = target_dir / mod.id
            if old_mod_dir.exists():
                old_mod_dir.rename(new_mod_dir)

            # Migration des données Redis du module
            if mod.old_id in existing_data:
                existing_data[mod.id] = existing_data.pop(mod.old_id)

    # 4. Suppression des modules retirés
    active_ids = {mod.id for mod in payload.modules}
    migrated_old_ids = set(renamed_modules_map.keys())

    for old_mod_id in list(old_modules_dict.keys()):
        if old_mod_id not in active_ids and old_mod_id not in migrated_old_ids:
            # Suppression du dossier physique
            mod_dir = target_dir / old_mod_id
            if mod_dir.exists():
                shutil.rmtree(mod_dir)

            # Suppression des données dans Redis
            existing_data.pop(old_mod_id, None)

    # 5. Création/Saisie des dossiers et de la nouvelle liste de modules
    updated_modules_list = []
    for mod in payload.modules:
        mod_dir = target_dir / mod.id
        mod_dir.mkdir(parents=True, exist_ok=True)  # Crée le dossier s'il est nouveau

        updated_modules_list.append({
            "id": mod.id,
            "name": mod.name or mod.id,
        })

    # 6. Sauvegarde finale
    metadata["name"] = new_name
    metadata["modules"] = updated_modules_list

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
