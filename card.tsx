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
















"use client"

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import axios from "axios"
import { Card } from "@/components/Card"
import {
  RemixiconComponentType,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCalendarEventLine,
  RiCheckLine,
  RiFileUploadLine,
  RiInformationLine,
  RiShieldCheckLine,
  RiStackLine,
  RiUserStarLine,
} from "@remixicon/react"
import { ModuleConfig } from "./types"
import { Button } from "@/components/Button"

interface SetupContextType {
  projectName: string
  modules: ModuleConfig[]
  activeModuleId: string
  activeModule: ModuleConfig | undefined
  setActiveModuleId: (id: string) => void
  updateActiveModule: (fields: Partial<ModuleConfig>) => void
  submitProject: () => Promise<void>
  loading: boolean
  error: string | null
  setError: (err: string | null) => void
  fetchJiraStatus: (file: File) => Promise<void>
  fetchTeams: (file: File | null) => Promise<void>
  currentStepIndex: number
  isEditMode: boolean
  steps: {
    step: number
    path: string
    label: string
    icon: RemixiconComponentType
    valid: boolean
  }[]
}

const SetupContext = createContext<SetupContextType | null>(null)

export const useSetup = () => {
  const ctx = useContext(SetupContext)
  if (!ctx)
    throw new Error("useSetup doit être utilisé à l'intérieur de SetupLayout")
  return ctx
}

