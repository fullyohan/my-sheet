"use client"
import React, { useState } from "react"
import axios from "axios"
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
import { DropZone } from "../DropZone"
import { useRouter } from "next/navigation"
import { DatePicker } from "../DatePicker"

interface CreationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export const CreationModal = ({ isOpen, onClose, onConfirm }: CreationModalProps) => {
  const [projectName, setProjectName] = useState("")
  
  // Champ Saisie Manuelle : Macro-chiffrage (Proposition KLx) pour % Écriture
  const [totalProjectSp, setTotalProjectSp] = useState<string>("")

  // Fichiers d'import
  const [rmFile, setRmFile] = useState<File | null>(null)
  const [jiraFile, setJiraFile] = useState<File | null>(null)
  const [leavesFile, setLeavesFile] = useState<File | null>(null)

  // Jalons de Dates
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [mvpEndDate, setMvpEndDate] = useState<Date | undefined>(undefined)
  const [crEndDate, setCrEndDate] = useState<Date | undefined>(undefined)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Calcul dynamique de l'impact de la CR en jours
  const calculateCrImpactDays = () => {
    if (!mvpEndDate || !crEndDate) return 0
    const diffTime = crEndDate.getTime() - mvpEndDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  }

  const impactDays = calculateCrImpactDays()

  // Validation globale
  const isValid = Boolean(
    projectName.trim() &&
    totalProjectSp !== "" &&
    Number(totalProjectSp) > 0 &&
    rmFile &&
    jiraFile &&
    leavesFile &&
    startDate &&
    mvpEndDate
  )

  const resetForm = () => {
    setProjectName("")
    setTotalProjectSp("")
    setRmFile(null)
    setJiraFile(null)
    setLeavesFile(null)
    setStartDate(undefined)
    setMvpEndDate(undefined)
    setCrEndDate(undefined)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append("name", projectName)
    formData.append("total_project_sp", totalProjectSp) // Macro-chiffrage SP KLx
    formData.append("capacity_file", rmFile as File)
    formData.append("jira_file", jiraFile as File)
    formData.append("leaves_file", leavesFile as File)

    // Dates formatées (YYYY-MM-DD)
    if (startDate) formData.append("start_date", startDate.toISOString().split("T")[0])
    if (mvpEndDate) formData.append("mvp_end_date", mvpEndDate.toISOString().split("T")[0])
    if (crEndDate) {
      formData.append("cr_end_date", crEndDate.toISOString().split("T")[0])
    } else if (mvpEndDate) {
      formData.append("cr_end_date", mvpEndDate.toISOString().split("T")[0])
    }

    try {
      const resp = await axios.post("http://localhost:8000/api/v1/projects/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      const projectMetadata = resp.data.projectMetadata
      resetForm()
      onClose()
      onConfirm()
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
    <div className="flex justify-center">
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Créer un nouveau projet JIRA</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-6">
              Renseignez les informations du projet, le macro-chiffrage, le planning et déposez les fichiers d'extraction requis.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
              {error}
            </div>
          )}

          <form className="mt-4 space-y-6" onSubmit={handleSubmit}>
            {/* Infos Générales (Nom + Macro-chiffrage SP) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-semibold text-gray-700">
                  Nom du projet *
                </Label>
                <Input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="ex: Refonte SI"
                  required
                />
              </div>

              {/* Champ Macro-Chiffrage SP (Proposition KLx) */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-semibold text-gray-700">
                  Macro-chiffrage SP (Proposition KLx) *
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

            {/* Section Jalons de Dates */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Planning & Jalons Temporels *
                </Label>
                {impactDays > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                    +{impactDays} jours (Impact CR)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Date Début */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    Date de début *
                  </Label>
                  <DatePicker value={startDate} onChange={setStartDate} className="w-full" />
                </div>

                {/* Date Fin Prévue (MVP) */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-amber-700">
                    Fin prévue (MVP) *
                  </Label>
                  <DatePicker value={mvpEndDate} onChange={setMvpEndDate} className="w-full" />
                </div>

                {/* Date Fin CR */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-emerald-700">
                    Fin estimée (CR)
                  </Label>
                  <DatePicker value={crEndDate} onChange={setCrEndDate} className="w-full" />
                </div>
              </div>
            </div>

            {/* Section Dépôt de fichiers */}
            <div className="pt-2">
              <Label className="mb-3 block text-sm font-semibold text-gray-700">
                Dépôt des fichiers d'extraction *
              </Label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            </div>

            {/* Footer Buttons */}
            <DialogFooter className="mt-6 pt-4 border-t border-gray-100">
              <DialogClose asChild>
                <Button
                  type="button"
                  className="mt-2 w-full sm:mt-0 sm:w-fit"
                  variant="secondary"
                  disabled={loading}
                >
                  Annuler
                </Button>
              </DialogClose>
              <Button
                type="submit"
                className="w-full bg-[#048890] hover:bg-[#036c73] sm:w-fit disabled:bg-[#048890]/30"
                disabled={!isValid || loading}
              >
                {loading ? "Création en cours..." : "Créer le projet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
