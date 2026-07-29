"use client"

import React, { useEffect, useState } from "react"
import { Card } from "@/components/Card"
import { ProgressCircle } from "@/components/ProgressCircle"
import { CategoryBar } from "@/components/CategoryBar"

import {
  RiCheckDoubleLine,
  RiBugLine,
  RiStackLine,
  RiFilter3Line,
  RiCodeBoxLine,
  RiSearchEyeLine,
  RiFileList3Line,
  RiLoader4Line,
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
  consumedHours: number
  occupancyRatePct: number
}

interface BacklogProgress {
  totalTickets: number
  ticketsDone: number
  progressPct: number
}

interface WorkDistribution {
  storiesPct: number
  featuresPct: number
  techStoriesPct: number
  bugsPct: number
  tasksPct: number
  spikesPct: number
}

export default function AnalyticsDashboard() {
  const [teams, setTeams] = useState<string[]>([])
  const [selectedTeam, setSelectedTeam] = useState("ALL")
  const [capacity, setCapacity] = useState<Capacity | null>(null)
  const [backlogProgress, setBacklogProgress] = useState<BacklogProgress | null>(null)
  const [workDistribution, setWorkDistribution] = useState<WorkDistribution | null>(null)
  
  // États de chargement et d'erreur
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { projectId, moduleId } = useParams()

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        setLoading(true)
        setError(null)

        const resp = await axios.get(
          `http://localhost:8000/api/v1/projects/${projectId}/${moduleId}/overview`
        )
        
        setTeams(resp.data.teams || [])
        setCapacity(resp.data.capacity || null)
        setBacklogProgress(resp.data.backlogProgress || null)
        setWorkDistribution(resp.data.workDistribution || null)
      } catch (err) {
        console.error("Erreur lors de la récupération des KPIs:", err)
        setError("Impossible de charger les données du tableau de bord.")
      } finally {
        setLoading(false)
      }
    }

    if (projectId && moduleId) {
      fetchKpis()
    }
  }, [projectId, moduleId])

  // --- RENDU EN CAS DE CHARGEMENT (SKELETON) ---
  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50/30 p-6 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
        {/* Header / Filtre Skeleton */}
        <div className="mb-6 flex animate-pulse flex-col gap-2">
          <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800"></div>
          <div className="h-12 w-full rounded-xl border border-gray-200/80 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"></div>
        </div>

        {/* Dynamic Spinner Header */}
        <div className="mb-6 flex items-center justify-center gap-2 text-sm text-gray-500">
          <RiLoader4Line className="size-5 animate-spin text-cyan-500" />
          <span>Chargement des métriques en cours...</span>
        </div>

        {/* Cards Skeleton Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="h-40 animate-pulse bg-gray-100/80 dark:border-gray-800 dark:bg-gray-900/40" />
          <Card className="h-40 animate-pulse bg-gray-100/80 dark:border-gray-800 dark:bg-gray-900/40" />
          <Card className="h-36 animate-pulse lg:col-span-2 bg-gray-100/80 dark:border-gray-800 dark:bg-gray-900/40" />
          <Card className="h-48 animate-pulse lg:col-span-2 bg-gray-100/80 dark:border-gray-800 dark:bg-gray-900/40" />
        </div>
      </main>
    )
  }

  // --- RENDU EN CAS D'ERREUR ---
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50/30 p-6 dark:bg-gray-950">
        <Card className="max-w-md text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-medium text-red-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
          >
            Réessayer
          </button>
        </Card>
      </main>
    )
  }

  // --- RENDU FINAL (DONNÉES CHARGÉES) ---
  return (
    <main className="min-h-screen bg-gray-50/30 p-6 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
      {/* Filtres */}
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

      {/* Grille de cartes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Capacité Planifiée */}
        <Card className="flex flex-col justify-between dark:border-gray-800 dark:bg-gray-900/80">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Capacité Planifiée
            </dt>
            <dd className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              {capacity?.capacityRealHours ?? 0}h
            </dd>
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Heures totales réservées pour l'équipe
          </p>
        </Card>

        {/* Taux d'Occupation Réel */}
        <Card className="flex flex-col justify-between dark:border-gray-800 dark:bg-gray-900/80">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Taux d'Occupation Réel
            </dt>
            <p className="mt-1 text-xs text-gray-400">
              Consommation basée sur la capacité planifiée.
            </p>
          </div>

          <div className="my-auto flex flex-col items-center justify-center py-4 text-center">
            <ProgressCircle
              value={capacity?.occupancyRatePct ?? 0}
              radius={55}
              strokeWidth={7}
            />
            <dd className="mt-3 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              {capacity?.occupancyRatePct ?? 0}%
            </dd>
            <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {capacity?.consumedHours ?? 0}h consommées / {capacity?.capacityRealHours ?? 0}h
            </p>
          </div>
        </Card>

        {/* Avancement du Backlog */}
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

        {/* Ventilation des Tickets */}
        <Card className="lg:col-span-2 dark:border-gray-800 dark:bg-gray-900/80">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Ventilation des Tickets (Jira Issue Types)
              </h2>
              <p className="text-xs text-gray-400">Répartition détaillée du volume de travail par typologie</p>
            </div>
          </div>

          <CategoryBar
            values={[
              workDistribution?.storiesPct || 0,
              workDistribution?.featuresPct || 0,
              workDistribution?.techStoriesPct || 0,
              workDistribution?.bugsPct || 0,
              workDistribution?.tasksPct || 0,
              workDistribution?.spikesPct || 0,
            ]}
            colors={["cyan", "blue", "indigo", "red", "amber", "violet"]}
            showLabels={false}
            className="mt-4"
          />

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6 text-xs">
            <div className="flex items-center gap-2">
              <RiStackLine className="size-4 shrink-0 text-cyan-500" />
              <div>
                <span className="font-semibold text-gray-900 dark:text-gray-50">
                  {workDistribution?.storiesPct ?? 0}%
                </span>
                <p className="text-gray-500 dark:text-gray-400">Stories</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RiCheckDoubleLine className="size-4 shrink-0 text-blue-500" />
              <div>
                <span className="font-semibold text-gray-900 dark:text-gray-50">
                  {workDistribution?.featuresPct ?? 0}%
                </span>
                <p className="text-gray-500 dark:text-gray-400">Fonctionnalités</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RiCodeBoxLine className="size-4 shrink-0 text-indigo-500" />
              <div>
                <span className="font-semibold text-gray-900 dark:text-gray-50">
                  {workDistribution?.techStoriesPct ?? 0}%
                </span>
                <p className="text-gray-500 dark:text-gray-400">Tech Stories</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RiBugLine className="size-4 shrink-0 text-red-500 dark:text-red-400" />
              <div>
                <span className="font-semibold text-gray-900 dark:text-gray-50">
                  {workDistribution?.bugsPct ?? 0}%
                </span>
                <p className="text-gray-500 dark:text-gray-400">Bugs</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RiFileList3Line className="size-4 shrink-0 text-amber-500" />
              <div>
                <span className="font-semibold text-gray-900 dark:text-gray-50">
                  {workDistribution?.tasksPct ?? 0}%
                </span>
                <p className="text-gray-500 dark:text-gray-400">Tâches</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RiSearchEyeLine className="size-4 shrink-0 text-violet-500" />
              <div>
                <span className="font-semibold text-gray-900 dark:text-gray-50">
                  {workDistribution?.spikesPct ?? 0}%
                </span>
                <p className="text-gray-500 dark:text-gray-400">Spikes</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}