interface ProjectInitData {
  id?: string
  name: string
  modules: {
    id: string
    name: string
    totalSp?: number
    allocatedBudget?: number
    startDate?: string | null
    mvpEndDate?: string | null
    crEndDate?: string | null
    statusMapping?: Record<string, any> | null
    teams?: any[]
    qa?: any
  }[]
}

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { projectId } = useParams()

  const isEditMode = searchParams.get("edit-mode") === "true"

  const [projectName, setProjectName] = useState<string>("")
  const [fetchingInit, setFetchingInit] = useState<boolean>(true)
  const [modules, setModules] = useState<ModuleConfig[]>([])
  const [activeModuleId, setActiveModuleId] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProjectInit = async () => {
      setFetchingInit(true)
      setError(null)
      try {
        const resp = await axios.get<ProjectInitData>(
          `http://localhost:8000/api/v1/projects/${projectId}/`
        )
        const data = resp.data
        setProjectName(data.name)

        if (data.modules && data.modules.length > 0) {
          const mappedModules: ModuleConfig[] = data.modules.map((m) => ({
            id: m.id,
            name: m.name,
            sp: m.totalSp !== undefined ? String(m.totalSp) : "",
            budget: m.allocatedBudget !== undefined ? String(m.allocatedBudget) : "",
            startDate: m.startDate ? new Date(m.startDate) : undefined,
            mvpEndDate: m.mvpEndDate ? new Date(m.mvpEndDate) : undefined,
            crEndDate: m.crEndDate ? new Date(m.crEndDate) : undefined,
            rmFile: null,
            jiraFile: null,
            leavesFile: null,
            mappingItems: m.statusMapping || null,
            teams: m.teams || [],
            qa: m.qa || null,
          }))

          setModules(mappedModules)
          setActiveModuleId(mappedModules[0].id)
        }
      } catch (err: any) {
        console.error(err)
        setError("Erreur lors de la récupération des modules et du projet.")
      } finally {
        setFetchingInit(false)
      }
    }

    if (projectId) {
      fetchProjectInit()
    }
  }, [projectId])

  const updateActiveModule = (fields: Partial<ModuleConfig>) => {
    setModules((prev) =>
      prev.map((mod) =>
        mod.id === activeModuleId ? { ...mod, ...fields } : mod,
      ),
    )
  }

  const activeModule = useMemo(
    () => modules.find((m) => m.id === activeModuleId) || modules[0],
    [modules, activeModuleId],
  )

  const areModuleInfosValid = useMemo(
    () =>
      modules.length > 0 &&
      modules.every(
        (m) => m.name.trim() !== "" && Number(m.sp) > 0 && Number(m.budget) > 0,
      ),
    [modules],
  )

  const areModulePlanningsValid = useMemo(
    () =>
      modules.length > 0 &&
      modules.every(
        (m) =>
          Boolean(m.startDate && m.mvpEndDate && m.mvpEndDate > m.startDate) &&
          (m.crEndDate
            ? m.crEndDate > (m.startDate as Date) &&
              m.crEndDate > (m.mvpEndDate as Date)
            : true),
      ),
    [modules],
  )

  const areAllModulesImportValid = useMemo(
    () =>
      modules.length > 0 &&
      modules.every((m) =>
        isEditMode
          ? true // En mode édition, les fichiers peuvent déjà exister côté backend
          : Boolean(m.rmFile && m.jiraFile && m.leavesFile)
      ),
    [modules, isEditMode],
  )

  const steps = useMemo(
    () => [
      {
        step: 1,
        path: "step-1",
        label: "Infos Module",
        icon: RiInformationLine,
        valid: areModuleInfosValid,
      },
      {
        step: 2,
        path: "step-2",
        label: "Planning",
        icon: RiCalendarEventLine,
        valid: areModulePlanningsValid,
      },
      {
        step: 3,
        path: "step-3",
        label: "Import d'extract",
        icon: RiFileUploadLine,
        valid: areAllModulesImportValid,
      },
      {
        step: 4,
        path: "step-4",
        label: "Rôles & Taux",
        icon: RiUserStarLine,
        valid: true,
      },
      {
        step: 5,
        path: "step-5",
        label: "Mapping Tickets",
        icon: RiFileUploadLine,
        valid: true,
      },
      {
        step: 6,
        path: "step-6",
        label: "Recette & Qualité",
        icon: RiShieldCheckLine,
        valid: areModuleInfosValid && areModulePlanningsValid && areAllModulesImportValid,
      },
    ],
    [areModuleInfosValid, areModulePlanningsValid, areAllModulesImportValid],
  )

  const currentStepIndex = useMemo(() => {
    const matched = steps.findIndex((s) => pathname.includes(s.path))
    return matched !== -1 ? matched + 1 : 1
  }, [pathname, steps])

  const fetchJiraStatus = async (file: File) => {
    const formData = new FormData()
    formData.append("jira_file", file)
    try {
      const resp = await axios.post(
        "http://localhost:8000/api/v1/projects/get-jira-status",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      )
      updateActiveModule({
        mappingItems: { "En écriture": resp.data.jiraStatus },
      })
      setError(null)
    } catch (err: any) {
      console.error(err)
      setError(
        err.response?.data?.detail ||
          "Erreur lors de la récupération des statuts Jira.",
      )
      updateActiveModule({ mappingItems: null })
    }
  }

  const fetchTeams = async (file: File | null) => {
    if (!file) return
    const formData = new FormData()
    formData.append("rm_file", file)
    try {
      const resp = await axios.post(
        "http://localhost:8000/api/v1/projects/get-teams",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      )
      updateActiveModule({ teams: resp.data.teams })
      setError(null)
    } catch (err: any) {
      console.error(err)
      setError(
        err.response?.data?.detail ||
          "Erreur lors de la récupération des équipes RM.",
      )
      updateActiveModule({ teams: [] })
    }
  }

  const submitProject = async () => {
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append("name", projectName)

    const modulesPayload = modules.map((m) => ({
      id: m.id,
      name: m.name,
      totalSp: Number(m.sp),
      allocatedBudget: Number(m.budget),
      startDate: m.startDate ? m.startDate.toISOString().split("T")[0] : null,
      mvpEndDate: m.mvpEndDate
        ? m.mvpEndDate.toISOString().split("T")[0]
        : null,
      crEndDate: m.crEndDate ? m.crEndDate.toISOString().split("T")[0] : null,
      statusMapping: m.mappingItems,
      teams: m.teams,
      qa: m.qa,
    }))

    formData.append("modules_metadata", JSON.stringify(modulesPayload))

    modules.forEach((mod) => {
      if (mod.rmFile)
        formData.append(
          "files",
          mod.rmFile,
          `${mod.id}_rm_file.${mod.rmFile.name.split(".").pop()}`,
        )
      if (mod.jiraFile)
        formData.append(
          "files",
          mod.jiraFile,
          `${mod.id}_jira_file.${mod.jiraFile.name.split(".").pop()}`,
        )
      if (mod.leavesFile)
        formData.append(
          "files",
          mod.leavesFile,
          `${mod.id}_leaves_file.${mod.leavesFile.name.split(".").pop()}`,
        )
    })

    try {
      const endpoint = isEditMode
        ? `http://localhost:8000/api/v1/projects/${projectId}`
        : "http://localhost:8000/api/v1/projects/"

      const method = isEditMode ? "put" : "post"

      const resp = await axios[method](endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      const projectMetadata = resp.data.projectMetadata || resp.data
      const targetSlug = projectMetadata.id || projectId
      const targetModuleId = projectMetadata.modules?.[0]?.id || modules[0]?.id

      router.push(`/projects/${targetSlug}/${targetModuleId}/overview`)
    } catch (err: any) {
      console.error(err.message)
      setError(
        err.response?.data?.detail ||
          `Erreur lors de la ${isEditMode ? "modification" : "création"} du projet.`,
      )
    } finally {
      setLoading(false)
    }
  }

  if (fetchingInit) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50 dark:bg-gray-950">
        <p className="text-sm text-gray-500">
          Chargement des données du projet...
        </p>
      </div>
    )
  }

  return (
    <SetupContext.Provider
      value={{
        projectName,
        modules,
        activeModuleId,
        activeModule,
        setActiveModuleId,
        updateActiveModule,
        submitProject,
        loading,
        error,
        setError,
        fetchJiraStatus,
        fetchTeams,
        currentStepIndex,
        isEditMode,
        steps,
      }}
    >
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
          <div className="mx-auto flex items-center justify-between px-4 py-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              <RiArrowLeftLine className="size-4" /> Annuler
            </button>
            <h1 className="text-md font-bold text-gray-900 dark:text-gray-100">
              {projectName
                ? `${isEditMode ? "Édition" : "Configuration"} : ${projectName}`
                : "Création de Projet"}
            </h1>
            <div className="w-16" />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-8 flex items-center justify-between">
            {steps.map((item, idx) => {
              const isActive = currentStepIndex - 1 === idx
              const isDone = currentStepIndex - 1 > idx

              return (
                <div key={item.step} className="flex items-center gap-2">
                  <div
                    className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isActive
                          ? "bg-[#048890] text-white ring-4 ring-[#048890]/20"
                          : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {isDone ? <RiCheckLine className="size-4" /> : item.step}
                  </div>
                  <span
                    className={`hidden text-xs font-semibold sm:inline ${
                      isActive
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-400"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              )
            })}
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
              {error}
            </div>
          )}

          <Card className="p-6">
            {modules.length > 1 && (
              <div className="mb-6 border-b border-gray-200 dark:border-gray-800">
                <nav className="-mb-px flex space-x-4 overflow-x-auto">
                  {modules.map((mod) => {
                    const isActive = mod.id === activeModuleId
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => setActiveModuleId(mod.id)}
                        className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                          isActive
                            ? "border-[#048890] text-[#048890]"
                            : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                        }`}
                      >
                        <RiStackLine className="size-4" />
                        {mod.name.trim() || `Module ${mod.id}`}
                      </button>
                    )
                  })}
                </nav>
              </div>
            )}

            {children}
            <SetupFooter />
          </Card>
        </main>
      </div>
    </SetupContext.Provider>
  )
}

