"use client"

import React, { useState } from "react"
import axios from "axios"
import { useRouter } from "next/navigation"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { DropZone } from "@/components/DropZone"
import { DatePicker } from "@/components/DatePicker"
import { Card } from "@/components/Card"
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCheckLine,
  RiInformationLine,
  RiCalendarEventLine,
  RiFileUploadLine,
  RiDragMove2Line,
  RiRefreshLine,
} from "@remixicon/react"

// Importations DnD Kit
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

// Statuts cibles pour le DnD
const TARGET_STATUSES = [
  "1_En écriture",
  "2_Prêt",
  "3_En développement",
  "4_En test",
  "5_En prod",
  "0_Annulé",
]

// Données initiales du mapping DnD
const INITIAL_MAPPING: Record<string, string[]> = {
  unassigned: [],
  "1_En écriture": [
    "Nouveau",
    "Brouillon",
    "A designer",
    "En design",
    "Review design",
    "Relecture",
    "Mature",
    "A estimer",
  ],
  "2_Prêt": ["Prêt"],
  "3_En développement": ["En cours"],
  "4_En test": [
    "Validation technique",
    "A livrer dev",
    "Validation fonctionnelle",
    "Validation K.O.",
    "A livrer int",
    "Prêt pour deploiement int",
    "A recetter INT",
    "Test à automatiser",
    "A livrer en prod",
    "KO a livrer en prod",
    "Restitution",
    "PRET POUR DEPLOIEEMET",
  ],
  "5_En prod": ["Livrée en prod", "KO livrée en prod", "Terminé"],
  "0_Annulé": ["Annulé"],
}

