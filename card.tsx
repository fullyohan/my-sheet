import io
import logging
from openpyxl import load_workbook

# Configuration du logger
logger = logging.getLogger("excel_utils")
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)d] - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)


def get_status_list(file: bytes):
    try:
        logger.info("Début de l'extraction de la liste des statuts Jira.")
        wb = load_workbook(filename=io.BytesIO(file))
        wb = wb.active
        names = []

        for column in wb.iter_cols():
            column_name = column[0].value
            if column_name == "État":
                for i, cell in enumerate(column):
                    if i == 0 or not cell.value:
                        continue
                    names.append(cell.value)

        unique_names = list(set(names))
        logger.info(f"Extraction terminée avec succès : {len(unique_names)} statuts uniques trouvés.")
        return unique_names

    except Exception as e:
        logger.error(
            f"Erreur lors de l'extraction des statuts Jira (ligne {e.__traceback__.tb_lineno}) : {e}",
            exc_info=True
        )
        return []


def get_ressources_list(file: bytes):
    try:
        logger.info("Début de l'extraction de la liste des ressources RM.")
        wb = load_workbook(filename=io.BytesIO(file))
        wb = wb.active
        names = []

        for column in wb.iter_cols():
            column_name = column[0].value
            if column_name == "Team Member":
                for i, cell in enumerate(column):
                    if i == 0 or not cell.value:
                        continue
                    names.append(cell.value)

        unique_names = list(set(names))
        logger.info(f"Extraction terminée avec succès : {len(unique_names)} ressources uniques trouvées.")
        return unique_names

    except Exception as e:
        logger.error(
            f"Erreur lors de l'extraction des ressources RM (ligne {e.__traceback__.tb_lineno}) : {e}",
            exc_info=True
        )
        return []


def get_jira_data(file: bytes, status_mapping):
    try:
        logger.info("Début de la lecture et transformation des données Jira.")
        mapping_status = {
            statut: categorie
            for categorie, liste_statuts in status_mapping.items()
            for statut in liste_statuts
        }
        wb = load_workbook(filename=io.BytesIO(file), read_only=True)
        wb = wb.active

        required_cols = [
            "Clé de ticket",
            "Type de ticket",
            "État",
            "Champs personnalisés (Story Points)",
        ]
        excel_data = list(wb.rows)
        if not excel_data:
            logger.warning("Fichier Excel Jira vide.")
            return []

        col_names = [str(col.value).strip() for col in excel_data[0]]

        json_output = []
        for row in excel_data[1:]:
            values = [
                str(cell.value).strip() if cell.value and str(cell.value) != "None" else ""
                for cell in row
            ]
            
            row_dict = {
                **{
                    name: float(value) if value.replace('.', '', 1).isdigit() else value
                    for name, value in zip(col_names, values)
                    if name in required_cols
                },
                "Tags": [
                    val
                    for name, val in zip(col_names, values)
                    if name and "étiquettes" in str(name).lower() and val != "None" and val != ""
                ],
            }

            sp_val = row_dict.get("Champs personnalisés (Story Points)", 0)
            try:
                row_dict["Champs personnalisés (Story Points)"] = (
                    float(sp_val) if sp_val not in ["None", "", None] else 0.0
                )
            except ValueError:
                row_dict["Champs personnalisés (Story Points)"] = 0.0

            row_dict["État"] = mapping_status.get(row_dict.get("État"))

            json_output.append(row_dict)

        logger.info(f"Parsing Jira terminé : {len(json_output)} tickets traités.")
        return json_output

    except Exception as e:
        logger.error(
            f"Erreur lors du traitement du fichier Jira (ligne {e.__traceback__.tb_lineno}) : {e}",
            exc_info=True
        )
        return []


def get_rm_data(file: bytes):
    try:
        logger.info("Début du traitement des données RM (Resource Management).")
        wb = load_workbook(filename=io.BytesIO(file), read_only=True)
        wb = wb.active
        
        required_cols = [
            "Team Member",
            "Role",
            "Email",
            "Scheduled (hours)",
            "Incurred (hours)",
        ]
        excel_data = list(wb.rows)
        if not excel_data:
            logger.warning("Fichier Excel RM vide.")
            return []

        col_names = [col.value for col in excel_data[0]]

        json_output = []
        for row in excel_data[1:]:
            values = [str(cell.value).strip() for cell in row]
            row_dict = {
                name: value
                for name, value in zip(col_names, values)
                if name in required_cols and value != "None"
            }

            try:
                row_dict["Scheduled (hours)"] = round(
                    float(row_dict.get("Scheduled (hours)", 0) or 0) * 0.8, 1
                )
            except ValueError:
                row_dict["Scheduled (hours)"] = 0.0

            try:
                row_dict["Incurred (hours)"] = round(
                    float(row_dict.get("Incurred (hours)", 0) or 0), 1
                )
            except ValueError:
                row_dict["Incurred (hours)"] = 0.0

            json_output.append(row_dict)

        logger.info(f"Parsing RM terminé : {len(json_output)} entrées traitées.")
        return json_output

    except Exception as e:
        logger.error(
            f"Erreur lors du traitement du fichier RM (ligne {e.__traceback__.tb_lineno}) : {e}",
            exc_info=True
        )
        return []
