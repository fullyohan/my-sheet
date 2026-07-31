import React from 'react';
import { CategoryBar } from '@tremor/react';

interface ProjectTimelineProps {
  startDate: string;   // Ex: "2025-11-14"
  mvpEndDate: string;  // Ex: "2026-07-31" (Fin prévue)
  crEndDate: string;   // Ex: "2026-08-31" (Fin avec CR)
}

export const ProjectTimelineBar: React.FC<ProjectTimelineProps> = ({
  startDate,
  mvpEndDate,
  crEndDate,
}) => {
  // 1. Conversion des dates en Timestamp
  const start = new Date(startDate).getTime();
  const mvp = new Date(mvpEndDate).getTime();
  const cr = new Date(crEndDate).getTime();
  const today = new Date().getTime();

  // 2. Calcul des durées (en millisecondes)
  const totalDuration = cr - start;
  const mvpDuration = mvp - start;
  const crDuration = cr - mvp;

  // Sécurité si les dates sont invalides ou dans le mauvais ordre
  if (totalDuration <= 0) {
    return <div className="text-xs text-red-500">Dates invalides pour le planning.</div>;
  }

  // 3. Calcul des pourcentages pour la CategoryBar
  const mvpPercentage = Math.round((mvpDuration / totalDuration) * 100);
  const crPercentage = 100 - mvpPercentage;

  // 4. Calcul de l'avancement actuel (Marqueur "Aujourd'hui")
  let todayPercentage = Math.round(((today - start) / totalDuration) * 100);
  todayPercentage = Math.max(0, Math.min(100, todayPercentage)); // Borne entre 0 et 100%

  // 5. Calcul de l'impact CR en jours
  const extensionDays = Math.round(crDuration / (1000 * 60 * 60 * 24));

  // Formatage des dates pour l'affichage (ex: 14 nov. 2025)
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="w-full max-w-xl p-4 bg-white rounded-xl shadow-sm border border-gray-100 space-y-3">
      {/* En-tête : Les jalons de date */}
      <div className="flex justify-between items-center text-xs font-semibold text-gray-600">
        <div>
          <span className="block text-gray-400 font-normal">Début</span>
          {formatDate(startDate)}
        </div>
        <div className="text-center">
          <span className="block text-amber-600 font-normal">Fin Prévue</span>
          {formatDate(mvpEndDate)}
        </div>
        <div className="text-right">
          <span className="block text-emerald-600 font-normal">Fin CR</span>
          {formatDate(crEndDate)}
        </div>
      </div>

      {/* Barre Tremor / Custom CategoryBar */}
      <CategoryBar
        values={[mvpPercentage, crPercentage]}
        colors={["amber", "emerald"]}
        marker={{
          value: todayPercentage,
          tooltip: `Aujourd'hui (${todayPercentage}%)`,
          showAnimation: true,
        }}
        className="mx-auto"
      />

      {/* Pied de composant : Légende + Impact CR */}
      <div className="flex items-center justify-between text-xs pt-1">
        <div className="flex items-center space-x-3 text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            Phase Prévue ({mvpPercentage}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Extension CR ({crPercentage}%)
          </span>
        </div>

        {extensionDays > 0 && (
          <span className="px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
            +{extensionDays} jours (Impact CR)
          </span>
        )}
      </div>
    </div>
  );
};
