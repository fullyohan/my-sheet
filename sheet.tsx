"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContentFull,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog"
import { Divider } from "@/components/Divider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { cx, focusRing } from "@/lib/utils"
import {
  RiCloseLine,
  RiExpandDiagonalLine,
  RiFilter3Line,
} from "@remixicon/react"
import React, { useMemo, useState, useEffect } from "react"
import axios from "axios"

export interface TimeSlotData {
  date?: string
  capacity: number
  consumedHours: number
  leaveType?: string | null
}

export interface ResourceCapacity {
  resourceId: string
  resourceEmail?: string
  resourceName: string
  type: string
  team: string
  sprintIds: string[]
  totalCapacity: number
  slots: (TimeSlotData | null)[]
}

const getCapacityBgColor = (percentage: number) => {
  if (percentage < 69)
    return "bg-emerald-50 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-100"
  if (percentage < 85)
    return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200"
  if (percentage < 100)
    return "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
  return "bg-rose-500 dark:bg-rose-600 text-white dark:text-white font-semibold"
}

interface CapacityDetailsProps {
  resource: ResourceCapacity | null
  isOpen: boolean
  onClose: () => void
}

const CapacityDetailsDialog = ({
  resource,
  isOpen,
  onClose,
}: CapacityDetailsProps) => {
  if (!resource) return null

  const validSlots = resource.slots.filter(
    (s): s is TimeSlotData => s !== null && !s.leaveType && s.capacity > 0
  )

  const avgLoad =
    validSlots.reduce((acc, curr) => {
      const load = Math.round((curr.consumedHours / curr.capacity) * 100)
      return acc + load
    }, 0) / (validSlots.length || 1)

  const leaveDaysCount = resource.slots.filter((s) => s?.leaveType).length

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContentFull className="fixed inset-4 mx-auto flex w-[95vw] flex-col overflow-hidden rounded-lg p-0 shadow-lg sm:max-w-2xl">
        <DialogHeader className="flex-none border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Détails de la capacité : {resource.resourceName}
          </DialogTitle>
          <DialogDescription className="mt-1 sm:text-sm/6">
            Équipe :{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {resource.team}
            </span>{" "}
            | Type : {resource.type} | Capacité max : {resource.totalCapacity}h
          </DialogDescription>
          <DialogClose asChild>
            <Button className="absolute right-4 top-4 p-2" variant="ghost">
              <RiCloseLine className="size-5 shrink-0" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 font-medium text-gray-900 dark:text-gray-50">
                Aperçu Global
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    Charge moyenne (hors congés)
                  </span>
                  <span className="mt-1 block text-xl font-semibold text-gray-900 dark:text-gray-50">
                    {avgLoad.toFixed(1)}%
                  </span>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    Créneaux en congé
                  </span>
                  <span className="mt-1 block text-xl font-semibold text-gray-900 dark:text-gray-50">
                    {leaveDaysCount}
                  </span>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    Capacité max
                  </span>
                  <span className="mt-1 block text-xl font-semibold text-gray-900 dark:text-gray-50">
                    {resource.totalCapacity}h
                  </span>
                </div>
              </div>
            </section>
          </div>
        </DialogBody>

        <DialogFooter className="flex-none border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950">
          <DialogClose asChild>
            <Button variant="secondary">Fermer</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContentFull>
    </Dialog>
  )
}

