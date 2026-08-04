"use client"

import React, { useState } from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd"
import { Card } from "@/components/Card"
import { RiDragMove2Line, RiRefreshLine, RiCheckLine } from "@remixicon/react"

// Types pour l'état du Board
interface StatusMappingState {
  unassigned: string[]
  targets: Record<string, string[]>
}

// Statuts Cibles (Colonnes de droite)
const TARGET_STATUSES = [
  "1_En écriture",
  "2_Prêt",
  "3_En développement",
  "4_En test",
  "5_En prod",
  "0_Annulé",
]

// Données initiales extraites du tableau
const INITIAL_DATA: StatusMappingState = {
  unassigned: [],
  targets: {
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
    "5_En prod": [
      "Livrée en prod",
      "KO livrée en prod",
      "Terminé",
    ],
    "0_Annulé": ["Annulé"],
  },
}

export default function StatusMappingBoard() {
  const [boardData, setBoardData] = useState<StatusMappingState>(INITIAL_DATA)

  // Gestion du Drag and Drop
  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result

    // Déposé hors d'un conteneur
    if (!destination) return

    // Aucun changement de position
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return
    }

    const sourceId = source.droppableId
    const destId = destination.droppableId

    // 1. Récupération de la liste source
    const sourceList =
      sourceId === "unassigned"
        ? [...boardData.unassigned]
        : [...boardData.targets[sourceId]]

    // 2. Extraire l'élément déplacé
    const [movedItem] = sourceList.splice(source.index, 1)

    // 3. Récupération de la liste destination
    const destList =
      destId === "unassigned"
        ? [...boardData.unassigned]
        : [...(boardData.targets[destId] || [])]

    // Si on déplace au sein de la même colonne
    if (sourceId === destId) {
      sourceList.splice(destination.index, 0, movedItem)
      setBoardData((prev) => ({
        ...prev,
        [sourceId === "unassigned" ? "unassigned" : "targets"]:
          sourceId === "unassigned"
            ? sourceList
            : { ...prev.targets, [sourceId]: sourceList },
      }))
      return
    }

    // Si on déplace vers une autre colonne
    destList.splice(destination.index, 0, movedItem)

    setBoardData((prev) => ({
      unassigned:
        sourceId === "unassigned"
          ? sourceList
          : destId === "unassigned"
          ? destList
          : prev.unassigned,
      targets: {
        ...prev.targets,
        ...(sourceId !== "unassigned" && { [sourceId]: sourceList }),
        ...(destId !== "unassigned" && { [destId]: destList }),
      },
    }))
  }

  // Réinitialisation
  const handleReset = () => setBoardData(INITIAL_DATA)

  // Exporter la configuration au format JSON (pour ton backend ou config)
  const handleSave = () => {
    const mappingResult: Record<string, string> = {}
    Object.entries(boardData.targets).forEach(([target, items]) => {
      items.forEach((item) => {
        mappingResult[item] = target
      })
    })
    console.log("Mapping généré :", mappingResult)
    alert("Correspondance enregistrée ! (Regarde la console pour le JSON)")
  }

  return (
    <div className="w-full space-y-6">
      {/* En-tête des actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50">
            Mapping des Statuts Jira
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Glissez-déposez les statuts bruts Jira dans leurs catégories cibles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RiRefreshLine className="size-4 shrink-0" />
            Réinitialiser
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg bg-[#048890] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-90"
          >
            <RiCheckLine className="size-4 shrink-0" />
            Enregistrer le Mapping
          </button>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          
          {/* COLONNE GAUCHE : Statuts Non Assignés / En réserve */}
          <Card className="flex flex-col dark:border-gray-800 dark:bg-gray-900/80">
            <div className="border-b border-gray-100 pb-3 dark:border-gray-800">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Statuts Non Assignés ({boardData.unassigned.length})
              </h2>
            </div>

            <Droppable droppableId="unassigned">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`mt-3 flex-1 min-h-[300px] space-y-2 rounded-xl border border-dashed p-2 transition-colors ${
                    snapshot.isDraggingOver
                      ? "border-cyan-500 bg-cyan-50/20 dark:bg-cyan-950/10"
                      : "border-gray-200 dark:border-gray-800"
                  }`}
                >
                  {boardData.unassigned.length === 0 ? (
                    <div className="flex h-full items-center justify-center p-4 text-center text-xs text-gray-400">
                      Tous les statuts Jira sont actuellement mappés.
                    </div>
                  ) : (
                    boardData.unassigned.map((status, index) => (
                      <Draggable
                        key={status}
                        draggableId={status}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`flex items-center justify-between rounded-lg border bg-white p-2.5 text-xs font-medium text-gray-700 shadow-xs transition-shadow dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 ${
                              snapshot.isDragging
                                ? "border-cyan-500 ring-2 ring-cyan-500/20 shadow-md"
                                : "border-gray-200 hover:border-gray-300 dark:hover:border-gray-700"
                            }`}
                          >
                            <span>{status}</span>
                            <RiDragMove2Line className="size-4 text-gray-400 shrink-0" />
                          </div>
                        )}
                      </Draggable>
                    ))
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </Card>

          {/* COLONNE DROITE : Grille des Statuts Cibles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
            {TARGET_STATUSES.map((targetKey) => {
              const items = boardData.targets[targetKey] || []
              return (
                <Card
                  key={targetKey}
                  className="flex flex-col justify-between dark:border-gray-800 dark:bg-gray-900/80"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 dark:border-gray-800">
                    <span className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">
                      {targetKey}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {items.length}
                    </span>
                  </div>

                  <Droppable droppableId={targetKey}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`mt-3 flex-1 min-h-[140px] space-y-2 rounded-xl border border-dashed p-2 transition-colors ${
                          snapshot.isDraggingOver
                            ? "border-[#048890] bg-cyan-50/30 dark:bg-cyan-950/20"
                            : "border-gray-200/80 dark:border-gray-800"
                        }`}
                      >
                        {items.map((status, index) => (
                          <Draggable
                            key={status}
                            draggableId={status}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`flex items-center justify-between rounded-lg border bg-white p-2 text-xs font-medium text-gray-800 shadow-xs transition-shadow dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 ${
                                  snapshot.isDragging
                                    ? "border-[#048890] ring-2 ring-[#048890]/20 shadow-md"
                                    : "border-gray-200/90 hover:border-gray-300 dark:hover:border-gray-700"
                                }`}
                              >
                                <span>{status}</span>
                                <RiDragMove2Line className="size-3.5 text-gray-400 shrink-0" />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </Card>
              )
            })}
          </div>

        </div>
      </DragDropContext>
    </div>
  )
}
