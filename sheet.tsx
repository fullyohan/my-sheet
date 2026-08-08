"use client"

import React, { useState } from "react"
import { useSetup } from "../layout"
import { RiDragMove2Line } from "@remixicon/react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  useDroppable,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// 1. Vrais IDs techniques uniques pour @dnd-kit + Libellé d'origine
export const TARGET_STATUSES = [
  { id: "target-writing", label: "En écriture" },
  { id: "target-ready", label: "Prêt" },
  { id: "target-in-dev", label: "En développement" },
  { id: "target-in-test", label: "En test" },
  { id: "target-in-prod", label: "En prod" },
  { id: "target-canceled", label: "Annulé" },
]

export default function Step5Page() {
  const { activeModule, updateActiveModule } = useSetup()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  if (!activeModule) return null

  // Ton objet de state conserve ses clés textuelles ("En écriture", etc.)
  const mapping = (activeModule.mappingItems as Record<string, string[]>) || {
    "En écriture": [],
    "Prêt": [],
    "En développement": [],
    "En test": [],
    "En prod": [],
    "Annulé": [],
  }

  const handleMappingChange = (newMapping: Record<string, string[]>) => {
    updateActiveModule({ mappingItems: newMapping })
  }

  // Helpers pour faire le pont entre l'ID dnd-kit (target-ready) et la clé du state ("Prêt")
  const getLabelById = (targetId: string) =>
    TARGET_STATUSES.find((t) => t.id === targetId)?.label || targetId

  const findContainer = (id: string) => {
    // Est-ce un ID de conteneur dnd-kit ? (ex: "target-ready")
    const targetMatch = TARGET_STATUSES.find((t) => t.id === id)
    if (targetMatch) return targetMatch.id

    // Sinon, c'est un statut source Jira dans un des tableaux du mapping
    const foundLabel = Object.keys(mapping).find((key) =>
      mapping[key]?.includes(id),
    )
    if (!foundLabel) return null

    return TARGET_STATUSES.find((t) => t.label === foundLabel)?.id || null
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeContainerId = findContainer(active.id as string)
    const overContainerId =
      findContainer(over.id as string) || (over.id as string)

    if (
      !activeContainerId ||
      !overContainerId ||
      activeContainerId === overContainerId
    )
      return

    const activeLabel = getLabelById(activeContainerId)
    const overLabel = getLabelById(overContainerId)

    const activeItems = mapping[activeLabel] || []
    const overItems = mapping[overLabel] || []

    const activeIndex = activeItems.indexOf(active.id as string)
    const overIndex = overItems.indexOf(over.id as string)

    let newIndex: number
    const isOverTargetContainer = TARGET_STATUSES.some((t) => t.id === over.id)

    if (isOverTargetContainer) {
      newIndex = overItems.length + 1
    } else {
      const isBelowOverItem =
        over &&
        active.rect.current.translated &&
        active.rect.current.translated.top > over.rect.top + over.rect.height
      const modifier = isBelowOverItem ? 1 : 0
      newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1
    }

    // Mise à jour : les clés du state restent "En écriture", "Prêt", etc.
    handleMappingChange({
      ...mapping,
      [activeLabel]: activeItems.filter((item) => item !== active.id),
      [overLabel]: [
        ...overItems.slice(0, newIndex),
        mapping[activeLabel][activeIndex],
        ...overItems.slice(newIndex),
      ],
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) {
      setActiveId(null)
      return
    }

    const activeContainerId = findContainer(active.id as string)
    const overContainerId =
      findContainer(over.id as string) || (over.id as string)

    if (
      activeContainerId &&
      overContainerId &&
      activeContainerId === overContainerId
    ) {
      const label = getLabelById(activeContainerId)
      const activeIndex = mapping[label].indexOf(active.id as string)
      const overIndex = mapping[label].indexOf(over.id as string)

      if (activeIndex !== overIndex) {
        handleMappingChange({
          ...mapping,
          [label]: arrayMove(mapping[label], activeIndex, overIndex),
        })
      }
    }

    setActiveId(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
          Mapping des Statuts Jira :{" "}
          <span className="text-[#048890]">{activeModule.name}</span>
        </h2>
        <p className="text-xs text-gray-500">
          Glissez-déposez les statuts sources de votre Jira vers les catégories cibles du workflow.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TARGET_STATUSES.map((target) => (
            <DroppableContainer
              key={target.id}
              id={target.id} // ID technique propre pour dnd-kit
              title={target.label} // Titre affiché dans l'UI
              items={mapping[target.label] || []} // Items tirés directement de la clé du state
            />
          ))}
        </div>

        <DragOverlay>
          {activeId ? (
            <div className="flex items-center justify-between rounded-lg border border-[#048890] bg-white p-2 text-xs font-medium text-gray-800 shadow-lg dark:bg-gray-950 dark:text-gray-200">
              <span>{activeId}</span>
              <RiDragMove2Line className="size-3.5 shrink-0 text-gray-400" />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function SortableItem({ id }: { id: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="shadow-xs flex cursor-grab items-center justify-between rounded-lg border border-gray-200 bg-white p-2 text-xs font-medium text-gray-800 active:cursor-grabbing dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
    >
      <span className="truncate pr-1">{id}</span>
      <RiDragMove2Line className="size-3.5 shrink-0 text-gray-400" />
    </div>
  )
}

function DroppableContainer({
  id,
  title,
  items,
}: {
  id: string
  title: string
  items: string[]
}) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div className="flex max-h-[500px] flex-col justify-between overflow-auto rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="flex items-center justify-between border-b border-gray-200/80 pb-2 dark:border-gray-800">
        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
          {title}
        </span>
        <span className="rounded-full bg-gray-200/60 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="mt-2.5 min-h-[100px] flex-1 space-y-1.5 rounded-lg border border-dashed border-gray-200 p-2 dark:border-gray-800"
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableItem key={item} id={item} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
