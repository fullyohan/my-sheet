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

export const TARGET_STATUSES = [
  "En écriture",
  "Prêt",
  "En développement",
  "En test",
  "En prod",
  "Annulé",
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

  // Normalisation des clés pour éviter tout bug d'encodage sur "Prêt" / "En écriture"
  const rawMapping = (activeModule.mappingItems as Record<string, string[]>) || {}
  
  const mapping: Record<string, string[]> = TARGET_STATUSES.reduce((acc, status) => {
    acc[status] = Array.isArray(rawMapping[status]) ? rawMapping[status] : []
    return acc
  }, {} as Record<string, string[]>)

  const handleMappingChange = (newMapping: Record<string, string[]>) => {
    updateActiveModule({ mappingItems: newMapping })
  }

  // 🛠️ FIX 1 : Normalisation Unicode + Recherche Robuste
  const findContainer = (id: string) => {
    if (!id) return null
    const normalizedId = id.normalize("NFC")
    
    // Si l'id est directement un container
    if (TARGET_STATUSES.some((status) => status.normalize("NFC") === normalizedId)) {
      return TARGET_STATUSES.find((status) => status.normalize("NFC") === normalizedId) || id
    }

    // Sinon c'un item dans une liste
    return Object.keys(mapping).find((key) =>
      mapping[key]?.some((item) => item.normalize("NFC") === normalizedId)
    )
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)

    const activeContainer = findContainer(activeIdStr)
    const overContainer = findContainer(overIdStr) || overIdStr

    if (!activeContainer || !overContainer || activeContainer === overContainer)
      return

    const activeItems = mapping[activeContainer] || []
    const overItems = mapping[overContainer] || []

    const activeIndex = activeItems.indexOf(activeIdStr)
    const overIndex = overItems.indexOf(overIdStr)

    let newIndex: number
    if (TARGET_STATUSES.includes(overContainer) && overIndex === -1) {
      newIndex = overItems.length
    } else {
      const isBelowOverItem =
        over &&
        active.rect.current.translated &&
        active.rect.current.translated.top > over.rect.top + over.rect.height
      const modifier = isBelowOverItem ? 1 : 0
      newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length
    }

    handleMappingChange({
      ...mapping,
      [activeContainer]: activeItems.filter((item) => item !== activeIdStr),
      [overContainer]: [
        ...overItems.slice(0, newIndex),
        activeIdStr,
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

    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)

    const activeContainer = findContainer(activeIdStr)
    const overContainer = findContainer(overIdStr) || overIdStr

    if (activeContainer && overContainer && activeContainer === overContainer) {
      const activeIndex = mapping[activeContainer].indexOf(activeIdStr)
      const overIndex = mapping[overContainer].indexOf(overIdStr)

      if (activeIndex !== overIndex && activeIndex !== -1 && overIndex !== -1) {
        handleMappingChange({
          ...mapping,
          [activeContainer]: arrayMove(
            mapping[activeContainer],
            activeIndex,
            overIndex,
          ),
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
          {TARGET_STATUSES.map((targetKey) => (
            <DroppableContainer
              key={targetKey}
              id={targetKey}
              title={targetKey}
              items={mapping[targetKey] || []}
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

  // 🛠️ FIX 2 : Filtrage des doublons/undefined pour les keys React
  const cleanItems = Array.from(new Set(items.filter(Boolean)))

  return (
    <div className="flex max-h-[500px] flex-col justify-between overflow-auto rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="flex items-center justify-between border-b border-gray-200/80 pb-2 dark:border-gray-800">
        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
          {title}
        </span>
        <span className="rounded-full bg-gray-200/60 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {cleanItems.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="mt-2.5 min-h-[100px] flex-1 space-y-1.5 rounded-lg border border-dashed border-gray-200 p-2 dark:border-gray-800"
      >
        <SortableContext items={cleanItems} strategy={verticalListSortingStrategy}>
          {cleanItems.map((item) => (
            <SortableItem key={`${id}-${item}`} id={item} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
