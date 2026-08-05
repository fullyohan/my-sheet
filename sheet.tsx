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
import { useRouter } from "next/navigation"

interface CreationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

interface ModuleInput {
  name: string
}

export const CreationModal = ({
  isOpen,
  onClose,
  onConfirm,
}: CreationModalProps) => {
  const [projectName, setProjectName] = useState("")
  const [hasModules, setHasModules] = useState(false)
  const [modulesCount, setModulesCount] = useState<number>(1)
  const [modules, setModules] = useState<ModuleInput[]>([{ name: "" }])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Validation : Nom du projet requis + Noms de tous les modules activés non vides
  const isValid = Boolean(
    projectName.trim() &&
      (!hasModules ||
        (modules.length > 0 && modules.every((m) => m.name.trim() !== ""))),
  )

  const handleHasModulesChange = (checked: boolean) => {
    setHasModules(checked)
    if (!checked) {
      setModulesCount(1)
      setModules([{ name: "" }])
    }
  }

  const handleModulesCountChange = (count: number) => {
    const validCount = Math.max(1, Math.min(count, 20)) // Limité entre 1 et 20
    setModulesCount(validCount)

    setModules((prev) => {
      const updated = [...prev]
      if (validCount > updated.length) {
        for (let i = updated.length; i < validCount; i++) {
          updated.push({ name: "" })
        }
      } else {
        updated.splice(validCount)
      }
      return updated
    })
  }

  const handleModuleNameChange = (index: number, name: string) => {
    setModules((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], name }
      return updated
    })
  }

  const resetForm = () => {
    setProjectName("")
    setHasModules(false)
    setModulesCount(1)
    setModules([{ name: "" }])
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    setError(null)

    // Si pas de sous-modules, on crée 1 module par défaut portant le nom du projet
    const finalModulesPayload = hasModules
      ? modules.map((m) => ({ name: m.name.trim() }))
      : [{ name: projectName.trim() }]

    try {
      // 1. Création du Draft dans Redis / Disk
      const resp = await axios.post("http://localhost:8000/api/v1/projects/draft", {
        name: projectName.trim(),
        modules: finalModulesPayload,
      })

      const draftProject = resp.data
      resetForm()
      onClose()
      onConfirm()

      // 2. Redirection vers la page setup
      router.push(`/projects/${draftProject.id}/setup`)
    } catch (err: any) {
      console.error(err)
      const apiError =
        err.response?.data?.detail || "Erreur lors de l'initialisation du projet."
      setError(apiError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center">
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Initialiser un nouveau projet</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-6">
              Renseignez le nom du projet et définissez ses modules avant de passer à la configuration globale.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
              {error}
            </div>
          )}

          <form className="mt-4 space-y-6" onSubmit={handleSubmit}>
            {/* Nom du projet */}
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

            {/* Checkbox Has Modules */}
            <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
              <input
                type="checkbox"
                id="hasModules"
                checked={hasModules}
                onChange={(e) => handleHasModulesChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#048890] focus:ring-[#048890]"
              />
              <Label
                htmlFor="hasModules"
                className="cursor-pointer text-sm font-medium text-gray-700"
              >
                Ce projet est divisé en plusieurs modules
              </Label>
            </div>

            {/* Configuration des modules dynamiques */}
            {hasModules && (
              <div className="space-y-4 rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-gray-600">
                    Nombre de modules *
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={modulesCount}
                    onChange={(e) =>
                      handleModulesCountChange(parseInt(e.target.value) || 1)
                    }
                    className="w-full sm:w-32"
                    required
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Noms des modules
                  </Label>
                  <div className="grid grid-cols-1 gap-3 max-h-52 overflow-y-auto pr-1">
                    {modules.map((mod, index) => (
                      <div key={index} className="flex flex-col gap-1">
                        <Label className="text-xs font-medium text-gray-600">
                          Module {index + 1} *
                        </Label>
                        <Input
                          type="text"
                          value={mod.name}
                          onChange={(e) =>
                            handleModuleNameChange(index, e.target.value)
                          }
                          placeholder={`ex: ${
                            index === 0
                              ? "Front-End"
                              : index === 1
                              ? "Back-End"
                              : `Module ${index + 1}`
                          }`}
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="border-t border-gray-100 pt-4">
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
                className="w-full bg-[#048890] hover:bg-[#036c73] disabled:bg-[#048890]/30 sm:w-fit"
                disabled={!isValid || loading}
              >
                {loading ? "Initialisation..." : "Continuer vers le Setup"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
