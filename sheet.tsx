// CORPS DE LOVERVIEW
{
  "success": true,
  "teams": "extracted_data.teams",
  
  "capacity": {
    "capacityRealHours": "SUM(rm.capacity)",
    "consumedHours": "SUM(rm.incurred_hours)",
    "occupancyRatePct": "ROUND((consumedHours / capacityRealHours) * 100)"
  },
  
  "backlogProgress": {
    "totalTickets": "COUNT(tickets)",
    "ticketsDone": "COUNT(tickets WHERE status == 'Done')",
    "progressPct": "ROUND((ticketsDone / totalTickets) * 100)",
    
    "totalStoryPoints": "SUM(tickets.story_points)",
    "completedStoryPoints": "SUM(tickets.story_points WHERE status == 'Done')",
    "spProgressPct": "ROUND((completedStoryPoints / totalStoryPoints) * 100)"
  },
  
  "healthAndAlerts": {
    "criticalTicketsCount": "COUNT(tickets WHERE status != 'Done' AND priority IN ['Highest', 'High', 'Critical'])",
    "staleTicketsCount": "COUNT(tickets WHERE status != 'Done' AND updated_at < NOW - 7_DAYS)"
  },
  
  "workDistribution": {
    "featuresPct": "ROUND((COUNT(tickets WHERE type == 'Story') / totalTickets) * 100)",
    "bugsPct": "ROUND((COUNT(tickets WHERE type == 'Bug') / totalTickets) * 100)",
    "maintenancePct": "ROUND((COUNT(tickets WHERE type IN ['Task', 'Technical Debt']) / totalTickets) * 100)"
  }
}



// CORPS DU GRID 
{
  "success": true,
  "timeSlots": ["2026-07-01", "2026-07-02", "2026-07-03"],
  "teams": ["Frontend", "Backend", "QA"],
  
  "resources": [
    {
      "resourceEmail": "dev@company.com",
      "resourceName": "Nom Collaborateur",
      "team": "Frontend",
      
      "quickSummary": {
        "periodCapacity": "SUM(slots.capacity)",
        "periodConsumed": "SUM(slots.consumedHours)",
        "periodOvertime": "periodConsumed - periodCapacity",
        "activeTicketsCount": "COUNT(jira_tickets WHERE status == 'In Progress')"
      },
      
      "calendarSlots": {
        "2026-07-01": {
          "capacity": 8.0,
          "consumedHours": 7.5,
          "leaveType": null,
          "dayStatus": "WORKDAY",
          "activeTasks": [
            {
              "key": "PROJ-101",
              "summary": "Titre du ticket",
              "type": "Story",
              "priority": "High",
              "status": "In Progress"
            }
          ]
        },
        "2026-07-02": {
          "capacity": 0.0,
          "consumedHours": 0.0,
          "leaveType": "PTO",
          "dayStatus": "ON_LEAVE",
          "activeTasks": []
        }
      }
    }
  ]
}


//Corps JSON DU GET /api/resources/{email}/analytics?module_id={module_id}

