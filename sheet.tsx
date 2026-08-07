"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import axios from "axios"
import { Card } from "@/components/Card"
import {
  RiArrowLeftLine,
  RiCalendarEventLine,
  RiCheckLine,
  RiFileUploadLine,
  RiInformationLine,
  RiShieldCheckLine,
  RiStackLine,
  RiUserStarLine,
} from "@remixicon/react"
import { DEFAULT_QA_DATA, ModuleConfig } from "./types"

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
}

const SetupContext = createContext<SetupContextType | null>(null)

export const useSetup = () => {
  const ctx = useContext(SetupContext)
  if (!ctx) throw new Error("useSetup doit être utilisé à l'intérieur de SetupLayout")
  return ctx
}

interface ProjectInitData {
  id?: string
  name: string
  modules: { id: string; name: string }[]
}

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { projectId } = useParams()

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
          `http://localhost:8000/api/v1/projects/${projectId}/`,
        )
        const data = resp.data
        setProjectName(data.name)

        if (data.modules && data.modules.length > 0) {
          const mappedModules: ModuleConfig[] = data.modules.map((m) => ({
            id: m.id,
            name: m.name,
            sp: "",
            budget: "",
            startDate: undefined,
            mvpEndDate: undefined,
            crEndDate: undefined,
            rmFile: null,
            jiraFile: null,
            leavesFile: null,
            mappingItems: null,
            teams: [],
            qa: DEFAULT_QA_DATA,
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

    fetchProjectInit()
  }, [projectId])

  const updateActiveModule = (fields: Partial<ModuleConfig>) => {
    setModules((prev) =>
      prev.map((mod) => (mod.id === activeModuleId ? { ...mod, ...fields } : mod)),
    )
  }

  const activeModule = useMemo(
    () => modules.find((m) => m.id === activeModuleId) || modules[0],
    [modules, activeModuleId],
  )

  // Validations par étape
  const areModuleInfosValid = useMemo(
    () => modules.length > 0 && modules.every((m) => m.name.trim() !== "" && Number(m.sp) > 0 && Number(m.budget) > 0),
    [modules],
  )

  const areModulePlanningsValid = useMemo(
    () =>
      modules.length > 0 &&
      modules.every(
        (m) =>
          Boolean(m.startDate && m.mvpEndDate && m.mvpEndDate > m.startDate) &&
          (m.crEndDate ? m.crEndDate > (m.startDate as Date) && m.crEndDate > (m.mvpEndDate as Date) : true),
      ),
    [modules],
  )

  const areAllModulesImportValid = useMemo(
    () => modules.length > 0 && modules.every((m) => Boolean(m.rmFile && m.jiraFile && m.leavesFile)),
    [modules],
  )

  const steps = useMemo(
    () => [
      { step: 1, path: "step-1", label: "Infos Module", icon: RiInformationLine, valid: areModuleInfosValid },
      { step: 2, path: "step-2", label: "Planning", icon: RiCalendarEventLine, valid: areModulePlanningsValid },
      { step: 3, path: "step-3", label: "Import d'extract", icon: RiFileUploadLine, valid: areAllModulesImportValid },
      { step: 4, path: "step-4", label: "Rôles & Taux", icon: RiUserStarLine, valid: true },
      { step: 5, path: "step-5", label: "Mapping Tickets", icon: RiFileUploadLine, valid: true },
      { step: 6, path: "step-6", label: "Recette & Qualité", icon: RiShieldCheckLine, valid: true },
    ],
    [areModuleInfosValid, areModulePlanningsValid, areAllModulesImportValid],
  )

  const currentStepIndex = useMemo(() => {
    const matched = steps.findIndex((s) => pathname.includes(s.path))
    return matched !== -1 ? matched : 0
  }, [pathname, steps])

  const fetchJiraStatus = async (file: File) => {
    const formData = new FormData()
    formData.append("jira_file", file)
    try {
      const resp = await axios.post("http://localhost:8000/api/v1/projects/get-jira-status", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      updateActiveModule({ mappingItems: { "En écriture": resp.data.jiraStatus } })
      setError(null)
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.detail || "Erreur lors de la récupération des statuts Jira.")
      updateActiveModule({ mappingItems: null })
    }
  }

  const fetchTeams = async (file: File | null) => {
    if (!file) return
    const formData = new FormData()
    formData.append("rm_file", file)
    try {
      const resp = await axios.post("http://localhost:8000/api/v1/projects/get-teams", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      updateActiveModule({ teams: resp.data.teams })
      setError(null)
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.detail || "Erreur lors de la récupération des équipes RM.")
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
      mvpEndDate: m.mvpEndDate ? m.mvpEndDate.toISOString().split("T")[0] : null,
      crEndDate: m.crEndDate ? m.crEndDate.toISOString().split("T")[0] : null,
      statusMapping: m.mappingItems,
      teams: m.teams,
      qa: m.qa,
    }))

    formData.append("modules_metadata", JSON.stringify(modulesPayload))

    modules.forEach((mod) => {
      if (mod.rmFile)
        formData.append("files", mod.rmFile, `${mod.id}_rm_file.${mod.rmFile.name.split(".").pop()}`)
      if (mod.jiraFile)
        formData.append("files", mod.jiraFile, `${mod.id}_jira_file.${mod.jiraFile.name.split(".").pop()}`)
      if (mod.leavesFile)
        formData.append("files", mod.leavesFile, `${mod.id}_leaves_file.${mod.leavesFile.name.split(".").pop()}`)
    })

    try {
      const resp = await axios.post("http://localhost:8000/api/v1/projects/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      const projectMetadata = resp.data.projectMetadata || resp.data
      router.push(`/projects/${projectMetadata.id}/${projectMetadata.modules[0].id}/overview`)
    } catch (err: any) {
      console.error(err.message)
      setError(err.response?.data?.detail || "Erreur lors de la création du projet.")
    } finally {
      setLoading(false)
    }
  }

  if (fetchingInit) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50 dark:bg-gray-950">
        <p className="text-sm text-gray-500">Chargement des modules et du projet...</p>
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
              {projectName ? `Configuration : ${projectName}` : "Création de Projet"}
            </h1>
            <div className="w-16" />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">
          {/* Stepper Navigation */}
          <div className="mb-8 flex items-center justify-between">
            {steps.map((item, idx) => {
              const isActive = currentStepIndex === idx
              const isDone = currentStepIndex > idx

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
                      isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-400"
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
            {/* Module Tabs Selector */}
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
          </Card>
        </main>
      </div>
    </SetupContext.Provider>
  )
}
