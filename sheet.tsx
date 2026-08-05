"use client"

import React, { useState } from "react"
import { Card } from "@/components/Card"
import { RiDragMove2Line, RiRefreshLine } from "@remixicon/react"
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
  "1_En écriture",
  "2_Prêt",
  "3_En développement",
  "4_En test",
  "5_En prod",
  "0_Annulé",
]

export const DEFAULT_STATUS_MAPPING: Record<string, string[]> = {
  unassigned: [],
  "1_En écriture": [
    "Nouveau", "Brouillon", "A designer", "En design",
    "Review design", "Relecture", "Mature", "A estimer"
  ],
  "2_Prêt": ["Prêt"],
  "3_En développement": ["En cours"],
  "4_En test": [
    "Validation technique", "A livrer dev", "Validation fonctionnelle",
    "Validation K.O.", "A livrer int", "Prêt pour deploiement int",
    "A recetter INT", "Test à automatiser", "A livrer en prod",
    "KO a livrer en prod", "Restitution", "PRET POUR DEPLOIEEMET"
  ],
  "5_En prod": ["Livrée en prod", "KO livrée en prod", "Terminé"],
  "0_Annulé": ["Annulé"],
}

interface StatusMappingSectionProps {
  mapping: Record<string, string[]>
  onChange: (mapping: Record<string, string[]>) => void
}

export default function StatusMappingSection({
  mapping,
  onChange,
}: StatusMappingSectionProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const findContainer = (id: string) => {
    if (id in mapping) return id
    return Object.keys(mapping).find((key) => mapping[key].includes(id))
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeContainer = findContainer(active.id as string)
    const overContainer = findContainer(over.id as string) || (over.id as string)

    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    const activeItems = mapping[activeContainer]
    const overItems = mapping[overContainer] || []

    const activeIndex = activeItems.indexOf(active.id as string)
    const overIndex = overItems.indexOf(over.id as string)

    let newIndex: number
    if (over.id in mapping) {
      newIndex = overItems.length + 1
    } else {
      const isBelowOverItem =
        over &&
        active.rect.current.translated &&
        active.rect.current.translated.top > over.rect.top + over.rect.height
      const modifier = isBelowOverItem ? 1 : 0
      newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1
    }

    onChange({
      ...mapping,
      [activeContainer]: activeItems.filter((item) => item !== active.id),
      [overContainer]: [
        ...overItems.slice(0, newIndex),
        mapping[activeContainer][activeIndex],
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

    const activeContainer = findContainer(active.id as string)
    const overContainer = findContainer(over.id as string) || (over.id as string)

    if (activeContainer && overContainer && activeContainer === overContainer) {
      const activeIndex = mapping[activeContainer].indexOf(active.id as string)
      const overIndex = mapping[overContainer].indexOf(over.id as string)

      if (activeIndex !== overIndex) {
        onChange({
          ...mapping,
          [activeContainer]: arrayMove(mapping[activeContainer], activeIndex, overIndex),
        })
      }
    }

    setActiveId(null)
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Mapping des Statuts Jira
          </h3>
          <p className="text-xs text-gray-500">
            Glissez-déposez les statuts sources dans les catégories cibles.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_STATUS_MAPPING)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
        >
          <RiRefreshLine className="size-3.5" /> Réinitialiser
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <DroppableContainer
            id="unassigned"
            title="Non Assignés"
            items={mapping.unassigned || []}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
            {TARGET_STATUSES.map((targetKey) => (
              <DroppableContainer
                key={targetKey}
                id={targetKey}
                title={targetKey}
                items={mapping[targetKey] || []}
              />
            ))}
          </div>
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
    </Card>
  )
}

function SortableItem({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

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
      className="flex cursor-grab items-center justify-between rounded-lg border border-gray-200 bg-white p-2 text-xs font-medium text-gray-800 shadow-xs active:cursor-grabbing dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
    >
      <span className="truncate pr-1">{id}</span>
      <RiDragMove2Line className="size-3.5 shrink-0 text-gray-400" />
    </div>
  )
}

function DroppableContainer({ id, title, items }: { id: string; title: string; items: string[] }) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="flex items-center justify-between border-b border-gray-200/80 pb-2 dark:border-gray-800">
        <span className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">{title}</span>
        <span className="rounded-full bg-gray-200/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="mt-2.5 flex-1 min-h-[100px] space-y-1.5 rounded-lg border border-dashed border-gray-200 p-2 dark:border-gray-800"
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
