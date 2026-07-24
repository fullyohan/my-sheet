"use client"

import React, { useState } from "react"
import CapacityGrid from "@/components/CapacityGrid"
import { ProjectOverview } from "@/components/ProjectOverview"

interface ProjectPageProps {
  projectId: string
}

export function ProjectPage({ projectId }: ProjectPageProps) {
  // Gestion de l'onglet actif : "overview" | "capacity" | "imports"
  const [activeTab, setActiveTab] = useState<"overview" | "capacity" | "imports">("capacity")

  return (
    <div className="flex flex-col h-full">
      {/* 1. Header du Projet avec Navigation par Onglets */}
      <div className="border-b border-gray-200 bg-white px-8 pt-6 dark:border-gray-800 dark:bg-gray-950">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          Projet : {projectId.toUpperCase()}
        </h1>

        {/* Barre d'onglets horizontaux */}
        <div className="mt-4 flex gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            Vue d'ensemble (Overview)
          </button>

          <button
            onClick={() => setActiveTab("capacity")}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === "capacity"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            Grille de Capacité (Capacity Grid)
          </button>
        </div>
      </div>

      {/* 2. Contenu Dynamique selon l'Onglet Sélectionné */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === "overview" && <ProjectOverview projectId={projectId} />}
        {activeTab === "capacity" && <CapacityGrid selectedProjectId={projectId} />}
      </div>
    </div>
  )
}
