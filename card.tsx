from datetime import datetime
import json
from fastapi import APIRouter, Depends, HTTPException, status

@router.get("/{project_id}/{module_id}/overview/", dependencies=[Depends(verify_valid_project), Depends(verify_valid_module)])
async def get_overview(project_id: str, module_id: str):
    # 1. Récupération sécurisée depuis Redis (support des données non encore créées)
    raw_project_data = redis_client.get(f"projects:{project_id}:data")
    raw_project_metadata = redis_client.get(f"projects:{project_id}:metadata")

    project_data = json.loads(raw_project_data) if raw_project_data else {}
    project_metadata = json.loads(raw_project_metadata) if raw_project_metadata else {}

    # Extraction sécurisée du module dans metadata et data
    modules_list = project_metadata.get("modules", [])
    module_metadata = next((m for m in modules_list if m.get("id") == module_id), {})
    module_data = project_data.get(module_id) or {}

    # 2. Sécurisation des données Jira & RM (si pas encore importées = liste vide)
    tickets = module_data.get("jiraEntries") or []
    rm_entries = module_data.get("rmEntries") or []

    total_tickets = len(tickets)
    total_rm = len(rm_entries)

    # 3. Traitement des Change Requests (Tags + Type)
    change_requests = [
        t for t in tickets 
        if isinstance(t.get("Tags"), str) and "ChangeRequest" in t.get("Tags") and t.get("Type de ticket") == "Story"
    ] if tickets else []

    cr_count = len(change_requests)
    dev_cr_count = len([cr for cr in change_requests if cr.get("État") in ["En test", "En production"]])

    # Lambdas sécurisées contre les divisions par zéro
    def get_pct_by_status(status_name: str) -> float:
        if not total_tickets:
            return 0.0
        matching = len([t for t in tickets if t.get("État") == status_name])
        return round((matching / total_tickets) * 100, 1)

    def get_ticket_sp(status_list: list) -> float:
        if not tickets:
            return 0.0
        return sum([
            float(t.get("Champs personnalisés (Story Points)") or 0) 
            for t in tickets if t.get("État") in status_list
        ])

    # 4. Traitement des Équipes & Budget RM (Correction du bug team_name)
    teams = module_metadata.get("teams") or []
    incurred_budget = 0.0

    for team in teams:
        team_name = team.get("name")
        # Filtrage par NOM d'équipe (Role) et non par nombre
        team_members = [r for r in rm_entries if r.get("Role") == team_name]
        team_count = len(team_members)
        
        # Somme des heures pour l'équipe
        team_hours = sum([float(r.get("Incurred (hours)") or 0) for r in team_members])
        tjm = float(team.get("tjm") or 0)

        team["count"] = team_count
        team["pct"] = round((team_count * 100 / total_rm), 1) if total_rm > 0 else 0.0
        
        incurred_budget += round(team_hours * tjm, 1)

    # 5. Extraction sécurisée des métadonnées numériques et dates
    start_date_str = module_metadata.get("startDate")
    mvp_end_date_str = module_metadata.get("mvpEndDate")

    try:
        project_total_sp = float(module_metadata.get("totalSp") or 0)
    except (ValueError, TypeError):
        project_total_sp = 0.0

    try:
        total_budget = float(module_metadata.get("allocatedBudget") or 0)
    except (ValueError, TypeError):
        total_budget = 0.0

    # 6. Calculs des pourcentages de progression
    timeline_pct = 0.0
    if start_date_str and mvp_end_date_str:
        try:
            d_start = datetime.strptime(start_date_str, "%Y-%m-%d")
            d_end = datetime.strptime(mvp_end_date_str, "%Y-%m-%d")
            total_days = (d_end - d_start).days

            if total_days > 0:
                elapsed_days = (datetime.now() - d_start).days
                # Borne la timeline entre 0 et 100%
                timeline_pct = round(max(0, min(100, (elapsed_days * 100 / total_days))), 1)
        except (ValueError, TypeError):
            timeline_pct = 0.0

    consumed_pct = round((incurred_budget * 100 / total_budget), 1) if total_budget > 0 else 0.0

    dev_sp = get_ticket_sp(["En test", "En production"])
    writing_sp = get_ticket_sp(["En test", "En production", "Prêt", "En développement"])

    dev_pct = round((dev_sp * 100 / project_total_sp), 1) if project_total_sp > 0 else 0.0
    writing_pct = round((writing_sp * 100 / project_total_sp), 1) if project_total_sp > 0 else 0.0

    # 7. Payload de retour unifié
    return {
        "startDate": start_date_str or "N/A",
        "mvpEndDate": mvp_end_date_str or "N/A",
        "crEndDate": module_metadata.get("crEndDate") or "N/A",
        "teams": teams,
        "backlogProgress": {
            "cr": {
                "count": cr_count,
                "unestimatedCount": len([
                    cr for cr in change_requests 
                    if not cr.get("Champs personnalisés (Story Points)")
                ]),
                "devCount": dev_cr_count,
                "devProgressPct": round((dev_cr_count * 100 / cr_count), 1) if cr_count > 0 else 0.0
            },
            "workDistribution": {
                "inWritingPct": get_pct_by_status("En écriture"),
                "readyPct": get_pct_by_status("Prêt"),
                "inDevPct": get_pct_by_status("En développement"),
                "inTestPct": get_pct_by_status("En test"),
                "inProdPct": get_pct_by_status("En production"),
            }
        },
        "projectProgress": {
            "timelinePct": timeline_pct,
            "consumedPct": consumed_pct,
            "devPct": dev_pct,
            "writtingPct": writing_pct
        }
    }
