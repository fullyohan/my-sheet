"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useSetup } from "../layout"
import { Input } from "@/components/Input"
import { Button } from "@/components/Button"
import { TeamsRateItem } from "../types"
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiMoneyEuroBoxLine,
} from "@remixicon/react"

export default function Step4Page() {
  const router = useRouter()
  const { activeModule, updateActiveModule, loading } = useSetup()

  if (!activeModule) return null

  const items: TeamsRateItem[] = activeModule.teams || []

  // Handler pour mettre à jour le TJM d'une ligne
  const handleUpdateRow = (
    id: string,
    field: keyof TeamsRateItem,
    value: string
  ) => {
    const updated = items.map((row) =>
      row.id === id ? { ...row, [field]: value } : row
    )
    updateActiveModule({ teams: updated })
  }

  // Calculs dérivés pour les stats
  const totalRates = items.reduce(
    (acc, curr) => acc + (Number(curr.tjm) || 0),
    0
  )
  const avgRate =
    items.length > 0 ? (totalRates / items.length).toFixed(0) : "0"

  return (
    <div className="space-y-6">
      {/* En-tête de la page */}
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
          Rôles & Tarifs (TJM) :{" "}
          <span className="text-[#048890]">{activeModule.name}</span>
        </h2>
        <p className="text-xs text-gray-500">
          Ajustez les coûts journaliers moyens (TJM) pour chaque profil de l'équipe extrait du fichier RM.
        </p>
      </div>

      {/* BLOC TJM & TABLEAU INLINÉ */}
      <div className="rounded-lg border border-gray-100 p-6 space-y-4 dark:border-gray-800">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <RiMoneyEuroBoxLine className="size-4 text-[#048890]" />
              Correspondance des Rôles & Tarifs
            </h3>
            <p className="text-xs text-gray-500">
              Définissez les rôles de l'équipe et leur coût journalier.
            </p>
          </div>

          <div className="text-right">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              TJM Moyen
            </span>
            <span className="font-mono text-sm font-bold text-[#048890]">
              {avgRate} € / jour
            </span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            Aucune équipe détectée. Assurez-vous d'avoir importé un fichier RM valide à l'étape 3.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50">
                  <th className="p-2.5 font-semibold text-gray-600 dark:text-gray-400">
                    Rôle / Poste
                  </th>
                  <th className="p-2.5 font-semibold text-gray-600 dark:text-gray-400">
                    TJM (€ / jour)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50/30 dark:hover:bg-gray-900/30"
                  >
                    <td className="p-2">
                      <Input
                        type="text"
                        disabled
                        value={row.name}
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="p-2 w-[40%]">
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          value={row.tjm}
                          onChange={(e) =>
                            handleUpdateRow(row.id, "tjm", e.target.value)
                          }
                          placeholder="500"
                          className="h-8 pr-7 text-xs font-mono"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-gray-400">
                          €
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <span className="text-[11px] text-gray-400 font-mono">
            Total d'équipe: {items.length} personne(s)
          </span>
        </div>
      </div>

      {/* NAVIGATION FOOTER */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("./step-3")}
          disabled={loading}
        >
          <RiArrowLeftLine className="mr-1.5 size-4" /> Précédent
        </Button>

        <Button
          type="button"
          className="bg-[#048890] hover:bg-[#036c73]"
          onClick={() => router.push("./step-5")}
          disabled={loading}
        >
          Suivant
          <RiArrowRightLine className="ml-1.5 size-4" />
        </Button>
      </div>
    </div>
  )
}