export default function CreateProjectWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)

  // Étape 1 : Infos
  const [projectName, setProjectName] = useState("")
  const [totalProjectSp, setTotalProjectSp] = useState<string>("")

  // Étape 2 : Dates
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [mvpEndDate, setMvpEndDate] = useState<Date | undefined>(undefined)
  const [crEndDate, setCrEndDate] = useState<Date | undefined>(undefined)

  // Étape 3 : Fichiers & Mapping DnD
  const [rmFile, setRmFile] = useState<File | null>(null)
  const [jiraFile, setJiraFile] = useState<File | null>(null)
  const [leavesFile, setLeavesFile] = useState<File | null>(null)

  // DnD Kit State
  const [mappingItems, setMappingItems] = useState(INITIAL_MAPPING)
  const [activeId, setActiveId] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sensors pour le DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Logique du DnD Kit
  const findContainer = (id: string) => {
    if (id in mappingItems) return id
    return Object.keys(mappingItems).find((key) => mappingItems[key].includes(id))
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

    setMappingItems((prev) => {
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
          prev[activeContainer][activeIndex],
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
      const activeIndex = mappingItems[activeContainer].indexOf(active.id as string)
      const overIndex = mappingItems[overContainer].indexOf(over.id as string)

      if (activeIndex !== overIndex) {
        setMappingItems((prev) => ({
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer], activeIndex, overIndex),
        }))
      }
    }

    setActiveId(null)
  }

  // Validations
  const isStep1Valid = projectName.trim() !== "" && Number(totalProjectSp) > 0
  const isStep2Valid =
    Boolean(startDate && mvpEndDate && mvpEndDate > startDate) &&
    (crEndDate ? crEndDate > startDate && crEndDate > mvpEndDate : true)
  const isStep3Valid = Boolean(rmFile && jiraFile && leavesFile)

  const handleNext = () => {
    if (currentStep === 1 && isStep1Valid) setCurrentStep(2)
    else if (currentStep === 2 && isStep2Valid) setCurrentStep(3)
  }

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isStep1Valid || !isStep2Valid || !isStep3Valid) return

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append("name", projectName)
    formData.append("total_project_sp", totalProjectSp)
    formData.append("capacity_file", rmFile as File)
    formData.append("jira_file", jiraFile as File)
    formData.append("leaves_file", leavesFile as File)
    formData.append("status_mapping", JSON.stringify(mappingItems))

    formData.append("start_date", (startDate as Date).toISOString().split("T")[0])
    formData.append("mvp_end_date", (mvpEndDate as Date).toISOString().split("T")[0])
    if (crEndDate) {
      formData.append("cr_end_date", crEndDate.toISOString().split("T")[0])
    }

    try {
      const resp = await axios.post("http://localhost:8000/api/v1/projects/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      const projectMetadata = resp.data.projectMetadata
      router.push(`/projects/${projectMetadata.id}/${projectMetadata.modules[0].id}/overview`)
    } catch (err: any) {
      console.error(err.message)
      const apiError = err.response?.data?.detail || "Erreur lors de la création du projet."
      setError(apiError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <RiArrowLeftLine className="size-4" /> Annuler
          </button>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Création de Projet
          </span>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Stepper */}
        <div className="mb-8 flex items-center justify-between">
          {[
            { step: 1, label: "Informations", icon: RiInformationLine },
            { step: 2, label: "Planning", icon: RiCalendarEventLine },
            { step: 3, label: "Fichiers & Mapping Jira", icon: RiFileUploadLine },
          ].map((item) => {
            const isActive = currentStep === item.step
            const isDone = currentStep > item.step

            return (
              <div key={item.step} className="flex items-center gap-2">
                <div
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isDone
                      ? "bg-emerald-500 text-white"
                      : isActive
                      ? "bg-[#048890] text-white ring-4 ring-[#048890]/20"
                      : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {isDone ? <RiCheckLine className="size-4" /> : item.step}
                </div>
                <span
                  className={`hidden text-xs font-semibold sm:inline ${
                    isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-400"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            )
          })}
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-rose-50 p-4 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
            {error}
          </div>
        )}

        <Card className="p-6">
          {/* ÉTAPE 1 */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Généralités du projet
                </h2>
                <p className="text-xs text-gray-500">Nommez votre projet et définissez son périmètre SP.</p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Nom du projet *</Label>
                  <Input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="ex: Batica"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Macro-chiffrage (Story Points) *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={totalProjectSp}
                    onChange={(e) => setTotalProjectSp(e.target.value)}
                    placeholder="ex: 250"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Planning prévisionnel
                </h2>
                <p className="text-xs text-gray-500">Définissez les dates clés du projet.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Début du projet *</Label>
                  <DatePicker value={startDate} onChange={setStartDate} className="w-full" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-amber-600">Fin prévue (MVP) *</Label>
                  <DatePicker value={mvpEndDate} onChange={setMvpEndDate} className="w-full" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-emerald-600">Fin estimée (CR)</Label>
                  <DatePicker value={crEndDate} onChange={setCrEndDate} className="w-full" />
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 : FICHIERS & DND KIT INTEGRÉ */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Dépôt des fichiers */}
              <div className="space-y-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Fichiers d'extraction
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <DropZone title="Export RM" description="Fichier RM" acceptText="CSV, XLSX" file={rmFile} onFileSelect={setRmFile} />
                  <DropZone title="Export Jira" description="Fichier Jira" acceptText="CSV, XLSX" file={jiraFile} onFileSelect={setJiraFile} />
                  <DropZone title="Fiche Congés" description="Export Congés" acceptText="CSV, XLSX" file={leavesFile} onFileSelect={setLeavesFile} />
                </div>
              </div>

              <hr className="border-gray-100 dark:border-gray-800" />

              {/* Drag and Drop Jira Mapping */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      Mapping des Statuts Jira
                    </h3>
                    <p className="text-xs text-gray-500">
                      Organisez vos statuts Jira dans les catégories correspondantes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMappingItems(INITIAL_MAPPING)}
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
                    <DroppableContainer id="unassigned" title="Non Assignés" items={mappingItems.unassigned} />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
                      {TARGET_STATUSES.map((targetKey) => (
                        <DroppableContainer
                          key={targetKey}
                          id={targetKey}
                          title={targetKey}
                          items={mappingItems[targetKey] || []}
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
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
            {currentStep > 1 ? (
              <Button type="button" variant="secondary" onClick={handlePrev} disabled={loading}>
                Précédent
              </Button>
            ) : <div />}

            {currentStep < 3 ? (
              <Button
                type="button"
                className="bg-[#048890] hover:bg-[#036c73]"
                disabled={currentStep === 1 ? !isStep1Valid : !isStep2Valid}
                onClick={handleNext}
              >
                Suivant <RiArrowRightLine className="ml-1.5 size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                className="bg-[#048890] hover:bg-[#036c73] disabled:bg-[#048890]/30"
                disabled={!isStep3Valid || loading}
              >
                {loading ? "Création en cours..." : "Créer le projet"}
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  )
}

// Sub-fonctions internes DnD Kit
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
    <Card className="flex flex-col justify-between p-3 dark:border-gray-800 dark:bg-gray-900/80">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
        <span className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">{title}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="mt-2.5 flex-1 min-h-[100px] space-y-1.5 rounded-xl border border-dashed border-gray-200/80 p-2 dark:border-gray-800"
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
