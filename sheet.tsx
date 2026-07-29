total_tickets = len(tickets)
total_done = len(tickets_done)

def get_pct(ticket_types):
    if not total_tickets:
        return 0
    count = len([t for t in tickets if t.get("Type de ticket") in ticket_types])
    return round((count / total_tickets) * 100)

return {
    "success": True,
    "teams": extracted_data.get("teams", []),
    "capacity": {
        "capacityRealHours": capacity_real_hours,
        "consumedHours": consumed_hours,
        "occupancyRatePct": round((consumed_hours / capacity_real_hours) * 100) if capacity_real_hours else 0,
    },
    "backlogProgress": {
        "totalTickets": total_tickets,
        "ticketsDone": total_done,
        "progressPct": round((total_done / total_tickets) * 100) if total_tickets else 0
    },
    "workDistribution": {
        "storiesPct": get_pct(["Story"]),
        "featuresPct": get_pct(["Fonctionnalité", "Feature"]),
        "techStoriesPct": get_pct(["Tech Story"]),
        "bugsPct": get_pct(["Bug"]),
        "tasksPct": get_pct(["Task"]),
        "spikesPct": get_pct(["Spike"])
    }
}
