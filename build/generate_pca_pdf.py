"""
Génération du document PDF : Plan de Continuité d'Activité (PCA) — mobiTrace / DGFiP
Polices : DejaVu (Unicode TTF) pour la gestion des caractères français et symboles
"""
from fpdf import FPDF
from fpdf.enums import XPos, YPos
from datetime import date

FONT_DIR  = "/usr/share/fonts/truetype/dejavu/"
MONO_DIR  = FONT_DIR

BLUE_DARK   = (0,   0,  145)
BLUE_MED    = (0,  91, 187)
BLUE_LIGHT  = (224, 232, 255)
GREEN_OK    = ( 24, 128,  56)
ORANGE_WARN = (200, 110,  10)
PURPLE      = (100,  50, 150)
GREY_LIGHT  = (246, 246, 246)
GREY_BORDER = (204, 204, 204)
BLACK       = (  0,   0,   0)
WHITE       = (255, 255, 255)

MARGIN_L  = 18
MARGIN_R  = 18
PAGE_W    = 210
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

TODAY = date.today().strftime("%d/%m/%Y")


class PDF(FPDF):

    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(MARGIN_L, 22, MARGIN_R)
        self.set_auto_page_break(auto=True, margin=18)
        self.add_font("Sans",  "",   FONT_DIR + "DejaVuSans.ttf")
        self.add_font("Sans",  "B",  FONT_DIR + "DejaVuSans-Bold.ttf")
        self.add_font("Sans",  "I",  FONT_DIR + "DejaVuSans-Oblique.ttf")
        self.add_font("Sans",  "BI", FONT_DIR + "DejaVuSans-BoldOblique.ttf")
        self.add_font("Mono",  "",   FONT_DIR + "DejaVuSansMono.ttf")
        self.add_font("Mono",  "B",  FONT_DIR + "DejaVuSansMono-Bold.ttf")

    def header(self):
        self.set_fill_color(*BLUE_DARK)
        self.rect(0, 0, PAGE_W, 13, "F")
        self.set_y(2)
        self.set_font("Sans", "B", 8.5)
        self.set_text_color(*WHITE)
        self.cell(0, 9, "mobiTrace — Document confidentiel interne", align="C")
        self.set_text_color(*BLACK)
        self.set_y(20)

    def footer(self):
        self.set_y(-13)
        self.set_fill_color(*BLUE_DARK)
        self.rect(0, self.get_y(), PAGE_W, 14, "F")
        self.set_font("Sans", "I", 7.5)
        self.set_text_color(*WHITE)
        self.cell(
            0, 13,
            f"PCA — Plan de Continuité d'Activité mobiTrace  |  "
            f"Édité le {TODAY}  |  Page {self.page_no()}",
            align="C",
        )
        self.set_text_color(*BLACK)

    def h1(self, text):
        self.ln(4)
        self.set_fill_color(*BLUE_DARK)
        self.set_text_color(*WHITE)
        self.set_font("Sans", "B", 12.5)
        self.cell(CONTENT_W, 9, f"  {text}", fill=True,
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*BLACK)
        self.ln(2)

    def h2(self, text):
        self.ln(3)
        self.set_fill_color(*BLUE_LIGHT)
        self.set_text_color(*BLUE_DARK)
        self.set_font("Sans", "B", 10.5)
        self.set_draw_color(*BLUE_MED)
        self.set_line_width(0.4)
        self.cell(CONTENT_W, 7.5, f"  {text}", border="L", fill=True,
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*BLACK)
        self.set_draw_color(*BLACK)
        self.ln(1)

    def h3(self, text):
        self.ln(2)
        self.set_font("Sans", "B", 9.5)
        self.set_text_color(*BLUE_MED)
        self.cell(CONTENT_W, 6, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*BLACK)

    def body(self, text, size=9):
        self.set_font("Sans", "", size)
        self.multi_cell(CONTENT_W, 5.2, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def bullet(self, text, level=1, bold_prefix=None):
        indent = 4 * level
        self.set_x(MARGIN_L + indent)
        self.set_font("Sans", "", 8.8)
        prefix_char = "•" if level == 1 else "–"
        if bold_prefix:
            self.set_font("Sans", "B", 8.8)
            bw = self.get_string_width(bold_prefix) + 1
            self.cell(bw, 5.2, bold_prefix, new_x=XPos.RIGHT, new_y=YPos.LAST)
            self.set_font("Sans", "", 8.8)
            self.multi_cell(CONTENT_W - indent - bw, 5.2, text,
                            new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        else:
            self.multi_cell(CONTENT_W - indent, 5.2,
                            f"{prefix_char}  {text}",
                            new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def note(self, text, color=(240, 248, 255)):
        self.ln(1)
        self.set_fill_color(*color)
        self.set_draw_color(*GREY_BORDER)
        self.set_line_width(0.3)
        self.set_font("Sans", "I", 8.2)
        self.set_x(MARGIN_L)
        self.multi_cell(CONTENT_W, 4.8, f"  {text}", border=1, fill=True,
                        new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*BLACK)
        self.ln(1)

    def table_row(self, cols, widths, header=False, fill_color=None):
        fc = fill_color or WHITE
        self.set_fill_color(*fc)
        style = "B" if header else ""
        tc = WHITE if header and fill_color == BLUE_DARK else BLACK
        self.set_text_color(*tc)
        self.set_font("Sans", style, 8.2)
        self.set_x(MARGIN_L)
        for text, w in zip(cols, widths):
            self.cell(w, 6.2, f" {text}", border=1, fill=True,
                      new_x=XPos.RIGHT, new_y=YPos.LAST)
        self.set_text_color(*BLACK)
        self.ln()


# =============================================================================
# Construction du document
# =============================================================================

pdf = PDF()
pdf.set_title("Plan de Continuité d'Activité — mobiTrace")
pdf.set_author("mobiTrace / DGFiP")

# ─────────────────────────────────────────────────────────────────────────────
# PAGE DE TITRE
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.set_y(30)

pdf.ln(5)
pdf.set_draw_color(*BLUE_DARK)
pdf.set_line_width(0.8)
pdf.line(MARGIN_L, pdf.get_y(), PAGE_W - MARGIN_R, pdf.get_y())
pdf.ln(7)

pdf.set_font("Sans", "B", 22)
pdf.set_text_color(*BLUE_DARK)
pdf.cell(0, 12, "mobiTrace", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "B", 15)
pdf.cell(0, 9, "Plan de Continuité d'Activité", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "", 12)
pdf.cell(0, 8, "PCA — Version 1.0", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(*BLACK)

pdf.ln(5)
pdf.set_line_width(0.4)
pdf.line(MARGIN_L, pdf.get_y(), PAGE_W - MARGIN_R, pdf.get_y())
pdf.ln(8)

meta = [
    ("Référence",  "TRACE-PCA-2026"),
    ("Version",    "1.0"),
    ("Date",       TODAY),
    ("Auteur",     "Équipe technique mobiTrace / DGFiP"),
]
cw = [52, CONTENT_W - 52]
for label, val in meta:
    pdf.set_x(MARGIN_L + 18)
    pdf.set_font("Sans", "B", 9)
    pdf.cell(cw[0], 6.5, label, new_x=XPos.RIGHT, new_y=YPos.LAST)
    pdf.set_font("Sans", "", 9)
    pdf.cell(cw[1], 6.5, val, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

pdf.ln(8)

pdf.set_fill_color(*BLUE_LIGHT)
pdf.set_draw_color(*BLUE_MED)
pdf.set_line_width(0.5)
pdf.set_x(MARGIN_L)
pdf.set_font("Sans", "B", 9.5)
pdf.cell(CONTENT_W, 7, "  Résumé exécutif", border="LTR", fill=True,
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "", 8.8)
resume = (
    "Ce document définit les mesures organisationnelles et techniques permettant de maintenir "
    "la gestion du parc mobilier DGFiP en cas d'indisponibilité partielle ou totale de "
    "mobiTrace. Il établit les procédures de mode dégradé, l'organisation de crise et les "
    "délais d'intervention.\n\n"
    "Objectifs : RTO = 4 heures (remise en service maximale), RPO = 12 heures (perte de données "
    "maximale tolérée), MTPD = 48 heures (durée maximale de perturbation tolérable). "
    "mobiTrace étant une application de gestion d'inventaire mobilier non critique opérationnel, "
    "une indisponibilité temporaire est couverte par des procédures manuelles de substitution."
)
pdf.set_x(MARGIN_L)
pdf.multi_cell(CONTENT_W, 5.2, f"  {resume}", border="LBR", fill=True,
               new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_draw_color(*BLACK)
pdf.ln(5)

pdf.set_fill_color(255, 245, 220)
pdf.set_draw_color(200, 150, 0)
pdf.set_line_width(0.4)
pdf.set_x(MARGIN_L)
pdf.set_font("Sans", "BI", 8.2)
pdf.multi_cell(
    CONTENT_W, 5,
    "  Avertissement — Ce document contient des informations relatives à l'organisation "
    "de crise et aux procédures de continuité. Ne pas diffuser hors des équipes habilitées.",
    border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT
)
pdf.set_draw_color(*BLACK)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 2 — CONTEXTE ET OBJECTIFS
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("1. Contexte et objectifs")

pdf.h2("1.1  Objet du document")
pdf.body(
    "Le Plan de Continuité d'Activité (PCA) définit les mesures organisationnelles et "
    "techniques permettant de maintenir ou de reprendre les activités de gestion du parc "
    "mobilier DGFiP en cas d'indisponibilité partielle ou totale de mobiTrace. "
    "Il est complémentaire du Plan de Continuité Informatique (PCI) qui couvre les "
    "procédures techniques de maintien des services, et du Plan de Reprise d'Activité (PRA) "
    "qui définit les procédures de restauration après sinistre majeur."
)

pdf.h2("1.2  Objectifs de continuité")
pdf.ln(1)
w_obj = [28, 18, 60, CONTENT_W - 28 - 18 - 60]
pdf.table_row(["Indicateur", "Valeur", "Définition", "Justification"],
              w_obj, header=True, fill_color=BLUE_DARK)
rows_obj = [
    ("RPO", "12 h",
     "Perte de données maximale tolérée",
     "2 sauvegardes/jour (02h00 et 13h00)"),
    ("RTO", "4 h",
     "Temps maximal de remise en service",
     "Activité non temps-réel, impact limité"),
    ("MTPD", "48 h",
     "Durée max de perturbation tolérable",
     "Au-delà, retour au processus papier requis"),
    ("NIV_SERV", "95 %",
     "Disponibilité mensuelle cible",
     "22 h d'indisponibilité tolérées/mois"),
]
for i, row in enumerate(rows_obj):
    pdf.table_row(row, w_obj, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.ln(2)

pdf.h2("1.3  Périmètre couvert")
pdf.body("Activités couvertes par ce PCA :")
pdf.bullet("Gestion de l'inventaire mobilier (consultation, saisie, modification de statut)")
pdf.bullet("Génération de QR codes et étiquettes Zebra")
pdf.bullet("Exports CSV et procès-verbaux de mise au rebut (PDF côté client)")
pdf.bullet("Application satellite mobiTrace-SCAN (PWA agents de terrain)")
pdf.ln(1)
pdf.body("Hors périmètre (couverts par d'autres plans DGFiP) :")
pdf.bullet("Systèmes comptables et financiers DGFiP")
pdf.bullet("Réseaux informatiques et infrastructure DGFiP")
pdf.bullet("Annuaires LDAP et gestion des identités")

pdf.h2("1.4  Acteurs et responsabilités")
pdf.ln(1)
w_act = [42, 72, CONTENT_W - 42 - 72]
pdf.table_row(["Rôle", "Responsabilité", "Contact"],
              w_act, header=True, fill_color=BLUE_DARK)
rows_act = [
    ("Responsable PCA",    "Activation du PCA, décision de bascule",          "À compléter"),
    ("Équipe technique",   "Exécution des procédures PCI/PRA",                 "equipe.support@dgfip.finances.gouv.fr"),
    ("Agents utilisateurs","Application des modes dégradés",                   "Responsables de service"),
    ("Référent sécurité",  "Activation si incident de sécurité (SSI)",         "RSSI DGFiP"),
]
for i, row in enumerate(rows_act):
    pdf.table_row(row, w_act, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 3 — SCÉNARIOS DE PERTURBATION
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("2. Analyse des scénarios de perturbation")

pdf.h2("2.1  Classification des incidents")
pdf.ln(1)
w_cls = [14, 22, 52, 22, CONTENT_W - 14 - 22 - 52 - 22]
pdf.table_row(["Niveau", "Nom", "Description", "Impact", "Délai intervention"],
              w_cls, header=True, fill_color=BLUE_DARK)
rows_cls = [
    ("N1", "Mineur",        "Service lent ou partiellement dégradé",       "Faible",      "< 30 min"),
    ("N2", "Majeur",        "Service indisponible, données accessibles",    "Moyen",       "< 2 h"),
    ("N3", "Critique",      "Perte de données ou sinistre matériel",        "Élevé",       "< 4 h (RTO)"),
    ("N4", "Catastrophique","Sinistre total (incendie, ransomware)",         "Très élevé",  "PRA (< 4 h)"),
]
level_colors = [
    (235, 255, 235),
    (255, 252, 220),
    (255, 235, 215),
    (255, 220, 220),
]
for row, color in zip(rows_cls, level_colors):
    pdf.table_row(row, w_cls, fill_color=color)

pdf.ln(3)

pdf.h2("2.2  Matrice des risques")
pdf.ln(1)
w_mat = [48, 24, 24, 14, 38, CONTENT_W - 48 - 24 - 24 - 14 - 38]
pdf.table_row(["Scénario", "Probabilité", "Impact", "Niv.", "Couverture", "Plan associé"],
              w_mat, header=True, fill_color=BLUE_DARK)
rows_mat = [
    ("Panne Nginx / PostgREST",       "Moyenne",    "Faible",     "N1", "Redémarrage auto systemd", "PCI §3.1",  (235, 255, 235)),
    ("Indisponibilité réseau NFS",    "Faible",     "Faible",     "N1", "Timeout auto, reprise",    "PCI §3.4",  (235, 255, 235)),
    ("Corruption base PostgreSQL",    "Faible",     "Élevé",      "N3", "Restauration dump NFS",    "PRA §3",    (255, 235, 215)),
    ("Panne matérielle serveur TRACE","Très faible","Très élevé", "N4", "Réinstallation + restaur.","PRA §4",    (255, 220, 220)),
    ("Attaque bruteforce / intrusion","Faible",     "Élevé",      "N3", "Fail2Ban, rotation JWT",   "PCI §3.5",  (255, 235, 215)),
    ("Perte serveur NFS",             "Très faible","Élevé",      "N3", "Backup local temporaire",  "PRA §5",    (255, 235, 215)),
    ("Ransomware",                    "Très faible","Critique",   "N4", "Isolation + restaur. HL",  "PRA §4",    (255, 220, 220)),
]
for scen, proba, impact, niv, couv, plan, color in rows_mat:
    pdf.table_row([scen, proba, impact, niv, couv, plan], w_mat, fill_color=color)

pdf.ln(2)
pdf.note(
    "mobiTrace n'est pas une application critique opérationnelle. Une indisponibilité de "
    "quelques heures n'empêche pas le travail des agents (saisie différée possible). "
    "L'enjeu principal est l'intégrité des données d'inventaire, couverte par les "
    "sauvegardes automatiques biquotidiennes.",
    color=(220, 255, 220)
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 4 — MODES DÉGRADÉS
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("3. Procédures de continuité — Modes dégradés")

pdf.h2("3.1  Mode dégradé Niveau 1 — Service partiellement disponible")
pdf.body(
    "Le service est accessible mais lent ou partiellement fonctionnel. "
    "Aucune action utilisateur n'est requise. L'équipe technique surveille et intervient."
)
pdf.bullet("Symptômes : lenteur de la recherche, timeouts occasionnels, erreurs 502/503 sporadiques")
pdf.bullet("Action agents : patienter et réessayer après 5 minutes")
pdf.bullet("Action technique : voir PCI §3.1 (diagnostic et redémarrage des services)")
pdf.bullet("Durée acceptable sans escalade : 30 minutes")

pdf.h2("3.2  Mode dégradé Niveau 2 — Service totalement indisponible")
pdf.body(
    "mobiTrace est inaccessible. Les agents basculent sur les procédures manuelles de "
    "substitution décrites ci-dessous, en attendant la remise en service."
)
pdf.ln(1)
w_sub = [44, 88, CONTENT_W - 44 - 88]
pdf.table_row(["Activité", "Procédure de substitution", "Support"],
              w_sub, header=True, fill_color=BLUE_DARK)
rows_sub = [
    ("Consultation inventaire",
     "Export CSV de la veille (dernier export sauvegardé localement)",
     "Fichier CSV"),
    ("Saisie nouvelle affectation",
     "Fiche papier de saisie temporaire (modèle en annexe)",
     "Papier / email"),
    ("Changement de statut mobilier",
     "Notification email au responsable de service",
     "Email"),
    ("Scan QR code terrain",
     "Notation manuscrite de l'ID métier (format MOB-XXXXXX)",
     "Carnet"),
    ("Génération étiquette Zebra",
     "Report après remise en service (non urgent)",
     "—"),
]
for i, row in enumerate(rows_sub):
    pdf.table_row(row, w_sub, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.note(
    "Toutes les saisies effectuées sur support papier ou email doivent être intégrées "
    "dans mobiTrace dans les 24 h suivant la remise en service, avec la date réelle "
    "de l'opération (champ 'date_saisie' à corriger manuellement si nécessaire).",
    color=(255, 245, 220)
)

pdf.h2("3.3  Délais d'escalade")
pdf.ln(1)
w_esc = [42, 88, CONTENT_W - 42 - 88]
pdf.table_row(["Durée d'indisponibilité", "Action", "Responsable"],
              w_esc, header=True, fill_color=BLUE_DARK)
rows_esc = [
    ("< 30 min",            "Surveillance, diagnostic",                          "Équipe technique"),
    ("30 min – 2 h",        "Escalade PCI, notification agents",                 "Responsable technique"),
    ("2 h – 4 h",           "Activation PRA si nécessaire, communication DGFiP", "Responsable PCA"),
    ("> 4 h (RTO dépassé)", "Communication hiérarchique, mode papier formel",     "Responsable PCA"),
]
esc_colors = [(235,255,235),(255,252,220),(255,235,215),(255,220,220)]
for row, color in zip(rows_esc, esc_colors):
    pdf.table_row(row, w_esc, fill_color=color)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 5 — ORGANISATION DE CRISE
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("4. Organisation de crise")

pdf.h2("4.1  Déclenchement du PCA")
pdf.body(
    "Le PCA est déclenché par le Responsable PCA sur notification de l'équipe technique "
    "ou de la sonde de surveillance automatique (email quotidien 08h00). "
    "La décision de bascule en mode dégradé Niveau 2 appartient exclusivement au Responsable PCA."
)
pdf.body("Arbre de décision :")
pdf.bullet("Alerte reçue (sonde email, signalement agent, monitoring) → diagnostic équipe technique")
pdf.bullet("Incident N1 confirmé → résolution PCI, pas de bascule utilisateurs")
pdf.bullet("Incident N2/N3 confirmé → activation mode dégradé, notification agents")
pdf.bullet("Incident N4 (sinistre) → activation PRA + réunion cellule de crise")

pdf.h2("4.2  Cellule de crise")
pdf.ln(1)
w_cel = [42, 60, CONTENT_W - 42 - 60]
pdf.table_row(["Fonction", "Rôle en cellule de crise", "Action prioritaire"],
              w_cel, header=True, fill_color=BLUE_DARK)
rows_cel = [
    ("Responsable PCA",   "Coordinateur",              "Décision de bascule, communication"),
    ("Responsable tech.", "Expert technique",           "Exécution procédures PCI/PRA"),
    ("Référent métier",   "Représentant utilisateurs",  "Organisation mode papier"),
    ("RSSI DGFiP",        "Sécurité (si incident SSI)", "Isolation, investigation"),
]
for i, row in enumerate(rows_cel):
    pdf.table_row(row, w_cel, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.h2("4.3  Communication de crise")
pdf.body("En cas d'activation du mode dégradé Niveau 2 ou supérieur :")
pdf.bullet(
    "Notification immédiate aux agents : email ou Teams DGFiP précisant la durée estimée "
    "et les procédures de substitution à appliquer"
)
pdf.bullet("Mise à jour toutes les heures de l'estimation de retour à la normale")
pdf.bullet("Notification de reprise : email de confirmation dès que mobiTrace est à nouveau disponible")
pdf.bullet(
    "Compte-rendu d'incident : rédigé dans les 48 h suivant la résolution "
    "(causes, actions menées, mesures préventives)"
)

pdf.h2("4.4  Modèle de notification aux agents")
pdf.note(
    "Objet : [mobiTrace] Indisponibilité de service — {DATE}\n\n"
    "L'application mobiTrace est actuellement indisponible.\n"
    "L'équipe technique travaille à sa restauration.\n\n"
    "Durée estimée : {DUREE} heures\n"
    "Procédure de substitution : voir procédure §3.2 du PCA\n\n"
    "Nous vous informerons dès que le service sera rétabli.\n"
    "Équipe technique mobiTrace / DGFiP",
    color=BLUE_LIGHT
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 6 — RETOUR À LA NORMALE ET MAINTIEN DU PCA
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("5. Retour à la normale")

pdf.h2("5.1  Critères de retour")
pdf.body(
    "Le retour à la normale est prononcé par le Responsable PCA lorsque "
    "l'ensemble des critères suivants est vérifié par l'équipe technique :"
)
pdf.bullet("mobiTrace est accessible depuis l'ensemble des postes agents")
pdf.bullet("L'authentification fonctionne pour les trois rôles (lecteur, agent, administrateur)")
pdf.bullet("La dernière sauvegarde NFS est présente et valide dans /mnt/savetrace")
pdf.bullet("Aucune anomalie dans les logs Nginx et PostgreSQL sur les 30 dernières minutes")
pdf.bullet("Le service trace-api répond correctement sur POST /api/rpc/me avec un token valide")

pdf.h2("5.2  Procédure de reprise progressive")
pdf.ln(1)
w_rep = [12, 88, CONTENT_W - 12 - 88]
pdf.table_row(["Étape", "Action", "Responsable"],
              w_rep, header=True, fill_color=BLUE_DARK)
rows_rep = [
    ("1", "Vérification technique — tests fonctionnels (check-list PRA §4)",         "Équipe technique"),
    ("2", "Intégration des saisies — import des fiches papier/email du mode dégradé", "Agents + responsable métier"),
    ("3", "Validation inventaire — vérification de cohérence (totaux, dernières modif.)", "Responsable métier"),
    ("4", "Notification agents — email de reprise de service",                        "Responsable PCA"),
    ("5", "Compte-rendu — rédaction du rapport d'incident dans les 48 h",             "Responsable technique"),
]
for i, row in enumerate(rows_rep):
    pdf.table_row(row, w_rep, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.h2("5.3  Maintien en condition opérationnelle du PCA")
pdf.bullet(
    "Test annuel du PCA : simulation de basculement en mode dégradé Niveau 2 "
    "(sans interruption réelle de service) — vérification des procédures et des contacts"
)
pdf.bullet(
    "Mise à jour du document : après chaque incident réel ayant nécessité l'activation "
    "du PCA, et après toute évolution significative de l'architecture"
)
pdf.bullet(
    "Formation des agents référents : présentation des procédures de substitution, "
    "une fois par an ou lors de l'arrivée d'un nouveau responsable de service"
)
pdf.bullet(
    "Révision des contacts : vérification et mise à jour de l'annuaire de crise "
    "tous les 6 mois (départs, mutations, changements de poste)"
)

pdf.ln(4)

pdf.h2("5.4  Tableau de bord du PCA")
pdf.ln(1)
w_dash = [60, 30, CONTENT_W - 60 - 30]
pdf.table_row(["Indicateur de suivi", "Fréquence", "Responsable"],
              w_dash, header=True, fill_color=BLUE_DARK)
rows_dash = [
    ("Test de restauration NFS",               "Semestriel",  "Équipe technique"),
    ("Vérification sonde surveillance email",  "Mensuel",     "Équipe technique"),
    ("Mise à jour annuaire de crise",          "Semestriel",  "Responsable PCA"),
    ("Test exercice mode dégradé",             "Annuel",      "Responsable PCA"),
    ("Revue du PCA complet",                   "Annuel",      "Responsable PCA + RSSI"),
    ("Audit conformité PCI/PRA",               "Annuel",      "Responsable technique"),
]
for i, row in enumerate(rows_dash):
    pdf.table_row(row, w_dash, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.ln(3)
pdf.note(
    "Document généré automatiquement par generate_pca_pdf.py (dépôt mobiTrace). "
    "Pour toute question : equipe.support@dgfip.finances.gouv.fr",
    color=GREY_LIGHT
)

# ── Sauvegarde ────────────────────────────────────────────────────────────────
OUTPUT = "/home/adm1/TRACE/TRACE_PCA.pdf"
pdf.output(OUTPUT)
print(f"PDF généré : {OUTPUT}")