const SetupFooter = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loading, currentStepIndex, steps, submitProject, isEditMode } = useSetup()
  const { projectId } = useParams()

  const editQuery = isEditMode ? "?edit-mode=true" : ""

  const handleNext = () => {
    router.push(`/projects/${projectId}/setup/step-${currentStepIndex + 1}${editQuery}`)
  }
  const handlePrev = () => {
    router.push(`/projects/${projectId}/setup/step-${currentStepIndex - 1}${editQuery}`)
  }

  return (
    <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
      {currentStepIndex > 1 ? (
        <Button
          type="button"
          variant="secondary"
          onClick={handlePrev}
          disabled={loading}
        >
          <RiArrowLeftLine className="ml-1.5 size-4" /> Précédent
        </Button>
      ) : (
        <div />
      )}

      <Button
        type="button"
        className="bg-[#048890] hover:bg-[#036c73] disabled:bg-[#048890]/30"
        disabled={!steps[currentStepIndex - 1]?.valid}
        onClick={currentStepIndex < steps.length ? handleNext : submitProject}
      >
        {currentStepIndex < steps.length
          ? "Suivant"
          : loading
            ? isEditMode
              ? "Sauvegarde en cours..."
              : "Création en cours..."
            : isEditMode
              ? "Sauvegarder les modifications"
              : "Créer le projet"}
        <RiArrowRightLine className="ml-1.5 size-4" />
      </Button>
    </div>
  )
}


























@router.put("/{project_id}")
async def update_project(
    project_id: str,
    modules_metadata: str = Form(...),
    files: Optional[List[UploadFile]] = File(None)
):
    # 1. Vérification de l'existence du projet dans Redis
    metadata_raw = redis_client.get(f"projects:{project_id}:metadata")
    if not metadata_raw:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Le projet '{project_id}' n'existe pas."
        )

    metadata = json.loads(metadata_raw)
    modules_raw = json.loads(modules_metadata)

    # Nom du projet récupéré directement des métadonnées existantes
    project_name = metadata.get("name", project_id)

    # 2. Récupération des données existantes des modules
    existing_data_raw = redis_client.get(f"projects:{project_id}:data")
    modules_data = json.loads(existing_data_raw) if existing_data_raw else {}

    try:
        # 3. Traitement des nouveaux fichiers s'il y en a
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

                if module_name not in modules_data:
                    modules_data[module_name] = {}

                file_content = await file.read()

                modules_data[module_name][f"{extract_type}Entries"] = (
                    get_jira_data(file_content, active_module_status_map)
                    if extract_type == "jira"
                    else m.get(extract_type)(file_content)
                )

                # Replacer le pointeur du fichier avant écriture disque
                await file.seek(0)

                destination = UPLOAD_DIR / slugify(project_name) / module_name / file.filename
                await save_upload_file(file, destination)

        # 4. Mise à jour des métadonnées (modules et date uniquement)
        metadata["updatedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        metadata["modules"] = modules_raw

        # 5. Persistance Redis
        redis_client.set(f"projects:{project_id}:metadata", json.dumps(metadata))
        redis_client.set(f"projects:{project_id}:data", json.dumps(modules_data))

        with open('data.json', 'w', encoding='utf-8') as f:
            json.dump(modules_data, f, ensure_ascii=False, indent=2)

        return metadata

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Une erreur est survenue lors de la modification ! Veuillez revoir les fichiers importés."
        )