export default function CapacityGrid() {
  const [selectedResource, setSelectedResource] = useState<ResourceCapacity | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string>("ALL")
  const [selectedSprint, setSelectedSprint] = useState<string>("ALL")

  const [teams, setTeams] = useState<string[]>([])
  const [timeSlots, setTimeSlots] = useState<string[]>([])
  const [resources, setResources] = useState<ResourceCapacity[]>([])

  const fetchRessources = async () => {
    try {
      const resp = await axios.get(
        "http://localhost:8000/api/v1/dashboard/capacity-grid"
      )
      setTeams(resp.data.teams || [])
      setResources(resp.data.resources || [])
      setTimeSlots(resp.data.timeSlots || [])
    } catch (e) {
      console.error("Erreur lors de la récupération des ressources :", e)
    }
  }

  useEffect(() => {
    fetchRessources()
  }, [])

  // 🗓️ 1. Génération explicite de TOUTES les dates sans sauts du calendrier (Start -> End)
  const continuousTimeSlots = useMemo(() => {
    if (!timeSlots || timeSlots.length === 0) return []

    const dates = timeSlots
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())

    if (dates.length === 0) return []

    const start = new Date(dates[0])
    const end = new Date(dates[dates.length - 1])

    const fullCalendar: string[] = []
    const current = new Date(start)

    while (current <= end) {
      const isoDate = current.toISOString().split("T")[0]
      fullCalendar.push(isoDate)
      current.setDate(current.getDate() + 1)
    }

    return fullCalendar
  }, [timeSlots])

  // Extraction dynamique des Sprints
  const sprints = useMemo(() => {
    return Array.from(new Set(resources.flatMap((r) => r.sprintIds || [])))
  }, [resources])

  // Filtre des ressources
  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      const matchTeam = selectedTeam === "ALL" || res.team === selectedTeam
      const matchSprint =
        selectedSprint === "ALL" ||
        (res.sprintIds && res.sprintIds.includes(selectedSprint))
      return matchTeam && matchSprint
    })
  }, [resources, selectedTeam, selectedSprint])

  return (
    <main className="min-h-screen bg-gray-50/30 p-4 transition-colors sm:p-6 dark:bg-gray-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Grille de Capacité
          </h1>
          <p className="text-gray-500 sm:text-sm/6 dark:text-gray-400">
            Visualisez la charge, les congés et la disponibilité par équipe et sprint.
          </p>
        </div>
      </div>

      <Divider className="my-6 border-gray-200 dark:border-gray-800" />

      {/* FILTRES */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <RiFilter3Line className="size-4 shrink-0 text-gray-500" />
          <span>Filtres :</span>
        </div>

        <div className="shadow-xs flex flex-wrap items-center gap-4 rounded-xl border border-gray-200/80 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/60 dark:backdrop-blur">
          <div className="flex items-center gap-2">
            <label htmlFor="team-select" className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Équipe :
            </label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger id="team-select" className="w-[180px] dark:border-gray-800 dark:bg-gray-950">
                <SelectValue placeholder="Toutes les équipes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les équipes</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team} value={team}>
                    {team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="sprint-select" className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Sprint :
            </label>
            <Select value={selectedSprint} onValueChange={setSelectedSprint}>
              <SelectTrigger id="sprint-select" className="w-[180px] dark:border-gray-800 dark:bg-gray-950">
                <SelectValue placeholder="Tous les sprints" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les sprints</SelectItem>
                {sprints.map((sprint) => (
                  <SelectItem key={sprint} value={sprint}>
                    {sprint.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* TABLEAU GRILLE DE CAPACITÉ */}
      <section className="mt-6">
        <TableRoot className="overflow-x-auto">
          <Table className="border-none">
            <TableHead>
              <TableRow>
                <TableHeaderCell className="sticky left-0 top-0 z-10 min-w-48 border-transparent bg-white p-2 dark:border-transparent dark:bg-gray-950">
                  <span className="block font-medium">Ressource</span>
                  <span className="block font-normal text-gray-500 dark:text-gray-400">
                    Équipe • Capacité
                  </span>
                </TableHeaderCell>

                {/* EN-TÊTE : Affiche TOUS les jours du calendrier sans sauts */}
                {continuousTimeSlots.map((dateStr) => (
                  <TableHeaderCell
                    key={dateStr}
                    className="border-none text-center font-medium text-gray-700 capitalize whitespace-nowrap dark:text-gray-300"
                  >
                    {new Date(dateStr).toLocaleDateString("fr-FR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {filteredResources.map((resource) => {
                // Indexation Date -> Slot pour alignement parfait
                const slotsByDate = new Map<string, TimeSlotData | null>()
                resource.slots.forEach((slot, index) => {
                  const rawDate = slot?.date || timeSlots[index]
                  if (rawDate) {
                    const formattedKey = new Date(rawDate).toISOString().split("T")[0]
                    slotsByDate.set(formattedKey, slot)
                  }
                })

                return (
                  <TableRow key={resource.resourceEmail || resource.resourceId} className="h-full">
                    {/* Colonne Fixe Ressource */}
                    <TableCell className="sticky left-0 z-10 h-full bg-white p-0 sm:min-w-56 dark:bg-gray-950">
                      <button
                        className={cx(
                          "group relative h-full w-full rounded p-2 text-left transition hover:bg-gray-100 focus-visible:bg-gray-100 hover:dark:bg-gray-900 focus-visible:dark:bg-gray-900",
                          focusRing
                        )}
                        onClick={() => setSelectedResource(resource)}
                      >
                        <RiExpandDiagonalLine className="absolute right-3 top-3 size-4 text-gray-500/0 transition group-hover:text-gray-500 group-focus-visible:text-gray-500" />
                        <span className="block text-sm font-medium text-gray-900 dark:text-gray-50">
                          {resource.resourceName}
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                          {resource.team} • {resource.totalCapacity}h max
                        </span>
                      </button>
                    </TableCell>

                    {/* RENDU DE CHAQUE JOUR CONTINU */}
                    {continuousTimeSlots.map((dateStr) => {
                      const slot = slotsByDate.get(dateStr)

                      // 1. Jour non saisi / absent de l'API
                      if (!slot) {
                        return (
                          <TableCell key={dateStr} className="h-full min-w-24 p-[2px]">
                            <div 
                              title={`Non saisi pour le ${dateStr}`}
                              className="flex h-[56px] flex-col items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50/30 dark:border-gray-800 dark:bg-gray-900/20"
                            >
                              <span className="text-[11px] font-medium text-gray-400 dark:text-gray-600">
                                Non saisi
                              </span>
                            </div>
                          </TableCell>
                        )
                      }

                      // 2. Congé
                      if (slot.leaveType) {
                        return (
                          <TableCell key={dateStr} className="h-full min-w-24 p-[2px]">
                            <div
                              title={slot.leaveType || "Congé"}
                              className="flex h-[56px] flex-col items-center justify-center rounded bg-gray-100/80 text-gray-500 dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-400"
                            >
                              <span className="text-xs font-medium">Congé</span>
                              <span className="text-[10px] opacity-75">Absent</span>
                            </div>
                          </TableCell>
                        )
                      }

                      // 3. Overtime
                      if (!slot.capacity && slot.consumedHours) {
                        return (
                          <TableCell key={dateStr} className="h-full min-w-24 p-[2px]">
                            <div className="flex h-[56px] flex-col items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                              <span className="text-xs font-medium">Overtime</span>
                              <span className="text-[10px] font-semibold">{slot.consumedHours}h</span>
                            </div>
                          </TableCell>
                        )
                      }

                      // 4. Jour normal avec charge
                      const loadPercentage = Math.round(
                        (slot.consumedHours / slot.capacity) * 100
                      )

                      return (
                        <TableCell key={dateStr} className="h-full min-w-24 p-[2px]">
                          <div
                            className={cx(
                              "flex h-[56px] flex-col items-center justify-center rounded px-2 py-1.5 transition-all",
                              getCapacityBgColor(loadPercentage)
                            )}
                          >
                            <span className="block text-sm font-semibold">{loadPercentage}%</span>
                            <span className="mt-0.5 block text-xs opacity-80">
                              {slot.consumedHours} / {slot.capacity}h
                            </span>
                          </div>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableRoot>

        <CapacityDetailsDialog
          resource={selectedResource}
          isOpen={!!selectedResource}
          onClose={() => setSelectedResource(null)}
        />
      </section>

      {/* LÉGENDE */}
      <section className="mt-6 flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="font-medium">Légende :</span>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-emerald-200 dark:bg-emerald-950" />
          <span>&lt; 69%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-emerald-300 dark:bg-emerald-900" />
          <span>69% - 85%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-amber-200 dark:bg-amber-950" />
          <span>85% - 100%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-rose-500" />
          <span>Surcharge (&gt; 100%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-800" />
          <span>Congé / Absence</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900" />
          <span>Non saisi</span>
        </div>
      </section>
    </main>
  )
}
