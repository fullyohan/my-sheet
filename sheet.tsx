"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useSetup } from "../layout"
import { Button } from "@/components/Button"
import { RiArrowLeftLine, RiArrowRightLine, RiDragMove2Line } from "@remixicon/react"
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
  const router = useRouter()
  const { activeModule, updateActiveModule, loading } = useSetup()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  if (!activeModule) return null

  // On s'assure qu'on travaille sur une structure de mapping valide
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

  const findContainer = (id: string) => {
    if (id in mapping) return id
    return Object.keys(mapping).find((key) => mapping[key]?.includes(id))
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeContainer = findContainer(active.id as string)
    const overContainer =
      findContainer(over.id as string) || (over.id as string)

    if (!activeContainer || !overContainer || activeContainer === overContainer)
      return

    const activeItems = mapping[activeContainer] || []
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

    handleMappingChange({
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
    const overContainer =
      findContainer(over.id as string) || (over.id as string)

    if (activeContainer && overContainer && activeContainer === overContainer) {
      const activeIndex = mapping[activeContainer].indexOf(active.id as string)
      const overIndex = mapping[overContainer].indexOf(over.id as string)

      if (activeIndex !== overIndex) {
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
      {/* En-tête de la page */}
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
          Mapping des Statuts Jira :{" "}
          <span className="text-[#048890]">{activeModule.name}</span>
        </h2>
        <p className="text-xs text-gray-500">
          Glissez-déposez les statuts sources de votre Jira vers les catégories cibles du workflow.
        </p>
      </div>

      {/* ZONE DND DRAG AND DROP */}
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

      {/* NAVIGATION FOOTER */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("./step-4")}
          disabled={loading}
        >
          <RiArrowLeftLine className="mr-1.5 size-4" /> Précédent
        </Button>

        <Button
          type="button"
          className="bg-[#048890] hover:bg-[#036c73]"
          onClick={() => router.push("./step-6")}
          disabled={loading}
        >
          Suivant
          <RiArrowRightLine className="ml-1.5 size-4" />
        </Button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                        SOUS-COMPOSANTS HORS COMPOSANT                       */
/* -------------------------------------------------------------------------- */

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
