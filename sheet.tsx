# 1. Tu groupes tes clés par valeur
groupes_statuts = {
    "1_En écriture": [
        "Nouveau",
        "Brouillon",
        "A designer",
        "En design",
        "Review design",
        "Relecture",
        "Mature",
        "A estimer",
    ],
    "2_Prêt": ["Prêt"],
    "3_En développement": ["En cours", "Restitution"],
    "4_En test": [
        "Validation technique",
        "A livrer dev",
        "Validation fonctionnelle",
        "Validation K.O.",
        "A livrer int",
        "Prêt pour deploiement int",
        "A recetter INT",
        "Test à automatiser",
        "A livrer en prod",
        "KO a livrer en prod",
    ],
    "5_En prod": ["Livrée en prod", "KO livrée en prod", "Terminé"],
    "0_Annulé": ["Annulé"],
}

# 2. Tu génères le dictionnaire final automatiquement
mapping_statuts = {
    statut: categorie
    for categorie, liste_statuts in groupes_statuts.items()
    for statut in liste_statuts
}
