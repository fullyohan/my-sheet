"use client"

import React, { useMemo } from "react"
import { Card } from "@/components/Card"
import { CategoryBar } from "@/components/CategoryBar"
import { RiTeamLine } from "@remixicon/react"

// Types pour la gestion dynamique
type TremorColor = "indigo" | "cyan" | "amber" | "emerald" | "violet" | "rose" | "fuchsia" | "blue"

interface DynamicMember {
  id: string
  role: string
  // Optionnel : si un membre représente plus qu'un ETP (ex: charge/jours)
  weight?: number 
}

// Palette de couleurs pour attribuer dynamiquement une couleur par rôle
const COLOR_PALETTE: TremorColor[] = ["indigo", "cyan", "amber", "emerald", "violet", "rose", "fuchsia", "blue"]
const BG_CLASSES: Record<TremorColor, string> = {
  indigo: "bg-indigo-500",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  fuchsia: "bg-fuchsia-500",
  blue: "bg-blue-500",
}

interface TeamDistributionProps {
  // Accepte n'importe quelle liste d'équipe en prop
  teamMembers?: DynamicMember[]
}

// Exemple de données dynamiques par défaut
const DEFAULT_MEMBERS: DynamicMember[] = [
  { id: "1", role: "Dev Back" },
  { id: "2", role: "Dev Back" },
  { id: "3", role: "Dev Front" },
  { id: "4", role: "QA / Test" },
  { id: "5", role: "Scrum Master" },
  { id: "6", role: "Dev Back" },
]

export function DynamicTeamDistributionCard({ teamMembers = DEFAULT_MEMBERS }: TeamDistributionProps) {
  // Calcul dynamique de la répartition et des pourcentages
  const { values, colors, roleStats } = useMemo(() => {
    if (!teamMembers || teamMembers.length === 0) {
      return { values: [], colors: [], roleStats: [] }
    }

    const totalWeight = teamMembers.reduce((acc, m) => acc + (m.weight || 1), 0)
    
    // Aggrégation par rôle
    const countsByRole = teamMembers.reduce((acc, member) => {
      const w = member.weight || 1
      acc[member.role] = (acc[member.role] || 0) + w
      return acc
    }, {} as Record<string, number>)

    // Transformation en stats avec calcul du pourcentage
    const entries = Object.entries(countsByRole)
    const stats = entries.map(([role, weight], index) => {
      const percentage = Math.round((weight / totalWeight) * 100)
      const color = COLOR_PALETTE[index % COLOR_PALETTE.length]
      return {
        role,
        weight,
        percentage,
        color,
      }
    })

    return {
      values: stats.map((s) => s.percentage),
      colors: stats.map((s) => s.color),
      roleStats: stats,
    }
  }, [teamMembers])

  return (
    <Card className="lg:col-span-3 dark:border-gray-800 dark:bg-gray-900/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiTeamLine className="size-5 shrink-0" style={{ color: "#048890" }} />
          <div>
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Répartition Dynamique de l'Équipe
            </h2>
            <p className="text-xs text-gray-400">Calculé sur {teamMembers.length} membre(s)</p>
          </div>
        </div>
      </div>

      {/* CategoryBar dynamique */}
      {values.length > 0 ? (
        <>
          <CategoryBar
            values={values}
            colors={colors}
            showLabels={false}
            className="mt-4"
          />

          {/* Légende générée à la volée */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            {roleStats.map((item) => (
              <div key={item.role} className="flex items-center gap-2">
                <div className={`size-2.5 rounded-full ${BG_CLASSES[item.color]}`} />
                <div>
                  <span className="font-semibold text-gray-900 dark:text-gray-50">
                    {item.percentage}%
                  </span>
                  <p className="text-gray-500 dark:text-gray-400">{item.role}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-xs text-gray-400">Aucune donnée d'équipe disponible.</p>
      )}
    </Card>
  )
}
