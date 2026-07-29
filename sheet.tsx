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
  DialogTrigger,
} from "@/components/Dialog"
import { RiAddCircleLine } from "@remixicon/react"
import { Input } from "../Input"
import { Label } from "../Label"
import { DropZone } from "../DropZone"

export const CreationDialog = () => {
  const [projectName, setProjectName] = useState("")
  const [rmFile, setRmFile] = useState<File | null>(null)
  const [jiraFile, setJiraFile] = useState<File | null>(null)
  const [leavesFile, setLeavesFile] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const isValid = Boolean(rmFile && jiraFile && leavesFile && projectName.trim())

  // Gestion de l'envoi du formulaire et des 3 fichiers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append("name", projectName)
    formData.append("capacity_file", rmFile as File)
    formData.append("jira_file", jiraFile as File)
    formData.append("teams_file", leavesFile as File)

    try {
      await axios.post("http://localhost:8000/projects", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      // Re-initialisation du formulaire et fermeture de la modale
      setProjectName("")
      setRmFile(null)
      setJiraFile(null)
      setLeavesFile(null)
      setOpen(false)
    } catch (err: any) {
      const apiError = err.response?.data?.detail || "Erreur lors de la création du projet."
      setError(apiError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          className="flex justify-center rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <RiAddCircleLine className="size-5" />
        </DialogTrigger>

        <DialogContent className="overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Créer un nouveau projet JIRA</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-6">
              Renseignez les informations du projet et déposez les fichiers
              d'extraction requis.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
              {error}
            </div>
          )}

          <form className="mt-4 space-y-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5 w-full">
              <Label className="text-sm font-semibold text-gray-700">
                Nom du projet *
              </Label>
              <Input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="ex: Bati"
                required
              />
            </div>

            <div className="mt-4 border-t pt-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Dépôt des fichiers d'extraction
              </label>

              <div className="mt-4 grid grid-cols-3 gap-3">
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
                  title="Export de la fiche de congés"
                  description="Fichier d'export de la fiche de congés"
                  acceptText="CSV, XLSX jusqu'à 20MB"
                  file={leavesFile}
                  onFileSelect={setLeavesFile}
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
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
