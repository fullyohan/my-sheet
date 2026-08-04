"use client"

import React, { useState } from "react"
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
import { Card } from "@/components/Card"
import { RiDragMove2Line, RiRefreshLine } from "@remixicon/react"

const TARGET_STATUSES = [
  "1_En écriture",
  "2_Prêt",
  "3_En développement",
  "4_En test",
  "5_En prod",
  "0_Annulé",
]

const INITIAL_DATA: Record<string, string[]> = {
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

// Élément individuel Draggable
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
      <span>{id}</span>
      <RiDragMove2Line className="size-3.5 text-gray-400 shrink-0" />
    </div>
  )
}

// Zone de dépot (Container Droppable)
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
    <Card className="flex flex-col justify-between dark:border-gray-800 dark:bg-gray-900/80">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 dark:border-gray-800">
        <span className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">{title}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="mt-3 flex-1 min-h-[140px] space-y-2 rounded-xl border border-dashed border-gray-200/80 p-2 dark:border-gray-800"
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableItem key={item} id={item} />
          ))}
        </SortableContext>
      </div>
    </Card>
  )
}

export default function StatusMappingDndKit() {
  const [items, setItems] = useState(INITIAL_DATA)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const findContainer = (id: string) => {
    if (id in items) return id
    return Object.keys(items).find((key) => items[key].includes(id))
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

    setItems((prev) => {
      const activeItems = prev[activeContainer]
      const overItems = prev[overContainer] || []

      const activeIndex = activeItems.indexOf(active.id as string)
      const overIndex = overItems.indexOf(over.id as string)

      let newIndex: number
      if (over.id in prev) {
        newIndex = overItems.length + 1
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height
        const modifier = isBelowOverItem ? 1 : 0
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1
      }

      return {
        ...prev,
        [activeContainer]: activeItems.filter((item) => item !== active.id),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          items[activeContainer][activeIndex],
          ...overItems.slice(newIndex),
        ],
      }
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
      const activeIndex = items[activeContainer].indexOf(active.id as string)
      const overIndex = items[overContainer].indexOf(over.id as string)

      if (activeIndex !== overIndex) {
        setItems((prev) => ({
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer], activeIndex, overIndex),
        }))
      }
    }

    setActiveId(null)
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50">Mapping des Statuts Jira</h1>
        <button
          onClick={() => setItems(INITIAL_DATA)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
        >
          <RiRefreshLine className="size-4" /> Réinitialiser
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Unassigned */}
          <DroppableContainer id="unassigned" title="Non Assignés" items={items.unassigned} />

          {/* Targets */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
            {TARGET_STATUSES.map((targetKey) => (
              <DroppableContainer
                key={targetKey}
                id={targetKey}
                title={targetKey}
                items={items[targetKey] || []}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeId ? (
            <div className="flex items-center justify-between rounded-lg border border-[#048890] bg-white p-2 text-xs font-medium text-gray-800 shadow-lg dark:bg-gray-950 dark:text-gray-200">
              <span>{activeId}</span>
              <RiDragMove2Line className="size-3.5 text-gray-400 shrink-0" />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
