import React from "react";
import { DonutChart } from "@tremor/react";

const dataRecipeKpi = [
  { name: "% Validation Directe", percentage: 98.0 },
  { name: "% Rework Majeur", percentage: 1.8 },
  { name: "% Rework Mineure", percentage: 0.2 },
];

export const RecipeKpiCard = () => {
  return (
    <div className="w-full max-w-sm p-5 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
      {/* Titre du KPI */}
      <h3 className="text-sm font-bold text-cyan-900 mb-4">
        KPI recette (% test)
      </h3>

      {/* Camembert / DonutChart Tremor */}
      <DonutChart
        data={dataRecipeKpi}
        variant="pie"
        category="name"
        value="percentage"
        colors={["emerald", "rose", "pink"]}
        valueFormatter={(number: number) => `${number.toFixed(1)}%`}
        showAnimation={true}
        className="h-44 w-44"
      />

      {/* Légende en bas (Pas d'anomalie bloquante) */}
      <p className="mt-4 text-xs font-semibold text-gray-700">
        Pas d'anomalie bloquante
      </p>
    </div>
  );
};
