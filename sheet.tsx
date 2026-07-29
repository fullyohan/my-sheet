"use client"

import React, { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/DropdownMenu"
import { RiEditLine, RiDeleteBinLine } from "@remixicon/react"

interface ProjectContextMenuProps {
  project: { id: string; name: string }
  onEdit: (project: any) => void
  onDelete: (project: any) => void
  children: React.ReactNode
}

export function ProjectContextMenu({
  project,
  onEdit,
  onDelete,
  children,
}: ProjectContextMenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Récupère les coordonnées du pointeur
    setPosition({ x: e.clientX, y: e.clientY })
    setOpen(true)
  }

  return (
    <div onContextMenu={handleContextMenu} className="w-full">
      {/* Élément affiché (ton item de projet) */}
      {children}

      <DropdownMenu open={open} onOpenChange={setOpen}>
        {/* Trigger invisible ancré à la position du clic droit */}
        <DropdownMenuTrigger asChild>
          <button
            style={{
              position: "fixed",
              top: position.y,
              left: position.x,
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
            }}
            tabIndex={-1}
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="min-w-44" align="start">
          <DropdownMenuLabel className="truncate">
            {project.name}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onEdit(project)}>
              <span className="flex items-center gap-x-2">
                <RiEditLine className="size-4 text-inherit" />
                <span>Modifier / Mise à jour</span>
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => onDelete(project)}
              className="text-red-600 dark:text-red-400"
            >
              <span className="flex items-center gap-x-2">
                <RiDeleteBinLine className="size-4 text-inherit" />
                <span>Supprimer</span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}



<ProjectContextMenu
  project={project}
  onEdit={(proj) => setEditingProject(proj)}
  onDelete={(proj) => handleDeleteProject(proj.id)}
>
  <div className="flex flex-1 items-center gap-2.5 truncate px-3 py-2">
    <RiFolder3Line className="size-4 shrink-0" />
    <span className="truncate">{project.name}</span>
  </div>
</ProjectContextMenu>
