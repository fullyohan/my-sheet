"use client"

import React from "react"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { Button } from "@/components/Button"
import { RiAddLine, RiDeleteBinLine, RiMoneyEuroBoxLine } from "@remixicon/react"

export interface RoleRateItem {
  id: string
  roleName: string
  dailyRate: number | string
  assigneeName: string
}

interface RoleRateSectionProps {
  items: RoleRateItem[]
  onChange: (items: RoleRateItem[]) => void
  disabled?: boolean
}

export default function RoleRateSection({
  items,
  onChange,
  disabled = false,
}: RoleRateSectionProps) {
  const handleAddRow = () => {
    onChange([
      ...items,
      { id: Date.now().toString(), roleName: "", dailyRate: "", assigneeName: "" },
    ])
  }

  const handleUpdateRow = (
    id: string,
    field: keyof RoleRateItem,
    value: string | number
  ) => {
    onChange(
      items.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    )
  }

  const handleDeleteRow = (id: string) => {
    onChange(items.filter((row) => row.id !== id))
  }

  const totalRates = items.reduce((acc, curr) => acc + (Number(curr.dailyRate) || 0), 0)
  const avgRate = items.length > 0 ? (totalRates / items.length).toFixed(0) : 0

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <RiMoneyEuroBoxLine className="size-4 text-[#048890]" />
            Correspondance des Rôles & Tarifs (TJM)
          </h3>
          <p className="text-xs text-gray-500">
            Définissez les rôles de l'équipe, leur coût journalier et la personne assignée.
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

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50">
              <th className="p-2.5 font-semibold text-gray-600 dark:text-gray-400">Rôle / Poste</th>
              <th className="p-2.5 font-semibold text-gray-600 dark:text-gray-400">TJM (€ / jour)</th>
              <th className="p-2.5 font-semibold text-gray-600 dark:text-gray-400">Assigné à</th>
              <th className="p-2.5 text-right font-semibold text-gray-600 dark:text-gray-400">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-900/30">
                <td className="p-2">
                  <Input
                    type="text"
                    disabled={disabled}
                    value={row.roleName}
                    onChange={(e) => handleUpdateRow(row.id, "roleName", e.target.value)}
                    placeholder="ex: Dev Fullstack"
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-2 w-36">
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      disabled={disabled}
                      value={row.dailyRate}
                      onChange={(e) => handleUpdateRow(row.id, "dailyRate", e.target.value)}
                      placeholder="500"
                      className="h-8 pr-7 text-xs font-mono"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-gray-400">
                      €
                    </span>
                  </div>
                </td>
                <td className="p-2">
                  <Input
                    type="text"
                    disabled={disabled}
                    value={row.assigneeName}
                    onChange={(e) => handleUpdateRow(row.id, "assigneeName", e.target.value)}
                    placeholder="ex: Alex Dupont"
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-2 text-right">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleDeleteRow(row.id)}
                    className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/30"
                  >
                    <RiDeleteBinLine className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center pt-2">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={handleAddRow}
          className="flex items-center gap-1.5 text-xs h-8"
        >
          <RiAddLine className="size-4" /> Ajouter un rôle
        </Button>

        <span className="text-[11px] text-gray-400 font-mono">
          Total d'équipe: {items.length} personne(s)
        </span>
      </div>
    </Card>
  )
}
