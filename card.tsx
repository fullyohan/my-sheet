"use client"

import React, { useState } from "react"
import axios from "axios"
import { useRouter } from "next/navigation"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { DropZone } from "@/components/DropZone"
import { DatePicker } from "@/components/DatePicker"
import { Card } from "@/components/Card"
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCheckLine,
  RiInformationLine,
  RiCalendarEventLine,
  RiFileUploadLine,
} from "@remixicon/react"

export default function CreateProjectWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)

  // Données du formulaire
  const [projectName, setProjectName] = useState("")
  const [totalProjectSp, setTotalProjectSp] = useState<string>("")

  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [mvpEndDate, setMvpEndDate] = useState<Date | undefined>(undefined)
  const [crEndDate, setCrEndDate] = useState<Date | undefined>(undefined)

  const [rmFile, setRmFile] = useState<File | null>(null)
  const [jiraFile, setJiraFile] = useState<File | null>(null)
  const [leavesFile, setLeavesFile] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Conditions de validation par étape
  const isStep1Valid = projectName.trim() !== "" && Number(totalProjectSp) > 0
  const isStep2Valid =
    Boolean(startDate && mvpEndDate && mvpEndDate > startDate) &&
    (crEndDate ? crEndDate > startDate && crEndDate > mvpEndDate : true)
  const isStep3Valid = Boolean(rmFile && jiraFile && leavesFile)

  const handleNext = () => {
    if (currentStep === 1 && isStep1Valid) setCurrentStep(2)
    else if (currentStep === 2 && isStep2Valid) setCurrentStep(3)
  }

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isStep1Valid || !isStep2Valid || !isStep3Valid) return

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append("name", projectName)
    formData.append("total_project_sp", totalProjectSp)
    formData.append("capacity_file", rmFile as File)
    formData.append("jira_file", jiraFile as File)
    formData.append("leaves_file", leavesFile as File)

    formData.append("start_date", (startDate as Date).toISOString().split("T")[0])
    formData.append("mvp_end_date", (mvpEndDate as Date).toISOString().split("T")[0])
    if (crEndDate) {
      formData.append("cr_end_date", crEndDate.toISOString().split("T")[0])
    }

    try {
      const resp = await axios.post("http://localhost:8000/api/v1/projects/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      const projectMetadata = resp.data.projectMetadata
      router.push(`/projects/${projectMetadata.id}/${projectMetadata.modules[0].id}/overview`)
    } catch (err: any) {
      console.error(err.message)
      const apiError = err.response?.data?.detail || "Erreur lors de la création du projet."
      setError(apiError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
      {/* 1. Header Fait pour le Tunnel de Création */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <RiArrowLeftLine className="size-4" /> Annuler
          </button>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Création de Projet
          </span>
          <div className="w-16" /> {/* Spacer pour équilibrer le header */}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* 2. Stepper Visuel */}
        <div className="mb-8 flex items-center justify-between">
          {[
            { step: 1, label: "Informations", icon: RiInformationLine },
            { step: 2, label: "Planning", icon: RiCalendarEventLine },
            { step: 3, label: "Fichiers Jira", icon: RiFileUploadLine },
          ].map((item) => {
            const Icon = item.icon
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
                    isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-400"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="mb-6 rounded-lg bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* 3. Contenu de l'Étape courante */}
        <Card className="p-6">
          {/* ÉTAPE 1 : INFOS DE BASE */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Généralités du projet
                </h2>
                <p className="text-xs text-gray-500">Nommez votre projet et définissez son périmètre SP.</p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Nom du projet *</Label>
                  <Input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="ex: Batica"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Macro-chiffrage (Story Points) *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={totalProjectSp}
                    onChange={(e) => setTotalProjectSp(e.target.value)}
                    placeholder="ex: 250"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 : DATES & PLANNING */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Planning prévisionnel
                </h2>
                <p className="text-xs text-gray-500">Définissez les dates clés du projet.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Début du projet *</Label>
                  <DatePicker value={startDate} onChange={setStartDate} className="w-full" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-amber-600">Fin prévue (MVP) *</Label>
                  <DatePicker value={mvpEndDate} onChange={setMvpEndDate} className="w-full" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-emerald-600">Fin estimée (CR)</Label>
                  <DatePicker value={crEndDate} onChange={setCrEndDate} className="w-full" />
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 : IMPORT FICHIERS */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Fichiers d'extraction
                </h2>
                <p className="text-xs text-gray-500">Déposez vos exports pour alimenter le dashboard.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
                <DropZone title="Export RM" description="Fichier RM" acceptText="CSV, XLSX" file={rmFile} onFileSelect={setRmFile} />
                <DropZone title="Export Jira" description="Fichier Jira" acceptText="CSV, XLSX" file={jiraFile} onFileSelect={setJiraFile} />
                <DropZone title="Fiche Congés" description="Export Congés" acceptText="CSV, XLSX" file={leavesFile} onFileSelect={setLeavesFile} />
              </div>
            </div>
          )}

          {/* 4. Barre de Navigation entre Étapes */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
            {currentStep > 1 ? (
              <Button type="button" variant="secondary" onClick={handlePrev} disabled={loading}>
                Précédent
              </Button>
            ) : <div />}

            {currentStep < 3 ? (
              <Button
                type="button"
                className="bg-[#048890] hover:bg-[#036c73]"
                disabled={currentStep === 1 ? !isStep1Valid : !isStep2Valid}
                onClick={handleNext}
              >
                Suivant <RiArrowRightLine className="ml-1.5 size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                className="bg-[#048890] hover:bg-[#036c73] disabled:bg-[#048890]/30"
                disabled={!isStep3Valid || loading}
              >
                {loading ? "Création en cours..." : "Créer le projet"}
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  )
}
