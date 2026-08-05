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

export default function CreateProjectPage() {
  const router = useRouter()

  const [projectName, setProjectName] = useState("")
  const [totalProjectSp, setTotalProjectSp] = useState<string>("")

  const [rmFile, setRmFile] = useState<File | null>(null)
  const [jiraFile, setJiraFile] = useState<File | null>(null)
  const [leavesFile, setLeavesFile] = useState<File | null>(null)

  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [mvpEndDate, setMvpEndDate] = useState<Date | undefined>(undefined)
  const [crEndDate, setCrEndDate] = useState<Date | undefined>(undefined)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validation des champs
  const isValid = Boolean(
    projectName.trim() &&
      totalProjectSp !== "" &&
      Number(totalProjectSp) > 0 &&
      rmFile &&
      jiraFile &&
      leavesFile &&
      startDate &&
      mvpEndDate &&
      mvpEndDate > startDate &&
      (crEndDate ? crEndDate > startDate && crEndDate > mvpEndDate : true)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append("name", projectName)
    formData.append("total_project_sp", totalProjectSp)
    formData.append("capacity_file", rmFile as File)
    formData.append("jira_file", jiraFile as File)
    formData.append("leaves_file", leavesFile as File)

    formData.append(
      "start_date",
      (startDate as Date).toISOString().split("T")[0]
    )
    formData.append(
      "mvp_end_date",
      (mvpEndDate as Date).toISOString().split("T")[0]
    )
    if (crEndDate) {
      formData.append(
        "cr_end_date",
        crEndDate.toISOString().split("T")[0]
      )
    }

    try {
      const resp = await axios.post(
        "http://localhost:8000/api/v1/projects/",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      )
      const projectMetadata = resp.data.projectMetadata
      router.push(
        `/projects/${projectMetadata.id}/${projectMetadata.modules[0].id}/overview`
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* En-tête de la page */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          Créer un nouveau projet JIRA
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Renseignez les informations du projet, le macro-chiffrage, le
          planning et déposez les fichiers d'extraction requis.
        </p>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="mb-6 rounded-lg bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Formulaire Principal */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Informations Générales */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            1. Informations générales
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Nom du projet *
              </Label>
              <Input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="ex: Batica"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Macro-chiffrage SP *
              </Label>
              <Input
                type="number"
                min="1"
                step="any"
                value={totalProjectSp}
                onChange={(e) => setTotalProjectSp(e.target.value)}
                placeholder="ex: 250 (Somme totale des SP)"
                required
              />
            </div>
          </div>
        </Card>

        {/* Section 2: Calendrier & Planning */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            2. Planning prévisionnel
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Date de début *
              </Label>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Fin prévue (MVP) *
              </Label>
              <DatePicker
                value={mvpEndDate}
                onChange={setMvpEndDate}
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Fin estimée (CR)
              </Label>
              <DatePicker
                value={crEndDate}
                onChange={setCrEndDate}
                className="w-full"
              />
            </div>
          </div>
        </Card>

        {/* Section 3: Fichiers de Données */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            3. Dépôt des fichiers d'extraction *
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DropZone
              title="Export RM"
              description="Fichier d'export de RM"
              acceptText="CSV, XLSX jusqu'à 20MB"
              file={rmFile}
              onFileSelect={setRmFile}
            />

            <DropZone
              title="Export Jira"
              description="Fichier d'export de Jira"
              acceptText="CSV, XLSX jusqu'à 20MB"
              file={jiraFile}
              onFileSelect={setJiraFile}
            />

            <DropZone
              title="Fiche de congés"
              description="Export de la fiche de congés"
              acceptText="CSV, XLSX jusqu'à 20MB"
              file={leavesFile}
              onFileSelect={setLeavesFile}
            />
          </div>
        </Card>

        {/* Actions en bas de page */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            className="bg-[#048890] hover:bg-[#036c73] disabled:bg-[#048890]/30"
            disabled={!isValid || loading}
          >
            {loading ? "Création en cours..." : "Créer le projet"}
          </Button>
        </div>
      </form>
    </div>
  )
}
