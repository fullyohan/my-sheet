import React from "react"
import { CategoryBar } from "../CategoryBar"
import { Badge } from "../Badge"

interface ProjectTimelineProps {
  startDate: string
  mvpEndDate: string
  crEndDate: string
}

export const ProjectTimelineBar: React.FC<ProjectTimelineProps> = ({
  startDate,
  mvpEndDate,
  crEndDate,
}) => {
  const MS_PER_DAY = 1000 * 60 * 60 * 24

  // Conversion en objets Date
  const start = new Date(startDate)
  const mvp = new Date(mvpEndDate)
  const cr = new Date(crEndDate)
  const today = new Date()

  // Calcul des durées en jours
  const totalDays = Math.round((cr.getTime() - start.getTime()) / MS_PER_DAY)
  const mvpDays = Math.round((mvp.getTime() - start.getTime()) / MS_PER_DAY)
  const crDays = Math.round((cr.getTime() - mvp.getTime()) / MS_PER_DAY)
  const daysElapsed = Math.round((today.getTime() - start.getTime()) / MS_PER_DAY)

  // Validation
  if (totalDays <= 0) {
    return (
      <div className="text-xs text-red-500">
        Dates invalides pour le planning.
      </div>
    )
  }

  // Calcul des pourcentages basés sur le nombre de jours
  const mvpPercentage = Math.round((mvpDays / totalDays) * 100)
  const crPercentage = 100 - mvpPercentage

  let todayPercentage = Math.round((daysElapsed / totalDays) * 100)
  todayPercentage = Math.max(0, Math.min(100, todayPercentage))

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
        <div>
          <span className="block font-normal text-gray-400">Début</span>
          {formatDate(startDate)}
        </div>
        <div className="text-center">
          <span className="block font-normal text-emerald-600">Fin Prévue</span>
          {formatDate(mvpEndDate)}
        </div>
        {mvpEndDate !== crEndDate && (
          <div className="text-right">
            <span className="block font-normal text-amber-600">Fin CR</span>
            {formatDate(crEndDate)}
          </div>
        )}
      </div>

      <CategoryBar
        values={[mvpPercentage, crPercentage]}
        colors={["emerald", "amber"]}
        marker={{
          value: todayPercentage,
          tooltip: `Aujourd'hui (${todayPercentage}%)`,
          showAnimation: true,
        }}
        showLabels={false}
      />

      <div className="flex items-center justify-between pt-1 text-xs">
        <div className="flex items-center space-x-3 text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Phase Prévue
          </span>
          {mvpEndDate !== crEndDate && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
              Extension CR
            </span>
          )}
        </div>

        {crDays > 0 && (
          <Badge variant="success">+{crDays} jours (Impact CR)</Badge>
        )}
      </div>
    </div>
  )
}
