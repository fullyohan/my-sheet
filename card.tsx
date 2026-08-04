"use client"

import React, { useEffect, useState } from "react"
import { Card } from "@/components/Card"
import { ProgressCircle } from "@/components/ProgressCircle"
import { CategoryBar } from "@/components/CategoryBar"

import {
  RiTimeLine,
  RiCheckDoubleLine,A
  RiBugLine,
  RiStackLine,
  RiFilter3Line,
} from "@remixicon/react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import axios from "axios"
import { useParams } from "next/navigation"

interface Capacity {
  capacityRealHours: number
  estimatedHours: number
  consumedHours: number
  occupancyRatePct: number
}

interface BacklogProgress {
  totalTickets: number
  ticketsDone: number
  progressPct: number
}

interface WorkDistribution {
  featuresPct: number
  BugsPct: number
  MaintenancePct: number
}

export default function AnalyticsDashboard() {
  const [teams, setTeams] = useState<string[]>([])
  const [selectedTeam, setSelectedTeam] = useState("ALL")
  const [capacity, setCapacity] = useState<Capacity | null>(null)
  const [backlogProgress, setBacklogProgress] = useState<BacklogProgress | null>(null)
  const [workDistribution, setWorkDistribution] = useState<WorkDistribution | null>(null)

  const { projectId, moduleId } = useParams()

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const resp = await axios.get(
          `http://localhost:8000/api/v1/projects/${projectId}/${moduleId}/overview`
        )
        setTeams(resp.data.teams || [])
        setCapacity(resp.data.capacity)
        setBacklogProgress(resp.data.backlogProgress || null)
        setWorkDistribution(resp.data.workDistribution || null)
      } catch (error) {
        console.error("Erreur lors de la récupération des KPIs:", error)
      }
    }

    if (projectId && moduleId) {
      fetchKpis()
    }
  }, [projectId, moduleId])

  const estimatedHours = capacity?.estimatedHours || 0
  const consumedHours = capacity?.consumedHours || 0
  const hoursOverrun = consumedHours - estimatedHours
  const hoursOverrunPct = estimatedHours > 0 ? Math.round((hoursOverrun / estimatedHours) * 100) : 0

  return (
    <main className="min-h-screen bg-gray-50/30 p-6 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
      <div className="mb-6 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <RiFilter3Line className="size-4 shrink-0 text-gray-500" />
          <span>Filtres :</span>
        </div>
        <div className="shadow-xs flex flex-wrap items-center gap-4 rounded-xl border border-gray-200/80 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/60 dark:backdrop-blur">
          <div className="flex items-center gap-2">
            <label
              htmlFor="team-select"
              className="text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              Département / Équipe :
            </label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-[180px] dark:border-gray-800 dark:bg-gray-950">
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
        </div>
      </div>

      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="flex flex-col justify-between dark:border-gray-800 dark:bg-gray-900/80">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Capacité Planifiée (RM)
            </dt>
            <dd className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              {capacity?.capacityRealHours ?? 0}h
            </dd>
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Période : ce mois-ci 
          </p>
        </Card>

        <Card className="flex flex-col justify-between dark:border-gray-800 dark:bg-gray-900/80">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Estimation initiale
            </dt>
            <dd className="mt-2 text-3xl font-semibold tracking-tight" style={{ color: "#048890" }}>
              {capacity?.estimatedHours ?? 0}h{" "}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                estimées
              </span>
            </dd>
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Sur {backlogProgress?.totalTickets ?? 0} tickets importés
          </p>
        </Card>

        <Card className="flex flex-col justify-between lg:row-span-2 dark:border-gray-800 dark:bg-gray-900/80">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Taux d'Occupation Réel
            </dt>
            <p className="mt-1 text-xs text-gray-400">
              Consommation sur capacité planifiée.
            </p>
          </div>

          <div className="my-auto flex flex-col items-center justify-center py-6 text-center">
            <ProgressCircle
              value={capacity?.occupancyRatePct ?? 0}
              radius={65}
              strokeWidth={8}
            />
            <dd className="mt-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              {capacity?.occupancyRatePct ?? 0}%
            </dd>
            <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {capacity?.consumedHours ?? 0}h consommées / {capacity?.capacityRealHours ?? 0}h
            </p>
          </div>

          {hoursOverrun > 0 && (
            <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 dark:border-rose-900/30 dark:bg-rose-950/20">
              <div className="flex items-center gap-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                <RiTimeLine className="size-4 shrink-0" />
                <span>
                  Dépassement de {hoursOverrun}h (+{hoursOverrunPct}%)
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2 dark:border-gray-800 dark:bg-gray-900/80">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Avancement du Backlog (Jira)
            </p>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">
              {backlogProgress?.ticketsDone ?? 0} / {backlogProgress?.totalTickets ?? 0} tickets
            </span>
          </div>

          <CategoryBar
            values={[
              backlogProgress?.progressPct || 0,
              100 - (backlogProgress?.progressPct || 0),
            ]}
            colors={["emerald", "gray"]}
            showLabels={false}
            className="mt-4"
          />

          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Progression globale</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {backlogProgress?.progressPct ?? 0}% complet
            </span>
          </div>
        </Card>

        <Card className="lg:col-span-3 dark:border-gray-800 dark:bg-gray-900/80">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Ventilation des Tickets (Jira Issue Types)
              </h2>
              <p className="text-xs text-gray-400">Répartition du volume de travail par typologie</p>
            </div>
          </div>

          <CategoryBar
            values={[
              workDistribution?.featuresPct || 0,
              workDistribution?.BugsPct || 0,
              workDistribution?.MaintenancePct || 0,
            ]}
            colors={["cyan", "red", "amber"]}
            showLabels={false}
            className="mt-4"
          />

          <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <RiStackLine className="size-4 shrink-0" style={{ color: "#048890" }} />
              <div>
                <span className="font-semibold text-gray-900 dark:text-gray-50">
                  {workDistribution?.featuresPct ?? 0}%
                </span>
                <p className="text-gray-500 dark:text-gray-400">Features / Stories</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RiBugLine className="size-4 shrink-0 text-rose-500 dark:text-rose-400" />
              <div>
                <span className="font-semibold text-gray-900 dark:text-gray-50">
                  {workDistribution?.BugsPct ?? 0}%
                </span>
                <p className="text-gray-500 dark:text-gray-400">Bugs / Anomalies</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RiCheckDoubleLine className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
              <div>
                <span className="font-semibold text-gray-900 dark:text-gray-50">
                  {workDistribution?.MaintenancePct ?? 0}%
                </span>
                <p className="text-gray-500 dark:text-gray-400">Dette Technique / Tâches</p>
              </div>
            </div>
          </div>
        </Card>

      </div>
    </main>
  )
}
