"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { DropdownUserProfile } from "@/components/ui/UserProfile"
import {
  RiUploadCloud2Line,
  RiAddCircleLine,
  RiFolder3Line,
  RiFolderOpenLine,
  RiStackLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiSidebarFoldLine,
  RiSidebarUnfoldLine,
} from "@remixicon/react"

export interface Module {
  id: string
  name: string
}

export interface Project {
  id: string
  name: string
  modules?: Module[]
}

interface SidebarNavigationProps {
  children?: React.ReactNode
  projects?: Project[]
}

export function SidebarNavigation({
                                    children,
                                    projects = [
                                      {
                                        id: "wari",
                                        name: "Projet WARI",
                                        modules: [
                                          { id: "pricing", name: "Module Pricing" },
                                          { id: "scraping", name: "Module Scraper" },
                                        ],
                                      },
                                      {
                                        id: "ccc",
                                        name: "Projet CCC",
                                        modules: [],
                                      },
                                    ],
                                  }: SidebarNavigationProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isProjectsOpen, setIsProjectsOpen] = useState(true)

  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({
    wari: true,
  })

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }))
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <aside
        className={`flex flex-col border-r border-[#036c73] bg-[#048890] text-white transition-all duration-300 dark:border-gray-800 dark:bg-gray-900 ${
          isCollapsed ? "w-24" : "w-72"
        }`}
      >
        {/* Header Sidebar */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4 dark:border-gray-800">
          {!isCollapsed && (
            <Link
              href="/"
              className="flex items-center gap-2.5 truncate font-bold text-white"
            >
              <span className="truncate text-base tracking-wide">
                Capacity Planner
              </span>
            </Link>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white ${
              isCollapsed ? "mx-auto" : ""
            }`}
            title={isCollapsed ? "Agrandir" : "Réduire"}
          >
            {isCollapsed ? (
              <RiSidebarUnfoldLine className="size-5" />
            ) : (
              <RiSidebarFoldLine className="size-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5 select-none">
          {/* SECTION PROJETS */}
          <div>
            <button
              onClick={() => {
                if (isCollapsed) setIsCollapsed(false)
                setIsProjectsOpen(!isProjectsOpen)
              }}
              title={isCollapsed ? "Projets" : undefined}
              className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold tracking-wider text-white/70 uppercase transition-all hover:bg-white/10 hover:text-white ${
                isCollapsed ? "justify-center" : ""
              }`}
            >
              <div className="flex items-center gap-2.5">
                <RiFolder3Line className="size-4 shrink-0" />
                {!isCollapsed && <span>Projets</span>}
              </div>
              {!isCollapsed &&
                (isProjectsOpen ? (
                  <RiArrowDownSLine className="size-4 text-white/60" />
                ) : (
                  <RiArrowRightSLine className="size-4 text-white/60" />
                ))}
            </button>

            {/* Arborescence des Projets */}
            {!isCollapsed && isProjectsOpen && (
              <div className="mt-1 space-y-1 pl-1">
                {projects.map((project) => {
                  const hasModules =
                    project.modules && project.modules.length > 0
                  const projectHref = `/projects/${project.id}`
                  const isProjectActive = pathname === projectHref
                  const isChildActive = pathname.startsWith(`${projectHref}/`)
                  const isExpanded = !!expandedProjects[project.id]

                  return (
                    <div key={project.id} className="relative space-y-1">
                      {/* Ligne Projet */}
                      <div
                        className={`group relative flex items-center justify-between rounded-md text-xs font-medium transition-all ${
                          isProjectActive
                            ? "bg-white font-bold text-[#048890] shadow-sm dark:bg-blue-600 dark:text-white"
                            : isChildActive
                              ? "bg-white/15 font-semibold text-white"
                              : "text-white/85 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {/* Barre d'activation latérale */}
                        {(isProjectActive || isChildActive) && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#048890] dark:bg-white" />
                        )}

                        <Link
                          href={projectHref}
                          className="flex flex-1 items-center gap-2.5 px-3 py-2 truncate"
                        >
                          {isExpanded && hasModules ? (
                            <RiFolderOpenLine
                              className={`size-4 shrink-0 ${
                                isProjectActive
                                  ? "text-[#048890]"
                                  : "text-white/80"
                              }`}
                            />
                          ) : (
                            <RiFolder3Line
                              className={`size-4 shrink-0 ${
                                isProjectActive
                                  ? "text-[#048890]"
                                  : "text-white/80"
                              }`}
                            />
                          )}
                          <span className="truncate">{project.name}</span>
                        </Link>

                        <div className="flex items-center gap-1 pr-2">
                          {/* Badge nombre de modules */}
                          {hasModules && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                isProjectActive
                                  ? "bg-[#048890]/10 text-[#048890]"
                                  : "bg-white/15 text-white/90"
                              }`}
                            >
                              {project.modules?.length}
                            </span>
                          )}

                          {/* Toggle expand/collapse */}
                          {hasModules && (
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                toggleProject(project.id)
                              }}
                              className={`rounded p-1 transition-colors ${
                                isProjectActive
                                  ? "text-[#048890] hover:bg-[#048890]/10"
                                  : "text-white/70 hover:bg-white/20"
                              }`}
                              title={isExpanded ? "Réduire" : "Déplier"}
                            >
                              {isExpanded ? (
                                <RiArrowDownSLine className="size-3.5" />
                              ) : (
                                <RiArrowRightSLine className="size-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Niveau 2 : Sous-modules reliés par des pointillés */}
                      {hasModules && isExpanded && (
                        <div className="relative ml-5 space-y-1 pt-1 pb-0.5">
                          {/* Ligne verticale pointillée principale */}
                          <span className="absolute left-0 top-0 bottom-3.5 w-px border-l border-dashed border-white/40 dark:border-gray-700" />

                          {project.modules?.map((module) => {
                            const moduleHref = `/projects/${project.id}/modules/${module.id}`
                            const isModuleActive = pathname === moduleHref

                            return (
                              <div
                                key={module.id}
                                className="relative flex items-center pl-4"
                              >
                                {/* Ligne horizontale pointillée (connecteur L) */}
                                <span className="absolute left-0 top-1/2 h-px w-3.5 border-b border-dashed border-white/40 dark:border-gray-700" />

                                <Link
                                  href={moduleHref}
                                  className={`group flex flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-all ${
                                    isModuleActive
                                      ? "bg-white font-bold text-[#048890] shadow-sm dark:bg-blue-500 dark:text-white"
                                      : "text-white/80 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  <RiStackLine
                                    className={`size-3.5 shrink-0 transition-opacity ${
                                      isModuleActive
                                        ? "text-[#048890] opacity-100"
                                        : "opacity-60 group-hover:opacity-100"
                                    }`}
                                  />
                                  <span className="truncate">
                                    {module.name}
                                  </span>
                                </Link>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="my-3 border-t border-white/10 dark:border-gray-800" />

          {/* CRÉATION DE NOUVEAU PROJET */}
          <Link
            href="/projects/new"
            title={isCollapsed ? "Nouveau Projet" : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
              pathname === "/projects/new"
                ? "bg-white font-bold text-[#048890] shadow-sm dark:bg-blue-600 dark:text-white"
                : "text-white/85 hover:bg-white/10 hover:text-white dark:text-gray-300 dark:hover:bg-gray-800"
            } ${isCollapsed ? "justify-center" : ""}`}
          >
            <RiAddCircleLine className="size-4.5 shrink-0" />
            {!isCollapsed && <span className="truncate">Nouveau Projet</span>}
          </Link>

          {/* IMPORTATION DE DONNÉES */}
          <Link
            href="/import"
            title={isCollapsed ? "Import de données" : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
              pathname === "/import"
                ? "bg-white font-bold text-[#048890] shadow-sm dark:bg-blue-600 dark:text-white"
                : "text-white/85 hover:bg-white/10 hover:text-white dark:text-gray-300 dark:hover:bg-gray-800"
            } ${isCollapsed ? "justify-center" : ""}`}
          >
            <RiUploadCloud2Line className="size-4.5 shrink-0" />
            {!isCollapsed && (
              <span className="truncate">Import de données</span>
            )}
          </Link>
        </nav>

        {/* User Profile Footer */}
        <div className="border-t border-white/10 p-3 dark:border-gray-800">
          <div className="relative">
            <DropdownUserProfile />
          </div>
        </div>
      </aside>

      {/* Zone de contenu dynamique */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
