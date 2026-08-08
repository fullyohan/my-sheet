from datetime import datetime
import json
from fastapi import APIRouter, Depends

@router.get("/{project_id}/{module_id}/overview/", dependencies=[Depends(verify_valid_project), Depends(verify_valid_module)])
async def get_overview(project_id: str, module_id: str):
    # 1. Chargement Redis sécurisé
    project_data = json.loads(redis_client.get(f"projects:{project_id}:data") or "{}")
    project_metadata = json.loads(redis_client.get(f"projects:{project_id}:metadata") or "{}")

    # 2. Extraction du module
    module_data = project_data.get(module_id) or {}
    modules_list = project_metadata.get("modules") or []
    module_metadata = next((m for m in modules_list if m.get("id") == module_id), {})

    tickets = module_data.get("jiraEntries") or []
    rm_entries = module_data.get("rmEntries") or []
    total_tickets = len(tickets)
    total_rm = len(rm_entries)

    # 3. Change Requests
    change_requests = [
        t for t in tickets 
        if "ChangeRequest" in (t.get("Tags") or []) and t.get("Type de ticket") == "Story"
    ]
    cr_count = len(change_requests)
    dev_cr_count = len([cr for cr in change_requests if cr.get("État") in ["En test", "En production"]])

    # --- LAMBDAS ---
    get_pct_by_status = lambda status_name: round((len([t for t in tickets if t.get("État") == status_name]) * 100 / total_tickets), 1) if total_tickets else 0.0
    
    get_ticket_sp = lambda status_list: sum(
        float(t.get("Champs personnalisés (Story Points)") or 0) 
        for t in tickets if t.get("État") in status_list
    )

    get_team_members = lambda role_name: [r for r in rm_entries if r.get("Role") == role_name]
    get_team_total_hours = lambda members: sum(float(r.get("Incurred (hours)") or 0) for r in members)

    # 4. Traitement des équipes & budget
    teams = module_metadata.get("teams") or []
    incurred_budget = 0.0

    for t in teams:
        members = get_team_members(t.get("name"))
        team_count = len(members)
        
        t["count"] = team_count
        t["pct"] = round(team_count * 100 / total_rm, 1) if total_rm else 0.0
        
        hours = get_team_total_hours(members)
        tjm = float(t.get("tjm") or 0)
        incurred_budget += hours * tjm

    # 5. Extraction QA, Métriques & calculs pour le Circle Chart
    qa_data = module_metadata.get("qa") or {}
    test_runs = qa_data.get("testRuns") or []
    metrics = qa_data.get("metrics") or {}

    total_tests = sum(int(r.get("nbTest") or 0) for r in test_runs)
    total_ok = sum(int(r.get("nbOk") or 0) for r in test_runs)
    total_bloquant = sum(int(r.get("nbKoBloquant") or 0) for r in test_runs)
    total_majeur = sum(int(r.get("nbKoMajeur") or 0) for r in test_runs)
    total_mineur = sum(int(r.get("nbKoMineur") or 0) for r in test_runs)

    # 6. Métadonnées & Dates
    start_date = module_metadata.get("startDate")
    mvp_end_date = module_metadata.get("mvpEndDate")
    project_total_sp = float(module_metadata.get("totalSp") or 0)
    total_budget = float(module_metadata.get("allocatedBudget") or 0)

    timeline_pct = 0.0
    if start_date and mvp_end_date:
        try:
            d_start = datetime.strptime(start_date, "%Y-%m-%d")
            d_end = datetime.strptime(mvp_end_date, "%Y-%m-%d")
            total_days = (d_end - d_start).days
            if total_days > 0:
                elapsed_days = (datetime.now() - d_start).days
                timeline_pct = round(max(0, min(100, elapsed_days * 100 / total_days)), 1)
        except ValueError:
            pass

    # 7. Réponse finale
    return {
        "startDate": start_date or "N/A",
        "mvpEndDate": mvp_end_date or "N/A",
        "crEndDate": module_metadata.get("crEndDate") or "N/A",
        "teams": teams,
        "backlogProgress": {
            "cr": {
                "count": cr_count,
                "unestimatedCount": len([cr for cr in change_requests if not cr.get("Champs personnalisés (Story Points)")]),
                "devCount": dev_cr_count,
                "devProgressPct": round(dev_cr_count * 100 / cr_count, 1) if cr_count else 0.0
            },
            "workDistribution": {
                "inWritingPct": get_pct_by_status("En écriture"),
                "readyPct": get_pct_by_status("Prêt"),
                "inDevPct": get_pct_by_status("En développement"),
                "inTestPct": get_pct_by_status("En test"),
                "inProdPct": get_pct_by_status("En production"),
            }
        },
        "qaProgress": {
            "circlePct": {
                "directValidationPct": round((total_ok * 100 / total_tests), 1) if total_tests else 0.0,
                "reworkBloquantPct": round((total_bloquant * 100 / total_tests), 1) if total_tests else 0.0,
                "reworkMajeurPct": round((total_majeur * 100 / total_tests), 1) if total_tests else 0.0,
                "reworkMineurPct": round((total_mineur * 100 / total_tests), 1) if total_tests else 0.0,
            },
            "metrics": {
                "securityHotspots": float(metrics.get("securityHotspots") or 0.0),
                "coverage": float(metrics.get("coverage") or 0.0),
                "duplicatedLines": float(metrics.get("duplicatedLines") or 0.0),
                "maintainabilityRating": metrics.get("maintainabilityRating") or "A",
                "reliabilityRating": metrics.get("reliabilityRating") or "A",
                "securityRating": metrics.get("securityRating") or "A"
            }
        },
        "projectProgress": {
            "timelinePct": timeline_pct,
            "consumedPct": round(incurred_budget * 100 / total_budget, 1) if total_budget else 0.0,
            "devPct": round(get_ticket_sp(["En test", "En production"]) * 100 / project_total_sp, 1) if project_total_sp else 0.0,
            "writtingPct": round(get_ticket_sp(["En test", "En production", "Prêt", "En développement"]) * 100 / project_total_sp, 1) if project_total_sp else 0.0
        },
    }
