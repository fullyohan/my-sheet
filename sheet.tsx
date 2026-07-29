"use client"

import React from "react"
import Link from "next/link"
import { RiFolderAddLine, RiFolderLine, RiCodeBoxLine, RiArrowRightSLine } from "@remixicon/react"
import { useProjects } from "@/context/ProjectContext"

export default function Index() {
  const { projects, isLoading } = useProjects()

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-4 text-left">
      {/* En-tête de la page */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 tracking-tight">
        Sélectionnez un projet
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        Choisissez un projet ou un module dans l&apos;arborescence ci-dessous pour charger son tableau de bord.
      </p>

      <div className="mt-6 space-y-4">
        {/* En-tête Arborescence */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Arborescence des projets
          </span>
          <span className="text-xs font-medium text-gray-400">
            {projects.length} projet{projects.length > 1 ? "s" : ""}
          </span>
        </div>

        {/* Arbre des Projets & Modules */}
        <div className="bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200/80 dark:border-gray-800 rounded-xl p-3 max-h-96 overflow-y-auto space-y-2 divide-y divide-gray-100 dark:divide-gray-800/60">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-gray-400">Chargement des projets...</div>
          ) : projects.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">Aucun projet disponible</div>
          ) : (
            projects.map((project) => (
              <div key={project.id} className="pt-2 first:pt-0 space-y-1">
                {/* Projet sans sous-modules */}
                {!project.hasModules ? (
                  <Link
                    href={`/projects/${project.id}`}
                    className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm border border-transparent hover:border-gray-200/60 dark:hover:border-gray-700/60 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <RiFolderLine className="w-5 h-5 text-[#048890]" />
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-[#048890] transition-colors">
                        {project.name}
                      </span>
                    </div>
                    <RiArrowRightSLine className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ) : (
                  /* Projet avec sous-modules */
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-[#048890] uppercase tracking-wider">
                      <RiFolderLine className="w-4 h-4 text-[#048890]" />
                      <span>{project.name}</span>
                    </div>

                    {/* Sous-modules */}
                    <div className="ml-4 pl-3 border-l-2 border-gray-200 dark:border-gray-700/80 space-y-1">
                      {project.modules?.map((module: any) => (
                        <Link
                          key={module.id}
                          href={`/projects/${project.id}/modules/${module.id}`}
                          className="group flex items-center justify-between p-2 rounded-md hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm border border-transparent hover:border-gray-200/60 dark:hover:border-gray-700/60 transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            <RiCodeBoxLine className="w-4 h-4 text-gray-400 group-hover:text-[#048890] transition-colors" />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-[#048890] transition-colors">
                              Module : {module.name}
                            </span>
                          </div>
                          <RiArrowRightSLine className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Séparateur */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
          <span className="absolute bg-white dark:bg-gray-950 px-3 text-[11px] uppercase tracking-wider font-semibold text-gray-400">
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
  )
}
