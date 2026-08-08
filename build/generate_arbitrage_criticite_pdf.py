"""
Génération du document PDF : Arbitrage criticité des données — mobiTrace
Polices : DejaVu (Unicode TTF) pour la gestion des caractères français et symboles
"""
from fpdf import FPDF
from fpdf.enums import XPos, YPos
from datetime import date

# ── Chemins polices ───────────────────────────────────────────────────────────
FONT_DIR = "/usr/share/fonts/truetype/dejavu/"

# ── Palette couleurs (DSFR-inspirée) ─────────────────────────────────────────
BLUE_DARK    = (0,   0,  145)
BLUE_MED     = (0,  91, 187)
BLUE_LIGHT   = (224, 232, 255)
GREEN_OK     = ( 24, 128,  56)
GREEN_LIGHT  = (220, 255, 220)
ORANGE_WARN  = (200, 110,  10)
ORANGE_LIGHT = (255, 245, 215)
RED_CRIT     = (180,  20,  20)
RED_LIGHT    = (255, 225, 225)
PURPLE       = (100,  50, 150)
PURPLE_LIGHT = (240, 225, 255)
GREY_LIGHT   = (246, 246, 246)
GREY_BORDER  = (204, 204, 204)
BLACK        = (  0,   0,   0)
WHITE        = (255, 255, 255)

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
            f"Arbitrage criticité des données — mobiTrace  |  "
            f"Édité le {TODAY}  |  Page {self.page_no()}",
            align="C",
        )
        self.set_text_color(*BLACK)

    # ── Helpers ───────────────────────────────────────────────────────────────

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

    def niveau_badge(self, label, color, bg_color):
        """Pastille colorée pour le niveau de criticité."""
        self.set_fill_color(*bg_color)
        self.set_text_color(*color)
        self.set_font("Sans", "B", 8)
        bw = self.get_string_width(f"  {label}  ") + 2
        self.cell(bw, 6, f"  {label}  ", fill=True,
                  new_x=XPos.RIGHT, new_y=YPos.LAST)
        self.set_text_color(*BLACK)

    def data_section(self, numero, titre, rows_cia, niveau, niveau_color, niveau_bg, texte):
        """Bloc de présentation d'une catégorie de données."""
        self.ln(3)
        # En-tête de section
        self.set_fill_color(*GREY_LIGHT)
        self.set_draw_color(*GREY_BORDER)
        self.set_line_width(0.3)
        self.set_font("Sans", "B", 9.5)
        self.set_x(MARGIN_L)
        self.set_text_color(*BLUE_DARK)
        self.cell(CONTENT_W, 8, f"  {numero}  {titre}", border=1, fill=True,
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*BLACK)
        self.set_draw_color(*BLACK)

        # Tableau CIA
        w_cia = [38, 22, CONTENT_W - 38 - 22 - 40, 40]
        self.table_row(["Critère", "Niveau", "Justification", "Niveau global"],
                       w_cia, header=True, fill_color=BLUE_DARK)
        for i, (critere, niv, just) in enumerate(rows_cia):
            niveau_str = niv
            if niv == "Critique":
                fc = RED_LIGHT
            elif niv == "Élevée":
                fc = ORANGE_LIGHT
            elif niv == "Moyenne":
                fc = (255, 252, 230)
            else:
                fc = GREEN_LIGHT
            # Colonne niveau global uniquement sur la première ligne, en span visuel
            global_col = niveau if i == 0 else ""
            self.set_fill_color(*fc)
            self.set_font("Sans", "", 8.2)
            self.set_x(MARGIN_L)
            self.set_text_color(*BLACK)
            # Critère
            self.cell(w_cia[0], 5.8, f" {critere}", border=1, fill=True,
                      new_x=XPos.RIGHT, new_y=YPos.LAST)
            # Niveau CIA
            niv_color = RED_CRIT if niv == "Critique" else (
                ORANGE_WARN if niv == "Élevée" else (
                GREEN_OK if niv == "Faible" else BLACK))
            self.set_text_color(*niv_color)
            self.set_font("Sans", "B", 8.2)
            self.cell(w_cia[1], 5.8, f" {niveau_str}", border=1, fill=True,
                      new_x=XPos.RIGHT, new_y=YPos.LAST)
            self.set_text_color(*BLACK)
            self.set_font("Sans", "", 8.2)
            self.set_fill_color(*WHITE)
            # Justification
            self.cell(w_cia[2], 5.8, f" {just}", border=1, fill=True,
                      new_x=XPos.RIGHT, new_y=YPos.LAST)
            # Niveau global (cellule fusionnée visuellement sur la 1re ligne)
            self.set_fill_color(*niveau_bg)
            self.set_text_color(*niveau_color)
            self.set_font("Sans", "B", 8.2)
            self.cell(w_cia[3], 5.8, f" {global_col}", border=1, fill=True,
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_text_color(*BLACK)

        # Texte d'analyse
        self.ln(1)
        self.set_font("Sans", "I", 8.5)
        self.set_x(MARGIN_L + 2)
        self.multi_cell(CONTENT_W - 2, 5, texte, new_x=XPos.LMARGIN, new_y=YPos.NEXT)


# =============================================================================
# Construction du document
# =============================================================================

pdf = PDF()
pdf.set_title("Arbitrage criticité des données — mobiTrace")
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
pdf.cell(0, 9, "Arbitrage criticité des données", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "", 12)
pdf.cell(0, 8, "Niveau de sécurisation applicatif", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(*BLACK)

pdf.ln(5)
pdf.set_line_width(0.4)
pdf.line(MARGIN_L, pdf.get_y(), PAGE_W - MARGIN_R, pdf.get_y())
pdf.ln(8)

meta = [
    ("Référence",  "TRACE-SEC-DATA-2026"),
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

# Encadré résumé exécutif
pdf.set_fill_color(*BLUE_LIGHT)
pdf.set_draw_color(*BLUE_MED)
pdf.set_line_width(0.5)
pdf.set_x(MARGIN_L)
pdf.set_font("Sans", "B", 9.5)
pdf.cell(CONTENT_W, 7, "  Résumé exécutif", border="LTR", fill=True,
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "", 8.8)
resume = (
    "Ce document établit l'arbitrage de criticité des données traitées par mobiTrace, "
    "application souveraine de gestion d'inventaire mobilier développée par et pour la DGFiP. "
    "L'analyse suit la grille CIA (Confidentialité / Intégrité / Disponibilité) et les niveaux "
    "de classification ANSSI (Public / Interne / Sensible / Critique).\n\n"
    "Résultat : mobiTrace traite principalement des données de niveau Interne à Sensible, "
    "sans secret d'État ni donnée financière. Deux actifs ressortent au niveau Critique : "
    "le secret JWT et les dumps de sauvegarde. Ce sont les priorités de sécurisation "
    "immédiates. Trois points de risque structurels sont identifiés avec leurs remédiations."
)
pdf.set_x(MARGIN_L)
pdf.multi_cell(CONTENT_W, 5.2, f"  {resume}", border="LBR", fill=True,
               new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_draw_color(*BLACK)
pdf.ln(5)

# Avertissement
pdf.set_fill_color(255, 245, 220)
pdf.set_draw_color(200, 150, 0)
pdf.set_line_width(0.4)
pdf.set_x(MARGIN_L)
pdf.set_font("Sans", "BI", 8.2)
pdf.multi_cell(
    CONTENT_W, 5,
    "  Avertissement — Ce document contient une évaluation de la surface de risque de "
    "l'infrastructure. Ne pas diffuser hors des équipes habilitées.",
    border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT
)
pdf.set_draw_color(*BLACK)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 2 — CADRE D'ANALYSE
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("1. Cadre d'analyse")

pdf.h2("1.1  Grille CIA")
pdf.body(
    "Chaque catégorie de données est évaluée selon trois axes indépendants, sur trois niveaux :"
)
pdf.ln(1)
w_cia = [30, 25, CONTENT_W - 30 - 25]
pdf.table_row(["Axe", "Niveaux", "Définition"], w_cia,
              header=True, fill_color=BLUE_DARK)
rows_cia_def = [
    ("Confidentialité (C)", "Faible / Élevée / Critique",
     "Impact d'une divulgation non autorisée"),
    ("Intégrité (I)",       "Faible / Élevée / Critique",
     "Impact d'une altération ou falsification"),
    ("Disponibilité (D)",   "Faible / Élevée / Critique",
     "Impact d'une indisponibilité ou perte"),
]
for i, row in enumerate(rows_cia_def):
    pdf.table_row(row, w_cia, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.ln(3)

pdf.h2("1.2  Niveaux de classification (ANSSI)")
pdf.ln(1)
w_lvl = [30, 30, CONTENT_W - 30 - 30]
pdf.table_row(["Niveau", "CIA max", "Exemples de données"], w_lvl,
              header=True, fill_color=BLUE_DARK)
rows_lvl = [
    ("Public",    "C=Faible / I=Faible / D=Faible",
     "Catalogue gabarits, référentiels publics"),
    ("Interne",   "C=Faible / I=Élevée / D=Moyenne",
     "Données mobilier, référentiels organisationnels"),
    ("Sensible",  "C=Élevée / I=Critique / D=Élevée",
     "Comptes utilisateurs, journal d'audit"),
    ("Critique",  "C=Critique / I=Critique / D=Élevée",
     "Secret JWT, dumps de sauvegarde"),
]
level_colors = [GREEN_LIGHT, BLUE_LIGHT, ORANGE_LIGHT, RED_LIGHT]
for row, color in zip(rows_lvl, level_colors):
    pdf.table_row(row, w_lvl, fill_color=color)

pdf.ln(4)

pdf.h2("1.3  Périmètre de l'application")
pdf.body(
    "mobiTrace est une application souveraine déployée en intranet DGFiP, sans exposition "
    "internet. Les utilisateurs sont exclusivement des agents publics authentifiés. "
    "Le code source est public (CC BY-NC-SA) mais les données de production restent "
    "strictement internes."
)
pdf.bullet("Pas de données financières (aucun lien avec les systèmes comptables)")
pdf.bullet("Pas de secret de défense nationale")
pdf.bullet("Données personnelles au sens RGPD : emails et noms des agents uniquement")
pdf.bullet("Données patrimoniales : inventaire de mobilier et équipements administratifs")
pdf.bullet("Données opérationnelles : affectations, statuts, journal d'actions")

pdf.ln(3)
pdf.note(
    "L'architecture minimaliste (pas de framework applicatif côté serveur, logique métier "
    "en base PostgreSQL) réduit significativement la surface d'attaque par rapport à une "
    "application standard en Node.js ou Python Flask.",
    color=GREEN_LIGHT
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 3 — DONNÉES CRITIQUES
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("2. Inventaire et cotation des données")

pdf.data_section(
    "2.1", "Secret JWT  (auth.secrets)",
    [
        ("Confidentialité", "Critique",
         "Fuite = forge illimitée de tokens, y compris rôle administrateur"),
        ("Intégrité",       "Critique",
         "Modification = toutes les sessions actives cassées instantanément"),
        ("Disponibilité",   "Élevée",
         "Indisponibilité = plus aucun accès à l'application"),
    ],
    "CRITIQUE", RED_CRIT, RED_LIGHT,
    "Risque maximal : un attaquant en possession de ce secret peut se connecter en "
    "administrateur sans credentials, sans laisser de trace dans les logs d'authentification. "
    "Actuellement stocké dans la même base PostgreSQL que les données applicatives."
)

pdf.data_section(
    "2.2", "Dumps de sauvegarde NFS",
    [
        ("Confidentialité", "Critique",
         "Contient l'intégralité de la BDD : hashes mdp, secret JWT, audit logs"),
        ("Intégrité",       "Élevée",
         "Restauration sur dump corrompu = perte de données irréversible"),
        ("Disponibilité",   "Élevée",
         "Seul filet de sécurité post-incident"),
    ],
    "CRITIQUE", RED_CRIT, RED_LIGHT,
    "Le dump PostgreSQL est une copie exacte de toutes les données sensibles. "
    "Il circule actuellement en clair sur le réseau NFS (réseau interne non chiffré). "
    "La compromission du serveur NFS équivaut à la compromission complète de l'application."
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 4 — DONNÉES SENSIBLES ET INTERNES
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h2("(suite — Inventaire et cotation des données)")

pdf.data_section(
    "2.3", "Table utilisateurs  (comptes agents)",
    [
        ("Confidentialité", "Élevée",
         "Emails + noms d'agents = données personnelles RGPD, hashes Bcrypt"),
        ("Intégrité",       "Critique",
         "Modification = escalade de privilèges, création de comptes fantômes"),
        ("Disponibilité",   "Élevée",
         "Perte = blocage total des accès applicatifs"),
    ],
    "SENSIBLE", ORANGE_WARN, ORANGE_LIGHT,
    "Données personnelles au sens RGPD (emails nominatifs agents DGFiP). "
    "Le REVOKE explicite sur cette table est une bonne mesure en place. "
    "L'administrateur applicatif conserve cependant un accès complet."
)

pdf.data_section(
    "2.4", "Journal d'audit  (audit_logs)",
    [
        ("Confidentialité", "Moyenne",
         "Révèle l'activité opérationnelle des agents (qui touche quoi, quand)"),
        ("Intégrité",       "Critique",
         "Table modifiable par l'admin : valeur probatoire nulle si contestée"),
        ("Disponibilité",   "Faible",
         "Consultation a posteriori, non bloquant en exploitation"),
    ],
    "SENSIBLE", ORANGE_WARN, ORANGE_LIGHT,
    "Paradoxe actuel : l'audit log est stocké dans la même base que les données auditées, "
    "accessible à l'administrateur applicatif qui peut donc couvrir ses propres actions. "
    "La valeur probatoire est nulle en cas de litige sans externalisation du journal."
)

pdf.data_section(
    "2.5", "Données mobilier  (mobiliers)",
    [
        ("Confidentialité", "Faible",
         "Inventaire de mobilier, aucune donnée personnelle ni financière"),
        ("Intégrité",       "Élevée",
         "Falsification = inventaire non fiable, risque de perte d'actifs"),
        ("Disponibilité",   "Moyenne",
         "Indisponibilité quelques heures acceptable, activité non temps-réel"),
    ],
    "INTERNE", BLUE_MED, BLUE_LIGHT,
    "Données de gestion administrative courante. Sensibilité limitée à l'intégrité "
    "opérationnelle. Le RBAC PostgreSQL (agent/administrateur/lecteur) et les triggers "
    "d'audit constituent une protection adéquate pour ce niveau."
)

pdf.data_section(
    "2.6", "Référentiels organisationnels  (structures, lieux)",
    [
        ("Confidentialité", "Faible",
         "Codes SAGES et libellés de structures DGFiP, semi-publics"),
        ("Intégrité",       "Élevée",
         "Erreur = mauvaise affectation géographique des équipements"),
        ("Disponibilité",   "Faible",
         "Données quasi-statiques"),
    ],
    "INTERNE", BLUE_MED, BLUE_LIGHT,
    "Référentiels d'organisation administrative. La charte de nommage stricte et "
    "l'import CSV contrôlé à l'installation réduisent le risque d'altération accidentelle."
)

pdf.data_section(
    "2.7", "Catalogue gabarits  (gabarits)",
    [
        ("Confidentialité", "Faible",
         "Références catalogue mobilier standard, photos base64"),
        ("Intégrité",       "Moyenne",
         "Modification = mauvaise identification du matériel"),
        ("Disponibilité",   "Faible",
         "Donnée de référence, lecture prédominante"),
    ],
    "INTERNE", BLUE_MED, BLUE_LIGHT,
    "Catalogue de gabarits d'équipements. Données non sensibles, protégées par le RBAC "
    "(seul l'administrateur peut créer ou modifier les gabarits)."
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 5 — SYNTHÈSE
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("3. Tableau de bord de synthèse")

pdf.ln(2)
w_s = [52, 20, 20, 20, 20, CONTENT_W - 52 - 20 - 20 - 20 - 20]
pdf.table_row(["Catégorie de données", "Conf.", "Intég.", "Dispo.", "Niveau", "Mesures clés en place"],
              w_s, header=True, fill_color=BLUE_DARK)

rows_synth = [
    ("Secret JWT",              "C3", "C3", "C2", "CRITIQUE",
     "auth.secrets, SECURITY DEFINER", RED_LIGHT),
    ("Dumps NFS",               "C3", "C2", "C2", "CRITIQUE",
     "Cron 2x/jour, sonde email", RED_LIGHT),
    ("Comptes utilisateurs",    "C2", "C3", "C2", "SENSIBLE",
     "Bcrypt, REVOKE, RBAC", ORANGE_LIGHT),
    ("Journal d'audit",         "C1", "C3", "C1", "SENSIBLE",
     "Trigger automatique", ORANGE_LIGHT),
    ("Données mobilier",        "C1", "C2", "C2", "INTERNE",
     "RBAC agent/lecteur, UUID", BLUE_LIGHT),
    ("Référentiels org.",       "C1", "C2", "C1", "INTERNE",
     "Import CSV contrôlé", BLUE_LIGHT),
    ("Catalogue gabarits",      "C1", "C1", "C1", "INTERNE",
     "RBAC administrateur", BLUE_LIGHT),
]
for row in rows_synth:
    *cells, color = row
    pdf.table_row(cells, w_s, fill_color=color)

pdf.ln(5)

pdf.h2("Répartition par niveau")
pdf.ln(2)

# Graphe à barres horizontal (proportionnel)
niveaux = [
    ("CRITIQUE", 2, RED_CRIT,    RED_LIGHT),
    ("SENSIBLE",  2, ORANGE_WARN, ORANGE_LIGHT),
    ("INTERNE",   3, BLUE_MED,    BLUE_LIGHT),
]
total = 7
bar_x  = MARGIN_L + 30
bar_w  = CONTENT_W - 32
bar_h  = 9
gap    = 3

for label, count, color, bg in niveaux:
    fill_w = (count / total) * bar_w
    pdf.set_x(MARGIN_L)
    pdf.set_font("Sans", "B", 8)
    pdf.set_text_color(*color)
    pdf.cell(28, bar_h + gap, label, align="R", new_x=XPos.RIGHT, new_y=YPos.LAST)
    y_bar = pdf.get_y()
    pdf.set_fill_color(*color)
    pdf.rect(bar_x, y_bar, fill_w, bar_h, "F")
    pdf.set_fill_color(*bg)
    pdf.rect(bar_x + fill_w, y_bar, bar_w - fill_w, bar_h, "F")
    pdf.set_xy(bar_x, y_bar)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Sans", "B", 8)
    pdf.cell(fill_w, bar_h, f"  {count} catégorie{'s' if count > 1 else ''}",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*BLACK)
    pdf.ln(gap)

pdf.ln(3)
pdf.note(
    "Conclusion : mobiTrace est une application à sensibilité globale INTERNE à SENSIBLE. "
    "Aucune donnée de niveau Secret défense ni financière. Les deux actifs Critique "
    "(secret JWT et dumps) sont des vecteurs d'amplification de risque qui, compromis, "
    "élèvent de fait le niveau de l'ensemble de l'application.",
    color=ORANGE_LIGHT
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 6 — RECOMMANDATIONS
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("4. Points de risque et recommandations")

# ── PRIORITÉ 1 ────────────────────────────────────────────────────────────────
pdf.h2("4.1  Priorité 1 — Critique (risque immédiat)")

pdf.h3("Dumps NFS en clair")
pdf.body(
    "Le dump PostgreSQL (contenant le secret JWT et les hashes de mots de passe) transite "
    "sur le réseau en clair via NFS. Sur un réseau d'administration partagé, "
    "une écoute passive suffit à capturer l'intégralité de la base."
)
pdf.bullet("Remédiation : chiffrer les dumps avant transfert avec une clé symétrique AES-256")
pdf.bullet(
    "Commande dans trace_backup.sh :",
    bold_prefix="Exemple : "
)
pdf.set_fill_color(28, 28, 35)
pdf.set_text_color(160, 255, 160)
pdf.set_font("Mono", "", 7.5)
pdf.set_x(MARGIN_L)
lines_code1 = [
    "# Dans trace_backup.sh -- chiffrer avant copie NFS",
    "openssl enc -aes-256-cbc -pbkdf2 -iter 600000 \\",
    "    -in /tmp/trace_backup_$DATE.sql.gz \\",
    "    -out /mnt/savetrace/trace_backup_$DATE.sql.gz.enc \\",
    "    -pass file:/etc/trace-backup.key   # clé root:root 600",
]
for line in lines_code1:
    pdf.set_x(MARGIN_L)
    pdf.cell(CONTENT_W, 4.8, f"  {line}", fill=True,
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(*BLACK)
pdf.ln(1)

pdf.h3("Journal d'audit falsifiable par l'administrateur")
pdf.body(
    "La table audit_logs réside dans la même base que les données auditées. "
    "L'administrateur applicatif peut modifier ou supprimer des entrées, "
    "annulant toute valeur probatoire en cas de litige ou d'incident de sécurité."
)
pdf.bullet(
    "Remédiation court terme : activer pgaudit (extension PostgreSQL) vers syslog distant "
    "en mode push-only (l'administrateur applicatif ne peut pas y accéder)"
)
pdf.bullet(
    "Remédiation long terme : externaliser vers un SIEM ou syslog centralisé "
    "sous contrôle de l'équipe sécurité DGFiP"
)

pdf.h3("Secret JWT colocalisé avec les données")
pdf.body(
    "Le secret JWT est stocké dans auth.secrets dans la même instance PostgreSQL que les données. "
    "Une injection SQL sur une vue ou une fonction SECURITY DEFINER pourrait l'exposer."
)
pdf.bullet(
    "Remédiation : stocker le secret dans une variable d'environnement systemd "
    "(directive Environment= dans trace-api.service), hors de la base de données"
)

# ── PRIORITÉ 2 ────────────────────────────────────────────────────────────────
pdf.h2("4.2  Priorité 2 — Sensible")

pdf.h3("Certificat SSL auto-signé")
pdf.body(
    "Le certificat auto-signé généré à l'installation est identifié dans le README comme "
    "devant être remplacé. Les navigateurs affichent une alerte SSL, et le certificat "
    "ne peut pas être révoqué via une CA."
)
pdf.bullet("Remédiation : demander un certificat auprès de l'IGC/A (IGC de l'administration)")
pdf.bullet("Alternative interne : déployer une CA interne DGFiP et distribuer le certificat racine")

pdf.h3("Absence de second facteur pour les administrateurs")
pdf.body(
    "Un compte administrateur compromis (phishing, mot de passe faible ou réutilisé) "
    "donne un accès complet à l'ensemble de l'application, y compris la table utilisateurs "
    "et les fonctions SECURITY DEFINER."
)
pdf.bullet("Remédiation : implémenter TOTP (Google Authenticator / FreeOTP) pour le rôle administrateur")
pdf.bullet("La fonction de login PostgreSQL peut vérifier un code TOTP via pgcrypto HMAC-SHA1")

pdf.h3("Révocation de JWT impossible")
pdf.body(
    "L'architecture stateless JWT ne permet pas d'invalider un token avant son expiration "
    "(8 heures). Si un agent quitte le service ou si un compte est compromis, le token reste "
    "valide jusqu'à expiration naturelle."
)
pdf.bullet("Remédiation : réduire la durée des tokens de 8h à 2h")
pdf.bullet("Remédiation avancée : tenir une liste noire en mémoire (table PostgreSQL légère)")

# ── PRIORITÉ 3 ────────────────────────────────────────────────────────────────
pdf.h2("4.3  Priorité 3 — Amélioration")

pdf.h3("RGPD — Données personnelles des agents")
pdf.body(
    "Les emails et noms complets des agents constituent des données personnelles au sens "
    "du RGPD. L'application ne dispose pas d'un mécanisme de suppression des comptes "
    "pour les agents quittant le service."
)
pdf.bullet("Vérifier que le traitement est couvert par le registre des traitements DGFiP")
pdf.bullet("Implémenter une procédure de désactivation/anonymisation des comptes agents partants")
pdf.bullet("Durée de conservation des audit_logs à définir et configurer (purge automatique)")

pdf.h3("Rotation du secret JWT")
pdf.body(
    "Aucun mécanisme ni procédure de rotation planifiée du secret JWT n'est documenté. "
    "Un secret non rotatif depuis l'installation est exposé en cas de compromission silencieuse."
)
pdf.bullet("Documenter la procédure de rotation (UPDATE auth.secrets + redémarrage PostgREST)")
pdf.bullet("Planifier une rotation annuelle au minimum")

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 7 — PLAN D'ACTION
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("5. Plan d'action")

pdf.ln(2)
w_plan = [12, 55, 22, 25, CONTENT_W - 12 - 55 - 22 - 25]
pdf.table_row(["Prio.", "Action", "Effort", "Impact", "Responsable"],
              w_plan, header=True, fill_color=BLUE_DARK)

actions = [
    ("P1", "Chiffrer les dumps NFS (openssl enc AES-256)",
     "0.5 j", "Critique", RED_LIGHT),
    ("P1", "Externaliser le secret JWT hors BDD (env. systemd)",
     "0.5 j", "Critique", RED_LIGHT),
    ("P1", "Activer pgaudit vers syslog distant",
     "1 j",   "Critique", RED_LIGHT),
    ("P2", "Remplacer le certificat SSL auto-signé (IGC/A)",
     "0.5 j", "Élevé",    ORANGE_LIGHT),
    ("P2", "TOTP pour le rôle administrateur",
     "2 j",   "Élevé",    ORANGE_LIGHT),
    ("P2", "Réduire durée JWT de 8h à 2h",
     "0.5 j", "Moyen",    ORANGE_LIGHT),
    ("P3", "Procédure RGPD : désactivation comptes agents",
     "1 j",   "Moyen",    BLUE_LIGHT),
    ("P3", "Procédure de rotation annuelle du secret JWT",
     "0.5 j", "Faible",   BLUE_LIGHT),
]
for prio, action, effort, impact, color in actions:
    pdf.table_row([prio, action, effort, impact, "Équipe technique"], w_plan,
                  fill_color=color)

pdf.ln(5)

pdf.h2("Visualisation temporelle du plan d'action")
pdf.ln(3)

timeline = [
    ("P1 — Dumps + JWT + Audit",  0,  2, RED_CRIT,    RED_LIGHT),
    ("P2 — Certificat + TOTP",    2,  6, ORANGE_WARN, ORANGE_LIGHT),
    ("P3 — RGPD + Rotation",      6, 12, BLUE_MED,    BLUE_LIGHT),
]
total_m = 12
bar_x_tl = MARGIN_L + 38
bar_w_tl  = CONTENT_W - 40
bar_h_tl  = 8
gap_tl    = 2

for label, start, end, color, bg in timeline:
    xs = bar_x_tl + (start / total_m) * bar_w_tl
    xe = bar_x_tl + (end   / total_m) * bar_w_tl
    bw = xe - xs
    pdf.set_x(MARGIN_L)
    pdf.set_font("Sans", "B", 7.5)
    pdf.set_text_color(*color)
    pdf.cell(36, bar_h_tl + gap_tl, label, align="R",
             new_x=XPos.RIGHT, new_y=YPos.LAST)
    y_bar = pdf.get_y()
    pdf.set_fill_color(*color)
    pdf.rect(xs, y_bar, bw, bar_h_tl, "F")
    pdf.set_fill_color(*bg)
    pdf.rect(xs + bw, y_bar, bar_w_tl - bw, bar_h_tl, "F")
    pdf.set_xy(xs, y_bar)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Sans", "B", 7)
    mois_label = f"  M{start}–M{end}"
    pdf.cell(bw, bar_h_tl, mois_label, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*BLACK)
    pdf.ln(gap_tl)

# Graduations
pdf.set_font("Sans", "", 6.8)
for m in range(0, 13, 2):
    xm = bar_x_tl + (m / total_m) * bar_w_tl
    pdf.set_xy(xm - 2, pdf.get_y())
    pdf.cell(10, 4, f"M{m}")

pdf.ln(8)

pdf.h2("Mesures de sécurité déjà en place")
pdf.body("Les éléments suivants constituent les points forts de la sécurité actuelle :")
securite_ok = [
    "Hachage Bcrypt (pgcrypto, sel aléatoire) pour les mots de passe utilisateurs",
    "JWT HttpOnly / Secure / SameSite=Strict — protection XSS et CSRF",
    "Fail2Ban sur POST /api/rpc/login : ban 1h après 5 tentatives (10 min)",
    "Rate limiting Nginx : zone login_limit 3 req/s, réponse 429",
    "RBAC PostgreSQL strict : rôles agent / administrateur / lecteur",
    "REVOKE explicite sur table utilisateurs pour les rôles non-admin",
    "SECURITY DEFINER sur les fonctions sensibles (login, creer_utilisateur)",
    "Journal d'audit intégré avec triggers automatiques",
    "Sauvegarde automatique 2x/jour avec sonde de surveillance par email",
    "Génération des secrets (JWT, mdp BDD) à l'installation via /dev/urandom",
    "Architecture sans framework applicatif côté serveur (surface d'attaque minimale)",
]
for item in securite_ok:
    pdf.bullet(item)

pdf.ln(3)
pdf.note(
    "Document généré automatiquement par generate_arbitrage_criticite_pdf.py (dépôt mobiTrace). "
    "Pour toute question : équipe technique DGFiP.",
    color=GREY_LIGHT
)

# ── Sauvegarde ─────────────────────────────────────────────────────────────────
OUTPUT = "/home/adm1/TRACE/TRACE_Arbitrage_Criticite_Donnees.pdf"
pdf.output(OUTPUT)
print(f"PDF généré : {OUTPUT}")
