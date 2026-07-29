"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { DropdownUserProfile } from "@/components/ui/UserProfile"
import {
  RiFolder3Line,
  RiFolderOpenLine,
  RiStackLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiSidebarFoldLine,
  RiSidebarUnfoldLine,
} from "@remixicon/react"
import { CreationDialog } from "./CreationDialog"
import axios from "axios"
import { ProjectContextMenu } from "./ProjectContextMenu"

export interface Module {
  id: string
  name: string
}

export interface Project {
  id: string
  name: string
  hasModules: boolean
  modules?: Module[]
  lastUpdate?: Date
}

interface SidebarNavigationProps {
  children?: React.ReactNode
}

export function SidebarNavigation({ children }: SidebarNavigationProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isProjectsOpen, setIsProjectsOpen] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const resp = await axios.get("http://127.0.0.1:8000/api/v1/projects")
      setProjects(resp.data.projects)
    } catch (err) {
      console.error("Erreur lors de la récupération des projets", err)
    }
  }

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }))
  }

  const getProjectHref = (p: Project) => (p.hasModules ? null : `/projects/${p.id}/default/overview`)
  const getModuleHref = (projectId: string, moduleId: string) => `/projects/${projectId}/${moduleId}/overview`

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {!isCollapsed ? (
        <aside className="flex flex-col border-r border-[#036c73] bg-[#048890] text-white transition-all duration-300 dark:border-gray-800 dark:bg-gray-900">
          {/* Header Sidebar */}
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-4 dark:border-gray-800">
            <Link href="/" className="flex items-center gap-2.5 truncate font-bold text-white">
              <span className="truncate text-base tracking-wide">Dashboard</span>
            </Link>

            <div className="ml-3 flex flex-row items-center gap-1">
              <CreationDialog />
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="rounded-lg bg-[#048890] p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                title="Réduire"
              >
                <RiSidebarFoldLine className="size-5" />
              </button>
            </div>
          </div>

          {/* Nav List */}
          <nav className="flex-1 select-none space-y-2 overflow-y-auto px-4 py-5">
            <div>
              <button
                onClick={() => setIsProjectsOpen(!isProjectsOpen)}
                className="group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold uppercase tracking-wider text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                <div className="flex items-center gap-2.5">
                  <RiFolder3Line className="size-4 shrink-0" />
                  <span>Projets</span>
                </div>
                {isProjectsOpen ? (
                  <RiArrowDownSLine className="size-4 text-white/60" />
                ) : (
                  <RiArrowRightSLine className="size-4 text-white/60" />
                )}
              </button>

              {isProjectsOpen && (
                <div className="mt-1 space-y-1 pl-1">
                  {projects.map((project) => {
                    const projectHref = getProjectHref(project)
                    const isProjectActive = projectHref ? pathname === projectHref : false
                    const isChildActive = pathname.startsWith(`/projects/${project.id}/`)
                    const isExpanded = !!expandedProjects[project.id]

                    return (
                      <ProjectContextMenu
                        key={project.id}
                        project={project}
                        onEdit={(proj) => console.log("Edit:", proj)}
                        onDelete={(proj) => console.log("Delete:", proj)}
                      >
                        <div className="relative space-y-1">
                          <div
                            className={`group relative flex items-center justify-between rounded-md text-xs font-medium transition-all ${
                              isProjectActive
                                ? "bg-white font-bold text-[#048890] shadow-sm dark:bg-blue-600 dark:text-white"
                                : isChildActive
                                ? "bg-white/15 font-semibold text-white"
                                : "text-white/85 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {(isProjectActive || isChildActive) && (
                              <span className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-r-full bg-[#048890] dark:bg-white" />
                            )}

                            {projectHref ? (
                              <Link href={projectHref} className="flex flex-1 items-center gap-2.5 truncate px-3 py-2">
                                <RiFolder3Line className="size-4 shrink-0 text-white/80" />
                                <span className="truncate">{project.name}</span>
                              </Link>
                            ) : (
                              <div
                                onClick={() => toggleProject(project.id)}
                                className="flex flex-1 cursor-pointer items-center gap-2.5 truncate px-3 py-2"
                              >
                                {isExpanded ? (
                                  <RiFolderOpenLine className="size-4 shrink-0 text-white/80" />
                                ) : (
                                  <RiFolder3Line className="size-4 shrink-0 text-white/80" />
                                )}
                                <span className="truncate">{project.name}</span>
                              </div>
                            )}

                            {/* Bouton Toggle / Modificateurs */}
                            {project.hasModules && (
                              <div className="flex items-center gap-1 pr-2">
                                <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
                                  {project.modules?.length || 0}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleProject(project.id)
                                  }}
                                  className="rounded p-1 text-white/70 hover:bg-white/20"
                                >
                                  {isExpanded ? (
                                    <RiArrowDownSLine className="size-3.5" />
                                  ) : (
                                    <RiArrowRightSLine className="size-3.5" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Liste des modules */}
                          {project.hasModules && isExpanded && (
                            <div className="relative ml-5 space-y-1 pb-0.5 pt-1">
                              <span className="absolute bottom-3.5 left-0 top-0 w-px border-l border-dashed border-white/40 dark:border-gray-700" />

                              {project.modules?.map((module) => {
                                const moduleHref = getModuleHref(project.id, module.id)
                                const isModuleActive = pathname === moduleHref

                                return (
                                  <div key={module.id} className="relative flex items-center pl-4">
                                    <span className="absolute left-0 top-1/2 h-px w-3.5 border-b border-dashed border-white/40 dark:border-gray-700" />

                                    <Link
                                      href={moduleHref}
                                      className={`group flex flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-all ${
                                        isModuleActive
                                          ? "bg-white font-bold text-[#048890] shadow-sm dark:bg-blue-500 dark:text-white"
                                          : "text-white/80 hover:bg-white/10 hover:text-white"
                                      }`}
                                    >
                                      <RiStackLine className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                                      <span className="truncate">{module.name}</span>
                                    </Link>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </ProjectContextMenu>
                    )
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Footer User Profile */}
          <div className="border-t border-white/10 p-3 dark:border-gray-800">
            <DropdownUserProfile />
          </div>
        </aside>
      ) : (
        <aside className="p-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded-lg bg-[#048890] p-3 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            title="Agrandir"
          >
            <RiSidebarUnfoldLine className="size-5" />
          </button>
        </aside>
      )}

      {/* Contenu principal */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
