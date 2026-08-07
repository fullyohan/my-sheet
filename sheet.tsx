"use client"

import React from "react"
import { CategoryBar } from "./CategoryBar" // Assure-toi du bon chemin d'import
import { AvailableChartColorsKeys } from "@/lib/chartUtils"

export interface TeamDistribution {
  name: string
  pct: number
}

interface TeamsDistributionCardProps {
  teams: TeamDistribution[]
  title?: string
  description?: string
  baseColor?: AvailableChartColorsKeys
}

export function TeamsDistributionCard({
  teams = [],
  title = "Répartition par Équipe",
  description = "Charge globale attribuée par pôle",
  baseColor = "sky",
}: TeamsDistributionCardProps) {
  // Extraction des pourcentages pour le CategoryBar
  const values = teams.map((t) => t.pct)

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
      <!-- Header -->
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
            {title}
          </h2>
          <p className="text-xs text-gray-400 truncate">{description}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          {teams.length} Équipes
        </span>
      </div>

      <!-- CategoryBar avec Opacité Dynamique -->
      <div className="mb-4">
        <CategoryBar
          values={values}
          colors={[baseColor]}
          showLabels={false}
          useDynamicOpacity={true}
        />
      </div>

      <!-- Légende Responsive & Auto-fit (Adaptation dynamique de la taille de texte) -->
      <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
        {teams.map((team, index) => {
          // Même calcul d'opacité que dans CategoryBar pour faire correspondre le badge
          const opacity = Math.max(0.25, 1 - index * 0.1)

          return (
            <div
              key={team.name}
              className="flex max-w-[140px] sm:max-w-[180px] items-center gap-1.5 px-2 py-1 rounded-md border border-gray-200/80 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/40"
            >
              <!-- Pastille de couleur synchro -->
              <span
                className={`size-2 rounded-full shrink-0 bg-${baseColor}-500`}
                style={{ opacity }}
              />
              
              <!-- Nom de l'équipe (Tronqué si trop long pour éviter tout overflow) -->
              <span className="text-gray-600 dark:text-gray-400 truncate">
                {team.name}
              </span>

              <!-- Pourcentage -->
              <span className="font-bold text-gray-900 dark:text-gray-100 ml-auto pl-1">
                {team.pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
