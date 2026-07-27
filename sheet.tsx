modules_data = {
    mod: {
        "jiraEntries": [e for e in raw_jira_entries if e.get("module") == mod] if has_modules else raw_jira_entries,
        "rmEntries": [e for e in raw_rm_entries if e.get("module") == mod] if has_modules else raw_rm_entries,
        "teams": [t for t in raw_teams if t.get("module") == mod] if has_modules else raw_teams,
        "timeSlots": [ts for ts in raw_timeslots if ts.get("module") == mod] if has_modules else raw_timeslots,
        "leavesEntries": [l for l in raw_leaves if l.get("module") == mod] if has_modules else raw_leaves,
    }
    for mod in (detected_modules if has_modules else ["default"])
}
