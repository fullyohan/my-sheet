"use client"

import React, { useState } from "react"
import { RiFolderAddLine, RiStackLine } from "@remixicon/react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"

interface Module {
  id: string
  name: string
}

interface Project {
  id: string
  name: string
  hasModules: boolean
  modules: Module[]
}

export default function Index({ projects = [] }: { projects: Project[] }) {
  const [selectedTarget, setSelectedTarget] = useState("")

  const handleSelectChange = (value: string) => {
    setSelectedTarget(value)
    const [projectId, moduleId] = value.split(":")
    // projectId contient l'id du projet, moduleId contient l'id du module (ou "default")
    // Appelle ton API ou dispatch ton action ici
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] w-full p-6 text-center">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-8 shadow-sm transition-all">
        
        {/* Badge */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#048890]/10 dark:bg-[#048890]/20 flex items-center justify-center text-[#048890] dark:text-[#05a3ad] mb-5">
          <RiStackLine className="w-7 h-7" />
        </div>

        {/* Titre & Description */}
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 tracking-tight">
          Sélectionnez un périmètre
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          Choisissez un projet ou un module dans la liste ci-dessous pour charger son tableau de bord.
        </p>

        {/* Select avec Mapping React Direct */}
        <div className="mt-8 space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
              Projet / Module
            </label>
            
            <Select value={selectedTarget} onValueChange={handleSelectChange}>
              <SelectTrigger className="w-full bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 rounded-xl h-11 text-sm focus:ring-2 focus:ring-[#048890]">
                <SelectValue placeholder="Choisir un projet ou module..." />
              </SelectTrigger>
              
              <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl max-h-60">
                {projects.map((project) =>
                  project.hasModules && project.modules?.length > 0 ? (
                    /* Projet avec modules -> Groupe */
                    <SelectGroup key={project.id} className="mt-2">
                      <SelectLabel className="text-xs font-bold text-[#048890] uppercase px-2 py-1">
                        {project.name}
                      </SelectLabel>
                      {project.modules.map((module) => (
                        <SelectItem key={module.id} value={`${project.id}:${module.id}`}>
                          └ Module : {module.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : (
                    /* Projet simple sans modules -> Item unique */
                    <SelectItem key={project.id} value={`${project.id}:default`}>
                      {project.name}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Séparateur */}
          <div className="relative my-5 flex items-center justify-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
            <span className="absolute bg-white dark:bg-gray-900 px-3 text-[11px] uppercase tracking-wider font-semibold text-gray-400">
              Ou
            </span>
          </div>

          {/* Bouton d'action */}
          <button
            type="button"
            className="w-full h-11 inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold text-white bg-[#048890] hover:bg-[#036e74] active:bg-[#02555a] rounded-xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-[#048890] cursor-pointer"
          >
            <RiFolderAddLine className="w-4 h-4" />
            <span>Importer un nouveau projet</span>
          </button>
        </div>

      </div>
    </div>
  )
}
