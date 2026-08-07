"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useSetup } from "../layout"
import { DropZone } from "@/components/DropZone"
import { Button } from "@/components/Button"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"

export default function Step3Page() {
  const router = useRouter()
  const {
    activeModule,
    updateActiveModule,
    fetchTeams,
    fetchJiraStatus,
    loading,
  } = useSetup()

  if (!activeModule) return null

  const handleRmChange = (file: File | null) => {
    updateActiveModule({ rmFile: file })
    if (file) {
      fetchTeams(file)
    }
  }

  const handleJiraChange = (file: File | null) => {
    updateActiveModule({ jiraFile: file })
    if (file) {
      fetchJiraStatus(file)
    }
  }

  const handleLeavesChange = (file: File | null) => {
    updateActiveModule({ leavesFile: file })
  }

  return (
    <div className="space-y-6">
      {/* En-tête de la page */}
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
          Import d'extracts :{" "}
          <span className="text-[#048890]">{activeModule.name}</span>
        </h2>
        <p className="text-xs text-gray-500">
          Importez les fichiers d'exports nécessaires pour alimenter le suivi du module.
        </p>
      </div>

      {/* Zone de drop de fichiers */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DropZone
          title="Export RM"
          description="Fichier RM"
          acceptText="CSV, XLSX"
          file={activeModule.rmFile}
          onFileSelect={handleRmChange}
        />
        <DropZone
          title="Export Jira"
          description="Fichier Jira"
          acceptText="CSV, XLSX"
          file={activeModule.jiraFile}
          onFileSelect={handleJiraChange}
        />
        <DropZone
          title="Fiche Congés"
          description="Export Congés"
          acceptText="CSV, XLSX"
          file={activeModule.leavesFile}
          onFileSelect={handleLeavesChange}
        />
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("./step-2")}
          disabled={loading}
        >
          <RiArrowLeftLine className="mr-1.5 size-4" /> Précédent
        </Button>

        <Button
          type="button"
          className="bg-[#048890] hover:bg-[#036c73]"
          onClick={() => router.push("./step-4")}
          disabled={loading}
        >
          Suivant
          <RiArrowRightLine className="ml-1.5 size-4" />
        </Button>
      </div>
    </div>
  )
}