{
  "success": true,
  "resourceEmail": "dev@company.com",
  "resourceName": "Nom Collaborateur",
  "team": "Frontend",
  "period": {
    "totalCapacity": "SUM(slots.capacity)",
    "totalConsumed": "SUM(slots.consumedHours)",
    "occupancyRatePct": "ROUND((totalConsumed / totalCapacity) * 100)"
  },
  
  "kpis": {
    "velocityAndThroughput": {
      "assignedStoryPoints": "SUM(jira_tickets.story_points WHERE status != 'Done')",
      "completedStoryPoints": "SUM(jira_tickets.story_points WHERE status == 'Done')",
      "throughputTickets": "COUNT(jira_tickets WHERE status == 'Done')",
      "spDeliveryRatePct": "ROUND((completedStoryPoints / (completedStoryPoints + assignedStoryPoints)) * 100)",
      "velocityPerHour": "ROUND(completedStoryPoints / totalConsumed, 2)"
    },
    "estimationAndQuality": {
      "estimationAccuracyPct": "ROUND((totalConsumed / NULLIF(SUM(original_estimate_hours), 0)) * 100)",
      "bugsResolvedCount": "COUNT(jira_tickets WHERE type == 'Bug' AND status == 'Done')",
      "criticalBugsAssigned": "COUNT(jira_tickets WHERE type == 'Bug' AND priority IN ['Critical', 'Highest'] AND status != 'Done')"
    },
    "cycleAndTime": {
      "avgCycleTimeDays": "AVG(jira_tickets.resolved_at - jira_tickets.in_progress_at)",
      "staleTicketsCount": "COUNT(jira_tickets WHERE status == 'In Progress' AND updated_at < NOW - 7_DAYS)"
    }
  },
  
  "assignedTickets": [
    {
      "key": "PROJ-101",
      "summary": "Titre du ticket",
      "type": "Story",
      "priority": "High",
      "status": "In Progress",
      "storyPoints": 5,
      "updatedAt": "2026-07-28T14:30:00Z",
      "isStale": "bool(updatedAt < NOW - 7_DAYS)"
    }
  ]
}



/////////////////////////// MODAL DINFO COLLABO //////////////////////////////////////////
"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog";
import { Card } from "@/components/Card";
import { ProgressCircle } from "@/components/ProgressCircle";
import {
  RiUser3Line,
  RiMailLine,
  RiTeamLine,
  RiSpeedUpLine,
  RiErrorWarningLine,
  RiTimeLine,
  RiLoader4Line,
} from "@remixicon/react";
import axios from "axios";

// TypeScript Interface calquée à 100% sur le JSON Backend validé
interface CollaboratorAnalytics {
  success: boolean;
  resourceEmail: string;
  resourceName: string;
  team: string;
  period: {
    totalCapacity: number;
    totalConsumed: number;
    occupancyRatePct: number;
  };
  kpis: {
    velocityAndThroughput: {
      assignedStoryPoints: number;
      completedStoryPoints: number;
      throughputTickets: number;
      spDeliveryRatePct: number;
      velocityPerHour: number;
    };
    estimationAndQuality: {
      estimationAccuracyPct: number;
      bugsResolvedCount: number;
      criticalBugsAssigned: number;
    };
    cycleAndTime: {
      avgCycleTimeDays: number;
      staleTicketsCount: number;
    };
  };
  assignedTickets?: Array<{
    key: string;
    summary: string;
    type: string;
    priority: string;
    status: string;
    storyPoints: number;
  }>;
}

interface CollaboratorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  collaboratorEmail: string | null;
  moduleId: string | string[];
}

