"use client"

import React from "react"
import { Input } from "@/components/Input"
import { RiShieldCheckLine, RiAddLine, RiDeleteBinLine } from "@remixicon/react"

export interface TestRunItem {
  id: string
  date: string
  nbTest: string
  nbOk: string
  nbKoBloquant: string
  nbKoMajeur: string
  nbKoMineur: string
}

export interface TechnicalMetrics {
  securityHotspots: string
  coverage: string
  duplicatedLines: string
  maintainabilityRating: "A" | "B" | "C" | "D" | "E"
  reliabilityRating: "A" | "B" | "C" | "D" | "E"
  securityRating: "A" | "B" | "C" | "D" | "E"
}

export interface QualityAndTestingData {
  testRuns: TestRunItem[]
  metrics: TechnicalMetrics
}

interface RecipeAndQualitySectionProps {
  data: QualityAndTestingData
  onChange: (data: QualityAndTestingData) => void
  disabled?: boolean
}

export default function RecipeAndQualitySection({
  data,
  onChange,
  disabled = false,
}: RecipeAndQualitySectionProps) {
  const { testRuns, metrics } = data

  // --- Handlers Tests ---
  const handleUpdateTestRun = (
    id: string,
    field: keyof TestRunItem,
    value: string
  ) => {
    const updatedRuns = testRuns.map((row) =>
      row.id === id ? { ...row, [field]: value } : row
    )
    onChange({ ...data, testRuns: updatedRuns })
  }

  const handleAddTestRun = () => {
    const newRun: TestRunItem = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      nbTest: "0",
      nbOk: "0",
      nbKoBloquant: "0",
      nbKoMajeur: "0",
      nbKoMineur: "0",
    }
    onChange({ ...data, testRuns: [...testRuns, newRun] })
  }

  const handleRemoveTestRun = (id: string) => {
    onChange({
      ...data,
      testRuns: testRuns.filter((row) => row.id !== id),
    })
  }

  // --- Handlers Metrics ---
  const handleUpdateMetric = (
    field: keyof TechnicalMetrics,
    value: string
  ) => {
    onChange({
      ...data,
      metrics: { ...metrics, [field]: value },
    })
  }

  // Calculs auto pour la partie tests
  const totals = testRuns.reduce(
    (acc, curr) => ({
      tests: acc.tests + (Number(curr.nbTest) || 0),
      ok: acc.ok + (Number(curr.nbOk) || 0),
      bloquant: acc.bloquant + (Number(curr.nbKoBloquant) || 0),
      majeur: acc.majeur + (Number(curr.nbKoMajeur) || 0),
      mineur: acc.mineur + (Number(curr.nbKoMineur) || 0),
    }),
    { tests: 0, ok: 0, bloquant: 0, majeur: 0, mineur: 0 }
  )

  const successRate =
    totals.tests > 0 ? ((totals.ok / totals.tests) * 100).toFixed(1) : "0.0"

  return (
    <div className="p-6 space-y-6">
      {/* En-tête de la section */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <RiShieldCheckLine className="size-4 text-[#048890]" />
            Indicateurs de Recette & Qualité
          </h3>
          <p className="text-xs text-gray-500">
            Suivi des campagnes de tests d'exécution et métriques techniques SonarQube.
          </p>
        </div>

        <div className="flex items-center gap-6 text-right">
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Taux de Réussite
            </span>
            <span className="font-mono text-sm font-bold text-[#048890]">
              {successRate} %
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Couverture
            </span>
            <span className="font-mono text-sm font-bold text-[#048890]">
              {metrics.coverage || "0"} %
            </span>
          </div>
        </div>
      </div>

      {/* SOUS-PARTIE 1 : Campagnes de Tests */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Campagnes de Recette
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={handleAddTestRun}
              className="flex items-center gap-1 rounded-md bg-[#048890]/10 px-2 py-0.5 text-xs font-semibold text-[#048890] hover:bg-[#048890]/20 transition-colors"
            >
              <RiAddLine className="size-3.5" />
              Ajouter une date
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50">
                <th className="p-2 font-semibold text-gray-600 dark:text-gray-400 w-36">Date</th>
                <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">Nb test</th>
                <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">Nb OK</th>
                <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">KO Bloquant</th>
                <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">KO Majeur</th>
                <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">KO Mineur</th>
                {!disabled && <th className="p-2 w-8"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              <tr className="bg-gray-50/80 font-mono font-bold dark:bg-gray-900/80">
                <td className="p-2 text-gray-900 dark:text-gray-100">Total</td>
                <td className="p-2 text-gray-900 dark:text-gray-100">{totals.tests}</td>
                <td className="p-2 text-emerald-600 dark:text-emerald-400">{totals.ok}</td>
                <td className="p-2 text-rose-600 dark:text-rose-400">{totals.bloquant}</td>
                <td className="p-2 text-amber-600 dark:text-amber-400">{totals.majeur}</td>
                <td className="p-2 text-gray-600 dark:text-gray-400">{totals.mineur}</td>
                {!disabled && <td></td>}
              </tr>

              {testRuns.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-900/30">
                  <td className="p-1.5">
                    <Input
                      type="date"
                      disabled={disabled}
                      value={row.date}
                      onChange={(e) => handleUpdateTestRun(row.id, "date", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      disabled={disabled}
                      value={row.nbTest}
                      onChange={(e) => handleUpdateTestRun(row.id, "nbTest", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      disabled={disabled}
                      value={row.nbOk}
                      onChange={(e) => handleUpdateTestRun(row.id, "nbOk", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      disabled={disabled}
                      value={row.nbKoBloquant}
                      onChange={(e) => handleUpdateTestRun(row.id, "nbKoBloquant", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      disabled={disabled}
                      value={row.nbKoMajeur}
                      onChange={(e) => handleUpdateTestRun(row.id, "nbKoMajeur", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      disabled={disabled}
                      value={row.nbKoMineur}
                      onChange={(e) => handleUpdateTestRun(row.id, "nbKoMineur", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </td>
                  {!disabled && (
                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveTestRun(row.id)}
                        className="text-gray-400 hover:text-rose-500 transition-colors"
                        title="Supprimer la ligne"
                      >
                        <RiDeleteBinLine className="size-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 pt-4" />

      {/* SOUS-PARTIE 2 : Indicateurs Techniques (SonarQube) */}
      <div className="space-y-3">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          Indicateurs Techniques
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Pourcentages */}
          <div className="space-y-2.5">
            <div>
              <label className="block text-gray-500 dark:text-gray-400 mb-1">
                Security Hotspots Reviewed
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={disabled}
                  value={metrics.securityHotspots}
                  onChange={(e) => handleUpdateMetric("securityHotspots", e.target.value)}
                  className="h-8 pr-7 text-xs font-mono"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-gray-400">
                  %
                </span>
              </div>
            </div>

            <div>
              <label className="block text-gray-500 dark:text-gray-400 mb-1">
                Coverage
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={disabled}
                  value={metrics.coverage}
                  onChange={(e) => handleUpdateMetric("coverage", e.target.value)}
                  className="h-8 pr-7 text-xs font-mono"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-gray-400">
                  %
                </span>
              </div>
            </div>

            <div>
              <label className="block text-gray-500 dark:text-gray-400 mb-1">
                Duplicated Lines
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={disabled}
                  value={metrics.duplicatedLines}
                  onChange={(e) => handleUpdateMetric("duplicatedLines", e.target.value)}
                  className="h-8 pr-7 text-xs font-mono"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-gray-400">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Ratings */}
          <div className="space-y-2.5">
            {(
              [
                { key: "maintainabilityRating", label: "Maintainability Rating" },
                { key: "reliabilityRating", label: "Reliability Rating" },
                { key: "securityRating", label: "Security Rating" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key}>
                <label className="block text-gray-500 dark:text-gray-400 mb-1">
                  {label}
                </label>
                <select
                  disabled={disabled}
                  value={metrics[key]}
                  onChange={(e) => handleUpdateMetric(key, e.target.value)}
                  className="h-8 w-full rounded-md border border-gray-200 bg-transparent px-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#048890] dark:border-gray-800 dark:text-gray-100"
                >
                  {["A", "B", "C", "D", "E"].map((rating) => (
                    <option key={rating} value={rating} className="dark:bg-gray-900">
                      {rating}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400 font-mono">
        <span>Campagnes saisies: {testRuns.length}</span>
        <span>Standard Qualité: SonarQube</span>
      </div>
    </div>
  )
}
