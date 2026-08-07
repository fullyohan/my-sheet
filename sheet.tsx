"use client"

import React from "react"
import { useSetup } from "../SetupContext"
import { Input } from "@/components/Input"
import { RiShieldCheckLine, RiAddLine, RiDeleteBinLine } from "@remixicon/react"
import { QAData, TestRunItem, TechnicalMetrics } from "../types"

// Valeurs par défaut uniquement visuelles si metrics est vide
const DEFAULT_METRICS: TechnicalMetrics = {
  securityHotspots: "0",
  coverage: "0",
  duplicatedLines: "0",
  maintainabilityRating: "A",
  reliabilityRating: "A",
  securityRating: "A",
}

export default function Step6QualityPage() {
  const { activeModule, updateActiveModule, loading } = useSetup()

  if (!activeModule) {
    return <p className="text-sm text-gray-500">Aucun module actif.</p>
  }

  // Extrait proprement même si activeModule.qa est null
  const qa: QAData | null = activeModule.qa
  const testRuns: TestRunItem[] = qa?.testRuns ?? []
  const metrics: TechnicalMetrics = qa?.metrics ?? DEFAULT_METRICS

  // Helper centralisé pour mettre à jour le QA
  const updateQA = (newQa: QAData) => {
    updateActiveModule({ qa: newQa })
  }

  // --- Handlers Test Runs ---
  const handleUpdateTestRun = (
    id: string,
    field: keyof TestRunItem,
    value: string
  ) => {
    const updatedRuns = testRuns.map((row) =>
      row.id === id ? { ...row, [field]: value } : row
    )
    updateQA({ testRuns: updatedRuns, metrics })
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
    updateQA({ testRuns: [...testRuns, newRun], metrics })
  }

  const handleRemoveTestRun = (id: string) => {
    updateQA({
      testRuns: testRuns.filter((row) => row.id !== id),
      metrics,
    })
  }

  // --- Handlers Metrics ---
  const handleUpdateMetric = (
    field: keyof TechnicalMetrics,
    value: string
  ) => {
    updateQA({
      testRuns,
      metrics: { ...metrics, [field]: value },
    })
  }

  // Calcul des totaux des tests
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
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
            <RiShieldCheckLine className="size-4 text-[#048890]" />
            Recette & Qualité - {activeModule.name || `Module ${activeModule.id}`}
          </h3>
          <p className="text-xs text-gray-500">
            Saisie des campagnes de tests et des métriques SonarQube pour ce module.
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

      {/* Section 1 : Campagnes de Recette */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Campagnes de Recette
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={handleAddTestRun}
            className="flex items-center gap-1 rounded-md bg-[#048890]/10 px-2 py-0.5 text-xs font-semibold text-[#048890] hover:bg-[#048890]/20 disabled:opacity-50"
          >
            <RiAddLine className="size-3.5" />
            Ajouter une date
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50">
                <th className="w-36 p-2 font-semibold text-gray-600 dark:text-gray-400">Date</th>
                <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">Nb test</th>
                <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">Nb OK</th>
                <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">KO Bloquant</th>
                <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">KO Majeur</th>
                <th className="p-2 font-semibold text-gray-600 dark:text-gray-400">KO Mineur</th>
                <th className="w-8 p-2"></th>
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
                <td></td>
              </tr>

              {testRuns.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-900/30">
                  <td className="p-1.5">
                    <Input
                      type="date"
                      disabled={loading}
                      value={row.date}
                      onChange={(e) => handleUpdateTestRun(row.id, "date", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      disabled={loading}
                      value={row.nbTest}
                      onChange={(e) => handleUpdateTestRun(row.id, "nbTest", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      disabled={loading}
                      value={row.nbOk}
                      onChange={(e) => handleUpdateTestRun(row.id, "nbOk", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      disabled={loading}
                      value={row.nbKoBloquant}
                      onChange={(e) => handleUpdateTestRun(row.id, "nbKoBloquant", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      disabled={loading}
                      value={row.nbKoMajeur}
                      onChange={(e) => handleUpdateTestRun(row.id, "nbKoMajeur", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      disabled={loading}
                      value={row.nbKoMineur}
                      onChange={(e) => handleUpdateTestRun(row.id, "nbKoMineur", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleRemoveTestRun(row.id)}
                      className="text-gray-400 hover:text-rose-500 disabled:opacity-50"
                      title="Supprimer la ligne"
                    >
                      <RiDeleteBinLine className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800" />

      {/* Section 2 : Indicateurs Techniques */}
      <div className="space-y-3">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          Indicateurs Techniques (SonarQube)
        </span>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
          <div className="space-y-2.5">
            <div>
              <label className="mb-1 block text-gray-500 dark:text-gray-400">
                Security Hotspots Reviewed
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={loading}
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
              <label className="mb-1 block text-gray-500 dark:text-gray-400">
                Coverage
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={loading}
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
              <label className="mb-1 block text-gray-500 dark:text-gray-400">
                Duplicated Lines
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={loading}
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

          <div className="space-y-2.5">
            {(
              [
                { key: "maintainabilityRating", label: "Maintainability Rating" },
                { key: "reliabilityRating", label: "Reliability Rating" },
                { key: "securityRating", label: "Security Rating" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key}>
                <label className="mb-1 block text-gray-500 dark:text-gray-400">
                  {label}
                </label>
                <select
                  disabled={loading}
                  value={metrics[key]}
                  onChange={(e) =>
                    handleUpdateMetric(key, e.target.value as TechnicalMetrics[typeof key])
                  }
                  className="h-8 w-full rounded-md border border-gray-200 bg-transparent px-2 font-mono text-xs font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#048890] dark:border-gray-800 dark:text-gray-100"
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
    </div>
  )
}