export const CollaboratorDetailModal = ({
  isOpen,
  onClose,
  collaboratorEmail,
  moduleId,
}: CollaboratorDetailModalProps) => {
  const [data, setData] = useState<CollaboratorAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !collaboratorEmail || !moduleId) return;

    const fetchCollaboratorAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get<CollaboratorAnalytics>(
          `http://localhost:8000/api/v1/resources/${encodeURIComponent(
            collaboratorEmail
          )}/analytics`,
          { params: { module_id: moduleId } }
        );
        setData(res.data);
      } catch (err) {
        console.error("Erreur lors de la récupération du profil collaborateur :", err);
        setError("Impossible de charger les analytics de ce collaborateur.");
      } finally {
        setLoading(false);
      }
    };

    fetchCollaboratorAnalytics();
  }, [isOpen, collaboratorEmail, moduleId]);

  const velocity = data?.kpis?.velocityAndThroughput;
  const quality = data?.kpis?.estimationAndQuality;
  const timing = data?.kpis?.cycleAndTime;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto dark:border-gray-800 dark:bg-gray-950">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
              <RiUser3Line className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {data?.resourceName || "Profil Collaborateur"}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1">
                  <RiMailLine className="size-3.5" />
                  {collaboratorEmail || "N/A"}
                </span>
                {data?.team && (
                  <span className="flex items-center gap-1">
                    <RiTeamLine className="size-3.5" />
                    Équipe {data.team}
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-sm text-gray-500">
            <RiLoader4Line className="size-6 animate-spin text-cyan-500" />
            <span>Chargement des métriques du collaborateur...</span>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm font-medium text-red-500">
            {error}
          </div>
        ) : data ? (
          <div className="my-4 flex flex-col gap-4">
            
            {/* RANGÉE 1 : Capacités & Vélocité */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="flex items-center justify-between p-4 dark:border-gray-800 dark:bg-gray-900/80">
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Taux d'occupation
                  </span>
                  <dd className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">
                    {data.period.occupancyRatePct}%
                  </dd>
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    {data.period.totalConsumed}h / {data.period.totalCapacity}h
                  </p>
                </div>
                <ProgressCircle
                  value={data.period.occupancyRatePct}
                  radius={32}
                  strokeWidth={5}
                />
              </Card>

              <Card className="flex flex-col justify-between p-4 dark:border-gray-800 dark:bg-gray-900/80">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Débit & Vélocité
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                    {velocity?.completedStoryPoints ?? 0} SP
                  </span>
                  <span className="text-xs text-gray-400">
                    / {velocity?.assignedStoryPoints ?? 0} SP assignés
                  </span>
                </div>
                <div className="mt-2 flex justify-between text-xs text-cyan-600 dark:text-cyan-400 border-t border-gray-100 pt-2 dark:border-gray-800">
                  <span>Productivité :</span>
                  <span className="font-semibold">
                    {velocity?.velocityPerHour ?? 0} SP / h
                  </span>
                </div>
              </Card>
            </div>

            {/* RANGÉE 2 : Qualité, Bugs & Délais */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200/80 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/60">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <RiSpeedUpLine className="size-4 text-indigo-500" />
                  <span>Cycle Time moyen</span>
                </div>
                <dd className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-50">
                  {timing?.avgCycleTimeDays ?? 0}j
                </dd>
              </div>

              <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 dark:border-red-950/40 dark:bg-red-950/20">
                <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <RiErrorWarningLine className="size-4 shrink-0" />
                  <span>Bugs critiques</span>
                </div>
                <dd className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-50">
                  {quality?.criticalBugsAssigned ?? 0}
                </dd>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 dark:border-amber-950/40 dark:bg-amber-950/20">
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <RiTimeLine className="size-4 shrink-0" />
                  <span>Tickets dormants</span>
                </div>
                <dd className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-50">
                  {timing?.staleTicketsCount ?? 0}
                </dd>
              </div>
            </div>

            {/* RANGÉE 3 : Tâches Assignées */}
            {data.assignedTickets && data.assignedTickets.length > 0 && (
              <div className="mt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Tâches Jira associées ({data.assignedTickets.length})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {data.assignedTickets.map((t) => (
                    <div
                      key={t.key}
                      className="flex items-center justify-between p-2 text-xs rounded-lg border border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/40"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                          {t.key}
                        </span>
                        <span className="truncate text-gray-700 dark:text-gray-300">
                          {t.summary}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-1.5 py-0.5 rounded bg-gray-200/60 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">
                          {t.storyPoints} SP
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 font-semibold">
                          {t.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="mt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};





///////////////////// NOUVELLES CARDS DE KPIS  //////////////////////

import React from "react"
import { Card } from "@/components/Card"
import { CategoryBar } from "@/components/CategoryBar"
import { ProgressCircle } from "@/components/ProgressCircle"
import {
  RiErrorWarningLine,
  RiTimeLine,
  RiCopperCoinLine,
  RiAlertLine,
  RiCheckLine,
} from "@remixicon/react"

// --- TYPES DE CONTEXTE ---
interface HealthAndAlerts {
  criticalTicketsCount: number
  staleTicketsCount: number
}

interface StoryPointsProgress {
  totalStoryPoints: number
  completedStoryPoints: number
  spProgressPct: number
}

// ----------------------------------------------------------------------
// 1. CARD : SANTÉ & ALERTES (Bugs critiques & Tickets dormants)
// ----------------------------------------------------------------------
export function HealthAndAlertsCard({
  healthAndAlerts,
}: {
  healthAndAlerts: HealthAndAlerts | null
}) {
  const critical = healthAndAlerts?.criticalTicketsCount ?? 0
  const stale = healthAndAlerts?.staleTicketsCount ?? 0

  return (
    <Card className="flex flex-col justify-between dark:border-gray-800 dark:bg-gray-900/80">
      <div>
        <div className="flex items-center justify-between">
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Santé & Alertes du Module
          </dt>
          {critical > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-500 border border-red-500/20">
              <RiAlertLine className="size-3.5" /> Action requise
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
              <RiCheckLine className="size-3.5" /> Stable
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 dark:border-red-950/40 dark:bg-red-950/20">
            <div className="flex items-center gap-2 text-xs font-medium text-red-600 dark:text-red-400">
              <RiErrorWarningLine className="size-4 shrink-0" />
              <span>Bugs Critiques</span>
            </div>
            <dd className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
              {critical}
            </dd>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 dark:border-amber-950/40 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
              <RiTimeLine className="size-4 shrink-0" />
              <span>Dormants (&gt;7j)</span>
            </div>
            <dd className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
              {stale}
            </dd>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Tickets nécessitant une déblocage immédiat ou une ré-assignation
      </p>
    </Card>
  )
}

// ----------------------------------------------------------------------
// 2. CARD : PROGRESSION PAR EFFORT RÉEL (Story Points)
// ----------------------------------------------------------------------
export function StoryPointsCard({
  spProgress,
}: {
  spProgress: StoryPointsProgress | null
}) {
  const completed = spProgress?.completedStoryPoints ?? 0
  const total = spProgress?.totalStoryPoints ?? 0
  const pct = spProgress?.spProgressPct ?? 0

  return (
    <Card className="flex flex-col justify-between dark:border-gray-800 dark:bg-gray-900/80">
      <div>
        <div className="flex items-center justify-between">
          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Progression en Story Points (Effort)
          </dt>
          <RiCopperCoinLine className="size-5 text-cyan-500" />
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Avancement réel basé sur la charge estimée.
        </p>
      </div>

      <div className="my-auto flex items-center justify-around py-2">
        <ProgressCircle value={pct} radius={48} strokeWidth={7} />
        <div className="text-right">
          <dd className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            {pct}%
          </dd>
          <p className="mt-1 text-xs font-medium text-cyan-600 dark:text-cyan-400">
            {completed} / {total} SP livrés
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 pt-3 dark:border-gray-800">
        <span>Reste à livrer</span>
        <span className="font-semibold text-gray-900 dark:text-gray-50">
          {Math.max(0, total - completed)} SP
        </span>
      </div>
    </Card>
  )
}

// ----------------------------------------------------------------------
// 3. CARD : RATIO VOLUME VS EFFORT (CategoryBar horizontale)
// ----------------------------------------------------------------------
export function EffortVsVolumeCard({
  ticketProgressPct,
  spProgressPct,
}: {
  ticketProgressPct: number
  spProgressPct: number
}) {
  return (
    <Card className="w-full dark:border-gray-800 dark:bg-gray-900/80">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Comparatif Volume (Tickets) vs Effort (Story Points)
          </h2>
          <p className="text-xs text-gray-400">
            Écart entre le nombre de tickets fermés et la charge réelle complétée
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400">Volume de tickets</span>
            <span className="font-semibold text-emerald-500">{ticketProgressPct}%</span>
          </div>
          <CategoryBar
            values={[ticketProgressPct, 100 - ticketProgressPct]}
            colors={["emerald", "gray"]}
            showLabels={false}
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400">Effort (Story Points)</span>
            <span className="font-semibold text-cyan-500">{spProgressPct}%</span>
          </div>
          <CategoryBar
            values={[spProgressPct, 100 - spProgressPct]}
            colors={["cyan", "gray"]}
            showLabels={false}
          />
        </div>
      </div>
    </Card>
  )
}








