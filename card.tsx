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








"use client"

import React, { useState, useEffect } from "react"
import axios from "axios"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog"
import { Input } from "../Input"
import { Label } from "../Label"

interface ModuleState {
  name: string
  old_name?: string | null
}

interface ProjectData {
  id: string
  name: string
  modules?: { name: string }[]
}

interface EditModalProps {
  project: ProjectData | null
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export const EditProjectModal = ({
  project,
  isOpen,
  onClose,
  onConfirm,
}: EditModalProps) => {
  const [projectName, setProjectName] = useState("")
  const [modules, setModules] = useState<ModuleState[]>([])
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Synchro à l'ouverture de la modal
  useEffect(() => {
    if (project && isOpen) {
      setProjectName(project.name || "")
      
      const initialModules = (project.modules || []).map((m) => ({
        name: m.name,
        old_name: m.name,
      }))
      
      setModules(initialModules)
      setError(null)
    }
  }, [project, isOpen])

  const isValid = Boolean(
    projectName.trim() &&
      modules.length > 0 &&
      modules.every((m) => m.name.trim() !== "")
  )

  const handleAddModule = () => {
    setModules((prev) => [
      ...prev,
      {
        name: `Module ${prev.length + 1}`,
        old_name: null,
      },
    ])
  }

  const handleRemoveModule = (indexToRemove: number) => {
    setModules((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleModuleNameChange = (index: number, newName: string) => {
    setModules((prev) =>
      prev.map((m, idx) => (idx === index ? { ...m, name: newName } : m))
    )
  }

  const buildPayload = () => {
    return {
      name: projectName.trim(),
      modules: modules.map((m) => ({
        name: m.name.trim(),
        old_name: m.old_name || null,
      })),
    }
  }

  const handleQuickSave = async () => {
    if (!isValid || !project) return null

    setLoading(true)
    setError(null)

    try {
      const resp = await axios.patch(
        `http://localhost:8000/api/v1/projects/${project.id}`,
        buildPayload()
      )
      
      onConfirm()
      onClose()
      return resp.data
    } catch (err: any) {
      console.error(err)
      const apiError =
        err.response?.data?.detail || "Erreur lors de la mise à jour du projet."
      setError(apiError)
      return null
    } finally {
      setLoading(false)
    }
  }

  const handleGoToSetup = async () => {
    const updatedData = await handleQuickSave()
    if (updatedData) {
      const updatedSlug = updatedData.slug || project?.id
      router.push(`/projects/${updatedSlug}/setup?edit-mode=true`)
    }
  }

  return (
    <div className="flex justify-center">
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier le projet</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-6">
              Mettez à jour le nom du projet et gérez ses modules.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="mt-4 space-y-6">
            {/* Nom du Projet */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-semibold text-gray-700">
                Nom du projet *
              </Label>
              <Input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="ex: Batica E-Commerce"
                required
              />
            </div>

            {/* Liste des Modules */}
            <div className="space-y-4 rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Modules du projet ({modules.length})
                </Label>
                <Button
                  type="button"
                  onClick={handleAddModule}
                  variant="secondary"
                  className="h-8 gap-1.5 text-xs text-[#048890] hover:bg-[#048890]/10"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter un module
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-1">
                {modules.map((mod, index) => (
                  <div key={`mod-${index}`} className="flex items-center gap-2">
                    <div className="flex-1 flex flex-col gap-1">
                      <Label className="text-xs font-medium text-gray-600">
                        Module {index + 1} *
                      </Label>
                      <Input
                        type="text"
                        value={mod.name}
                        onChange={(e) =>
                          handleModuleNameChange(index, e.target.value)
                        }
                        placeholder="Nom du module"
                        required
                      />
                    </div>
                    {modules.length > 1 && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleRemoveModule(index)}
                        className="mt-5 h-10 w-10 p-0 text-gray-400 hover:text-rose-600"
                        title="Supprimer le module"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-gray-100 pt-4 gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                className="w-full sm:w-fit"
              >
                Annuler
              </Button>
            </DialogClose>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                type="button"
                onClick={handleQuickSave}
                disabled={!isValid || loading}
                variant="secondary"
                className="w-full sm:w-fit"
              >
                {loading ? "Enregistrement..." : "Enregistrer"}
              </Button>

              <Button
                type="button"
                onClick={handleGoToSetup}
                disabled={!isValid || loading}
                className="w-full bg-[#048890] hover:bg-[#036c73] disabled:bg-[#048890]/30 sm:w-fit"
              >
                Modifier plus / Setup ➔
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
















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
