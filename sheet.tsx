"use client"

import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { DatePicker } from "@/components/DatePicker"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import {
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
import axios from "axios"
import { useParams, useRouter } from "next/navigation"
import React, { useEffect, useMemo, useState } from "react"

import ImportSection from "../_components/ImportSection"
import RoleRateSection, { TeamsRateItem } from "../_components/RoleRateSection"
import StatusMappingSection from "../_components/StatusMappingSection"
import RecipeAndQualitySection, {
  QualityAndTestingData,
} from "../_components/RecipeAndQualitySection"

const DEFAULT_QA_DATA: QualityAndTestingData = {
  testRuns: [],
  metrics: {
    securityHotspots: "100",
    coverage: "0",
    duplicatedLines: "0",
    maintainabilityRating: "A",
    reliabilityRating: "A",
    securityRating: "A",
  },
}

export interface ModuleConfig {
  id: string
  name: string
  sp: string
  budget: string
  startDate: Date | undefined
  mvpEndDate: Date | undefined
  crEndDate: Date | undefined
  rmFile: File | null
  jiraFile: File | null
  leavesFile: File | null
  mappingItems: Record<string, string[]> | null
  teams: TeamsRateItem[]
  qa: QualityAndTestingData
}

interface ProjectInitData {
  id?: string
  name: string
  modules: { id: string; name: string }[]
}

export default function CreateProjectWizard() {
  const router = useRouter()

  const { projectId } = useParams()
  const [projectName, setProjectName] = useState<string>("")
  const [fetchingInit, setFetchingInit] = useState<boolean>(true)
  const [currentStep, setCurrentStep] = useState(1)

  const [modules, setModules] = useState<ModuleConfig[]>([])
  const [activeModuleId, setActiveModuleId] = useState<string>("")

  const [loading, setLoading] = useState(false)
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
      prev.map((mod) =>
        mod.id === activeModuleId ? { ...mod, ...fields } : mod,
      ),
    )
  }

  const activeModule =
    modules.find((m) => m.id === activeModuleId) || modules[0]

  const areModuleInfosValid = useMemo(() => {
    if (modules.length === 0) return false
    return modules.every(
      (m) => m.name.trim() !== "" && Number(m.sp) > 0 && Number(m.budget) > 0,
    )
  }, [modules])

  const areModulePlanningsValid = useMemo(() => {
    if (modules.length === 0) return false
    return modules.every(
      (m) =>
        Boolean(m.startDate && m.mvpEndDate && m.mvpEndDate > m.startDate) &&
        (m.crEndDate
          ? m.crEndDate > (m.startDate as Date) &&
            m.crEndDate > (m.mvpEndDate as Date)
          : true),
    )
  }, [modules])

  const areAllModulesImportValid = useMemo(() => {
    if (modules.length === 0) return false
    return modules.every((m) => Boolean(m.rmFile && m.jiraFile && m.leavesFile))
  }, [modules])

  const steps = useMemo(
    () => [
      {
        step: 1,
        label: "Infos Module",
        icon: RiInformationLine,
        valid: areModuleInfosValid,
      },
      {
        step: 2,
        label: "Planning",
        icon: RiCalendarEventLine,
        valid: areModulePlanningsValid,
      },
      {
        step: 3,
        label: "Import d'extract",
        icon: RiFileUploadLine,
        valid: areAllModulesImportValid,
      },
      {
        step: 4,
        label: "Rôles & Taux",
        icon: RiUserStarLine,
        valid: true,
      },
      {
        step: 5,
        label: "Mapping Tickets",
        icon: RiFileUploadLine,
        valid: true,
      },
      {
        step: 6,
        label: "Recette & Qualité",
        icon: RiShieldCheckLine,
        valid: true,
      },
    ],
    [areModuleInfosValid, areModulePlanningsValid, areAllModulesImportValid],
  )

  const handleNext = () => {
    if (currentStep < steps.length) setCurrentStep((prev) => prev + 1)
  }

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1)
  }

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
      setError("")
    } catch (err: any) {
      console.error(err)
      const apiError =
        err.response?.data?.detail || "Erreur lors de la création du projet."
      setError(apiError)
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
      updateActiveModule({
        teams: resp.data.teams,
      })
      setError("")
    } catch (err: any) {
      console.error(err)
      const apiError =
        err.response?.data?.detail || "Erreur lors de la création du projet."
      setError(apiError)
      updateActiveModule({ teams: [] })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      const resp = await axios.post(
        "http://localhost:8000/api/v1/projects/",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      )
      const projectMetadata = resp.data.projectMetadata || resp.data
      router.push(
        `/projects/${projectMetadata.id}/${projectMetadata.modules[0].id}/overview`,
      )
    } catch (err: any) {
      console.error(err.message)
      const apiError =
        err.response?.data?.detail || "Erreur lors de la création du projet."
      setError(apiError)
    } finally {
      setLoading(false)
    }
  }

  if (fetchingInit) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50 dark:bg-gray-950">
        <p className="text-sm text-gray-500">
          Chargement des modules et du projet...
        </p>
      </div>
    )
  }

  return (
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
              ? `Configuration : ${projectName}`
              : "Création de Projet"}
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          {steps.map((item) => {
            const isActive = currentStep === item.step
            const isDone = currentStep > item.step

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

          {activeModule && (
            <>
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      Informations :{" "}
                      <span className="text-[#048890]">
                        {activeModule.name || "Module"}
                      </span>
                    </h2>
                    <p className="text-xs text-gray-500">
                      Définissez ses métriques.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold">
                        Nom du module *
                      </Label>
                      <Input type="text" value={activeModule.name} disabled />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold">
                        Chiffrage (Story Points) *
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={activeModule.sp}
                        onChange={(e) =>
                          updateActiveModule({ sp: e.target.value })
                        }
                        placeholder="ex: 120"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold">
                        Budget alloué (€) *
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={activeModule.budget}
                        onChange={(e) =>
                          updateActiveModule({ budget: e.target.value })
                        }
                        placeholder="ex: 25000"
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      Planning :{" "}
                      <span className="text-[#048890]">
                        {activeModule.name}
                      </span>
                    </h2>
                    <p className="text-xs text-gray-500">
                      Définissez le calendrier spécifique à ce module.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold">
                        Début du module *
                      </Label>
                      <DatePicker
                        value={activeModule.startDate}
                        onChange={(d) => updateActiveModule({ startDate: d })}
                        className="w-full"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold text-amber-600">
                        Fin prévue (MVP) *
                      </Label>
                      <DatePicker
                        value={activeModule.mvpEndDate}
                        onChange={(d) => updateActiveModule({ mvpEndDate: d })}
                        className="w-full"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold text-emerald-600">
                        Fin estimée (CR)
                      </Label>
                      <DatePicker
                        value={activeModule.crEndDate}
                        onChange={(d) => updateActiveModule({ crEndDate: d })}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Fichiers & Extracts :{" "}
                    <span className="text-[#048890]">{activeModule.name}</span>
                  </h2>
                  <ImportSection
                    rmFile={activeModule.rmFile}
                    jiraFile={activeModule.jiraFile}
                    leavesFile={activeModule.leavesFile}
                    setRmFile={(file: File | null) => {
                      updateActiveModule({ rmFile: file })
                      fetchTeams(file)
                    }}
                    setJiraFile={(file: File | null) => {
                      updateActiveModule({ jiraFile: file })
                      if (file) fetchJiraStatus(file)
                    }}
                    setLeavesFile={(file: File) =>
                      updateActiveModule({ leavesFile: file })
                    }
                  />
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Rôles & Taux :{" "}
                    <span className="text-[#048890]">{activeModule.name}</span>
                  </h2>
                  <RoleRateSection
                    items={activeModule.teams}
                    onChange={(newRoles) =>
                      updateActiveModule({ teams: newRoles })
                    }
                  />
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Mapping Tickets :{" "}
                    <span className="text-[#048890]">{activeModule.name}</span>
                  </h2>
                  <StatusMappingSection
                    mapping={
                      activeModule.mappingItems as Record<string, string[]>
                    }
                    onChange={(newMapping) =>
                      updateActiveModule({ mappingItems: newMapping })
                    }
                  />
                </div>
              )}

              {currentStep === 6 && (
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Indicateurs de Recette & Qualité :{" "}
                    <span className="text-[#048890]">{activeModule.name}</span>
                  </h2>
                  <RecipeAndQualitySection
                    data={activeModule.qa || DEFAULT_QA_DATA}
                    onChange={(newQa) => updateActiveModule({ qa: newQa })}
                  />
                </div>
              )}
            </>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
            {currentStep > 1 ? (
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
              disabled={!steps[currentStep - 1]?.valid}
              onClick={currentStep < steps.length ? handleNext : handleSubmit}
            >
              {currentStep < steps.length
                ? "Suivant"
                : loading
                  ? "Création en cours..."
                  : "Créer le projet"}
              <RiArrowRightLine className="ml-1.5 size-4" />
            </Button>
          </div>
        </Card>
      </main>
    </div>
  )
}
