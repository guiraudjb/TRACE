"""
Génération du document PDF : Guide d'assistance — mobiTrace / DGFiP
Destiné aux équipes de support N1/N2/N3
"""
from fpdf import FPDF
from fpdf.enums import XPos, YPos
from datetime import date

FONT_DIR = "/usr/share/fonts/truetype/dejavu/"

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
        self.cell(0, 9, "mobiTrace — Guide d'assistance — Usage interne équipes support", align="C")
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
            f"Guide d'assistance mobiTrace  |  Édité le {TODAY}  |  Page {self.page_no()}",
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

    def code(self, text):
        self.ln(1)
        self.set_fill_color(28, 28, 35)
        self.set_text_color(160, 255, 160)
        self.set_font("Mono", "", 7.5)
        for line in text.split("\n"):
            self.set_x(MARGIN_L)
            self.cell(CONTENT_W, 4.8, f"  {line}", fill=True,
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*BLACK)
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

    def escalade_badge(self, niveau, label, color, bg):
        self.ln(3)
        self.set_fill_color(*color)
        self.set_text_color(*WHITE)
        self.set_font("Sans", "B", 11)
        self.cell(CONTENT_W, 9, f"  {niveau}  —  {label}",
                  fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*BLACK)
        self.ln(1)

    def faq_item(self, question, reponse, niveau_badge=None, badge_color=None, badge_bg=None):
        """Bloc FAQ : question en gras, réponse en body, badge de niveau optionnel."""
        self.ln(2)
        # Fond question
        self.set_fill_color(*GREY_LIGHT)
        self.set_draw_color(*GREY_BORDER)
        self.set_line_width(0.2)
        self.set_x(MARGIN_L)
        # Icône Q
        self.set_font("Sans", "B", 9)
        self.set_text_color(*BLUE_DARK)
        q_prefix = "Q.  "
        pw = self.get_string_width(q_prefix)
        self.cell(pw, 6.5, q_prefix, fill=True, border="LT",
                  new_x=XPos.RIGHT, new_y=YPos.LAST)
        self.set_font("Sans", "B", 9)
        self.set_text_color(*BLACK)
        avail = CONTENT_W - pw
        if niveau_badge:
            badge_text = f"  [{niveau_badge}]"
            bw = self.get_string_width(badge_text) + 2
            self.set_fill_color(*GREY_LIGHT)
            self.multi_cell(avail - bw, 6.5, question, fill=True, border="T",
                            new_x=XPos.RIGHT, new_y=YPos.LAST)
            self.set_fill_color(*(badge_bg or BLUE_LIGHT))
            self.set_text_color(*(badge_color or BLUE_DARK))
            self.set_font("Sans", "B", 7.5)
            self.cell(bw, 6.5, badge_text, fill=True, border="TR",
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        else:
            self.set_fill_color(*GREY_LIGHT)
            self.multi_cell(avail, 6.5, question, fill=True, border="TR",
                            new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*BLACK)
        self.set_draw_color(*BLACK)
        # Réponse
        self.set_x(MARGIN_L + 4)
        self.set_font("Sans", "", 8.8)
        self.multi_cell(CONTENT_W - 4, 5.2, reponse,
                        new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def probleme_bloc(self, symptome, causes, resolution, niveau, escalade=None,
                      code_block=None):
        """Bloc de résolution structuré : symptôme → causes → résolution → escalade."""
        self.ln(3)
        # Bande symptôme
        niv_colors = {
            "N1": (GREEN_OK,    GREEN_LIGHT),
            "N2": (ORANGE_WARN, ORANGE_LIGHT),
            "N3": (RED_CRIT,    RED_LIGHT),
        }
        nc, nb = niv_colors.get(niveau, (BLUE_MED, BLUE_LIGHT))
        self.set_fill_color(*nb)
        self.set_draw_color(*nc)
        self.set_line_width(0.5)
        self.set_x(MARGIN_L)
        self.set_font("Sans", "B", 8.8)
        self.set_text_color(*nc)
        badge = f"[{niveau}]"
        bw = self.get_string_width(badge) + 4
        self.cell(bw, 7, badge, fill=True, border=1,
                  new_x=XPos.RIGHT, new_y=YPos.LAST)
        self.set_text_color(*BLACK)
        self.set_fill_color(*GREY_LIGHT)
        self.set_font("Sans", "B", 8.8)
        self.cell(CONTENT_W - bw, 7, f"  {symptome}", fill=True, border=1,
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*BLACK)
        self.set_line_width(0.2)

        # Causes
        self.set_x(MARGIN_L)
        self.set_fill_color(*BLUE_LIGHT)
        self.set_font("Sans", "B", 8)
        self.set_text_color(*BLUE_DARK)
        self.cell(22, 5.5, "  Causes :", fill=True, border="LB",
                  new_x=XPos.RIGHT, new_y=YPos.LAST)
        self.set_font("Sans", "", 8)
        self.set_text_color(*BLACK)
        self.set_fill_color(*WHITE)
        self.multi_cell(CONTENT_W - 22, 5.5, f" {causes}", fill=True, border="BR",
                        new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Résolution
        self.set_x(MARGIN_L)
        self.set_fill_color(*GREEN_LIGHT)
        self.set_font("Sans", "B", 8)
        self.set_text_color(*GREEN_OK)
        self.cell(22, 5.5, "  Action :", fill=True, border="LB",
                  new_x=XPos.RIGHT, new_y=YPos.LAST)
        self.set_font("Sans", "", 8)
        self.set_text_color(*BLACK)
        self.set_fill_color(*WHITE)
        self.multi_cell(CONTENT_W - 22, 5.5, f" {resolution}", fill=True, border="BR",
                        new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        if code_block:
            self.code(code_block)

        # Escalade
        if escalade:
            self.set_x(MARGIN_L)
            self.set_fill_color(*ORANGE_LIGHT)
            self.set_font("Sans", "B", 8)
            self.set_text_color(*ORANGE_WARN)
            self.cell(22, 5.5, "  Escalade :", fill=True, border="LB",
                      new_x=XPos.RIGHT, new_y=YPos.LAST)
            self.set_font("Sans", "I", 8)
            self.set_text_color(*BLACK)
            self.set_fill_color(*WHITE)
            self.multi_cell(CONTENT_W - 22, 5.5, f" {escalade}", fill=True, border="BR",
                            new_x=XPos.LMARGIN, new_y=YPos.NEXT)


# =============================================================================
# Construction du document
# =============================================================================

pdf = PDF()
pdf.set_title("Guide d'assistance — mobiTrace")
pdf.set_author("mobiTrace / DGFiP")

# ─────────────────────────────────────────────────────────────────────────────
# PAGE DE TITRE
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.set_y(24)
pdf.set_font("Sans", "B", 10)
pdf.set_text_color(*BLUE_DARK)
pdf.cell(0, 7, "RÉPUBLIQUE FRANÇAISE", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "I", 8)
pdf.cell(0, 5, "Liberté  •  Égalité  •  Fraternité",
         align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(*BLACK)

pdf.ln(5)
pdf.set_draw_color(*BLUE_DARK)
pdf.set_line_width(0.8)
pdf.line(MARGIN_L, pdf.get_y(), PAGE_W - MARGIN_R, pdf.get_y())
pdf.ln(7)

pdf.set_font("Sans", "B", 22)
pdf.set_text_color(*BLUE_DARK)
pdf.cell(0, 12, "mobiTrace", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "B", 15)
pdf.cell(0, 9, "Guide d'assistance", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "", 12)
pdf.cell(0, 8, "Équipes de support — Système d'escalade et FAQ", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(*BLACK)

pdf.ln(5)
pdf.set_line_width(0.4)
pdf.line(MARGIN_L, pdf.get_y(), PAGE_W - MARGIN_R, pdf.get_y())
pdf.ln(8)

for label, val in [
    ("Référence",   "TRACE-SUPPORT-2026"),
    ("Version",     "1.0"),
    ("Date",        TODAY),
    ("Public cible","Équipes d'assistance N1 / N2 / N3"),
    ("Diffusion",   "Interne — Équipes support DGFiP"),
]:
    pdf.set_x(MARGIN_L + 18)
    pdf.set_font("Sans", "B", 9)
    pdf.cell(52, 6.5, label, new_x=XPos.RIGHT, new_y=YPos.LAST)
    pdf.set_font("Sans", "", 9)
    pdf.cell(CONTENT_W - 52, 6.5, val, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

pdf.ln(8)

pdf.set_fill_color(*BLUE_LIGHT)
pdf.set_draw_color(*BLUE_MED)
pdf.set_line_width(0.5)
pdf.set_x(MARGIN_L)
pdf.set_font("Sans", "B", 9.5)
pdf.cell(CONTENT_W, 7, "  À propos de ce guide", border="LTR", fill=True,
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "", 8.8)
pdf.set_x(MARGIN_L)
pdf.multi_cell(CONTENT_W, 5.2,
    "  Ce guide est destiné aux agents et techniciens chargés de l'assistance aux utilisateurs "
    "de mobiTrace. Il définit les trois niveaux d'escalade (N1 agent, N2 support technique, "
    "N3 infrastructure), fournit une procédure de résolution pour chaque problème courant, "
    "recense les questions fréquentes des utilisateurs, et décrit les opérations de gestion "
    "des comptes (création, réinitialisation de mot de passe, gestion des rôles).",
    border="LBR", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_draw_color(*BLACK)

pdf.ln(6)

# Sommaire visuel
pdf.set_font("Sans", "B", 9)
pdf.set_text_color(*BLUE_DARK)
pdf.cell(CONTENT_W, 6, "  Sommaire", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(*BLACK)
sommaire = [
    ("1.", "Présentation de mobiTrace pour les équipes support",  "2"),
    ("2.", "Système d'escalade N1 / N2 / N3",                     "3"),
    ("3.", "Guide de résolution des problèmes courants",           "4–5"),
    ("4.", "FAQ utilisateurs",                                     "6–7"),
    ("5.", "Gestion des comptes et des rôles",                     "8"),
    ("6.", "Contacts et ressources",                               "8"),
]
for num, titre, page in sommaire:
    pdf.set_x(MARGIN_L + 6)
    pdf.set_font("Sans", "B", 8.8)
    nw = pdf.get_string_width(num) + 2
    pdf.cell(nw, 6, num, new_x=XPos.RIGHT, new_y=YPos.LAST)
    pdf.set_font("Sans", "", 8.8)
    pdf.cell(CONTENT_W - nw - 15, 6, titre, new_x=XPos.RIGHT, new_y=YPos.LAST)
    pdf.set_font("Sans", "I", 8.2)
    pdf.set_text_color(*BLUE_MED)
    pdf.cell(15, 6, page, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*BLACK)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 2 — PRÉSENTATION POUR LES ÉQUIPES SUPPORT
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("1. Présentation de mobiTrace pour les équipes support")

pdf.h2("1.1  Qu'est-ce que mobiTrace ?")
pdf.body(
    "mobiTrace (nom applicatif : TRACE) est une application web souveraine développée par "
    "la DGFiP pour gérer l'inventaire du mobilier et des équipements administratifs. "
    "Elle permet aux agents de consulter, saisir, modifier et tracer le parc mobilier "
    "via des QR codes, avec une application satellite (PWA) utilisable hors réseau."
)
pdf.body(
    "L'application est accessible uniquement sur le réseau interne DGFiP, via navigateur web "
    "(HTTPS). Il n'existe pas d'application mobile native : la PWA mobiTrace-SCAN s'installe "
    "depuis le navigateur du terminal mobile."
)

pdf.h2("1.2  Les trois rôles utilisateurs")
pdf.ln(1)
w_roles = [28, 35, CONTENT_W - 28 - 35]
pdf.table_row(["Rôle", "Nom affiché", "Droits"], w_roles,
              header=True, fill_color=BLUE_DARK)
roles = [
    ("lecteur",        "Lecteur",        "Consultation seule — aucune modification possible"),
    ("agent",          "Agent",          "Consultation + modification du statut des mobiliers"),
    ("administrateur", "Administrateur", "Accès complet : gabarits, comptes, purge, configuration"),
]
colors = [GREEN_LIGHT, BLUE_LIGHT, ORANGE_LIGHT]
for row, color in zip(roles, colors):
    pdf.table_row(row, w_roles, fill_color=color)

pdf.ln(2)
pdf.note(
    "Le rôle est attribué à la création du compte et peut être modifié par un administrateur. "
    "Un agent ne peut pas créer de nouveaux mobiliers — il peut uniquement modifier le statut "
    "(en_service, en_maintenance, dispo_reemploi, au_rebut) des équipements existants.",
    color=BLUE_LIGHT
)

pdf.h2("1.3  Statuts des mobiliers")
pdf.ln(1)
w_stat = [40, CONTENT_W - 40]
pdf.table_row(["Statut", "Signification"], w_stat, header=True, fill_color=BLUE_DARK)
statuts = [
    ("en_service",      "Mobilier en cours d'utilisation dans un bureau ou un espace"),
    ("en_maintenance",  "Mobilier sorti du service pour réparation ou vérification"),
    ("dispo_reemploi",  "Mobilier disponible pour réaffectation à un autre service"),
    ("au_rebut",        "Mobilier hors d'usage, en attente de mise au rebut formelle (PV requis)"),
]
for i, row in enumerate(statuts):
    pdf.table_row(row, w_stat, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.h2("1.4  Architecture simplifiée (vue support)")
pdf.body(
    "mobiTrace repose sur deux machines. La connaissance de cette architecture permet "
    "de mieux orienter les tickets vers le bon niveau de support."
)
pdf.ln(1)
w_arch = [40, 35, CONTENT_W - 40 - 35]
pdf.table_row(["Composant", "Machine", "Impact panne"], w_arch,
              header=True, fill_color=BLUE_DARK)
archi = [
    ("Interface web (Nginx)",    "Serveur TRACE", "Application inaccessible (erreur connexion)"),
    ("API (PostgREST)",           "Serveur TRACE", "Erreur 502 — interface charge mais plantée"),
    ("Base de données (PostgreSQL)", "Serveur TRACE", "Perte de toutes les données en ligne"),
    ("Sauvegardes (NFS)",         "Serveur NFS",   "Sauvegardes échouent, données en ligne OK"),
    ("Impression Zebra",          "Serveur TRACE", "Impression impossible, reste OK"),
]
for i, row in enumerate(archi):
    pdf.table_row(row, w_arch, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 3 — SYSTÈME D'ESCALADE
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("2. Système d'escalade N1 / N2 / N3")

pdf.body(
    "Toute demande d'assistance doit être traitée au niveau le plus bas capable de la résoudre. "
    "L'escalade vers le niveau supérieur se fait uniquement si le problème dépasse les "
    "compétences ou les droits du niveau courant, ou si le délai de résolution est dépassé."
)

pdf.escalade_badge("N1 — Support utilisateur", "Agent référent / Responsable de service",
                   GREEN_OK, GREEN_LIGHT)
pdf.body(
    "Périmètre : questions d'utilisation, problèmes de compte (mot de passe oublié, accès refusé), "
    "comportements inattendus de l'interface, assistance à la saisie."
)
pdf.ln(1)
w_n = [55, 25, CONTENT_W - 55 - 25]
pdf.table_row(["Problème", "Délai résolution", "Action"], w_n,
              header=True, fill_color=GREEN_OK)
for row in [
    ("Mot de passe oublié",             "< 15 min",  "Contacter un administrateur mobiTrace (§5)"),
    ("Accès refusé (rôle incorrect)",   "< 30 min",  "Vérifier le rôle auprès de l'administrateur"),
    ("Interface lente",                 "< 30 min",  "Vider le cache navigateur, réessayer"),
    ("QR code non reconnu à la saisie", "< 15 min",  "Saisir l'ID métier manuellement (MOB-XXXXXX)"),
    ("Impression Zebra KO",             "< 1h",      "Escalader N2 si non résolu en 15 min"),
    ("Export CSV vide",                 "< 15 min",  "Vérifier les filtres actifs dans l'interface"),
]:
    pdf.table_row(row, w_n, fill_color=GREEN_LIGHT)

pdf.note(
    "Critère d'escalade N1 → N2 : problème non résolu après 1 heure, ou problème technique "
    "sans action possible depuis l'interface (erreur 502, 503, 500, application inaccessible).",
    color=GREEN_LIGHT
)

pdf.escalade_badge("N2 — Support technique mobiTrace", "Équipe technique DGFiP",
                   ORANGE_WARN, ORANGE_LIGHT)
pdf.body(
    "Périmètre : redémarrage des services, diagnostic des logs, gestion des comptes en base, "
    "problèmes d'impression Zebra, lenteurs base de données, restauration de données."
)
pdf.ln(1)
pdf.table_row(["Problème", "Délai résolution", "Action"], w_n,
              header=True, fill_color=ORANGE_WARN)
for row in [
    ("Application inaccessible (erreur 502/503)", "< 30 min", "Redémarrer les services (PCI §3.1)"),
    ("Lenteur persistante (> 5 sec)",              "< 1h",     "Analyser pg_stat_activity"),
    ("Création / suppression de compte",           "< 2h",     "Interface admin ou commande SQL (§5)"),
    ("Sauvegarde NFS échouée (email ALERTE)",      "< 2h",     "Vérifier montage NFS, relancer backup"),
    ("Impression Zebra KO",                        "< 2h",     "Vérifier CUPS, service mobitrace-print"),
    ("Données incohérentes ou manquantes",         "< 4h",     "Analyser audit_logs, restauration si nécessaire"),
]:
    pdf.table_row(row, w_n, fill_color=ORANGE_LIGHT)

pdf.note(
    "Critère d'escalade N2 → N3 : panne matérielle, perte totale des données, incident de sécurité "
    "(intrusion, ransomware), indisponibilité dépassant le RTO de 4 heures.",
    color=ORANGE_LIGHT
)

pdf.escalade_badge("N3 — Infrastructure et sécurité DGFiP", "RSSI / Infrastructure DGFiP",
                   RED_CRIT, RED_LIGHT)
pdf.body(
    "Périmètre : sinistre matériel, panne réseau, incident de sécurité confirmé, "
    "dépassement du RTO, reconstruction complète (PRA). L'activation du N3 implique "
    "systématiquement la notification du RSSI DGFiP."
)
pdf.ln(1)
pdf.table_row(["Problème", "Délai résolution", "Action"], w_n,
              header=True, fill_color=RED_CRIT)
for row in [
    ("Panne matérielle serveur TRACE",  "< 4h (RTO)",  "Activer PRA S4 — reconstruction bare metal"),
    ("Ransomware / compromission",       "< 4h (RTO)",  "Activer PRA S3 + notification RSSI"),
    ("Perte données non restaurables",   "< 4h (RTO)",  "Activer PRA, escalader RSSI"),
    ("Panne réseau interne DGFiP",       "Variable",    "Infrastructure DGFiP — hors périmètre mobiTrace"),
]:
    pdf.table_row(row, w_n, fill_color=RED_LIGHT)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 4 — RÉSOLUTION DES PROBLÈMES (1/2)
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("3. Guide de résolution des problèmes courants")

pdf.body(
    "Chaque fiche indique le niveau de support requis [N1/N2/N3], les causes les plus "
    "fréquentes et les actions à mener dans l'ordre. Escalader si la résolution échoue."
)

pdf.probleme_bloc(
    symptome="L'utilisateur ne peut pas se connecter — message « Identifiants incorrects »",
    causes="Mot de passe erroné (casse, caractères spéciaux) ; compte inexistant ; email saisi avec une coquille.",
    resolution="1. Vérifier l'email exact (copier-coller depuis l'annuaire). "
               "2. Si le compte existe, réinitialiser le mot de passe (§5.2). "
               "3. Si le compte n'existe pas, le créer (§5.1).",
    niveau="N1",
    escalade="Si l'erreur persiste après réinitialisation → N2 (vérifier l'état de PostgreSQL)."
)

pdf.probleme_bloc(
    symptome="L'utilisateur est bloqué — message « Trop de tentatives » ou plus de réponse sur la page de login",
    causes="Fail2Ban a banni l'adresse IP après 5 tentatives échouées en 10 minutes (ban de 1 heure).",
    resolution="1. Attendre 1 heure (le ban expire automatiquement). "
               "2. Si l'urgence le justifie, demander à N2 de débloquer manuellement.",
    niveau="N2",
    code_block="# Débloquer une IP bannie par Fail2Ban\nsudo fail2ban-client set mobitrace-login unbanip <ADRESSE_IP>\n\n# Vérifier les IPs actuellement bannies\nsudo fail2ban-client status mobitrace-login",
    escalade=None
)

pdf.probleme_bloc(
    symptome="Erreur 502 Bad Gateway — l'interface charge mais toutes les requêtes échouent",
    causes="Le service trace-api (PostgREST) est arrêté ou ne répond plus. "
           "Cause fréquente : redémarrage de PostgreSQL sans redémarrage de trace-api.",
    resolution="Redémarrer trace-api, puis vérifier le service.",
    niveau="N2",
    code_block="sudo systemctl restart trace-api\nsystemctl status trace-api\n\n# Si le service ne démarre pas : vérifier les logs\njournalctl -u trace-api -n 30",
    escalade="Si trace-api refuse de démarrer → vérifier la désynchronisation JWT (§3.3 du PCI) ou escalader N2."
)

pdf.probleme_bloc(
    symptome="L'application est très lente (> 5 secondes par requête)",
    causes="Trop de connexions simultanées sur PostgreSQL ; requête lente bloquante ; espace disque insuffisant.",
    resolution="1. Vérifier les connexions actives en base. 2. Identifier et terminer les requêtes bloquantes.",
    niveau="N2",
    code_block="# Connexions actives\nsudo -u postgres psql -c 'SELECT pid, state, query_start, query FROM pg_stat_activity;'\n\n# Terminer une requête bloquante (remplacer <pid>)\nsudo -u postgres psql -c 'SELECT pg_terminate_backend(<pid>);'\n\n# Vérifier l'espace disque\ndf -h /var/lib/postgresql/",
    escalade=None
)

pdf.probleme_bloc(
    symptome="La session expire en permanence — l'utilisateur est déconnecté après quelques minutes",
    causes="Le token JWT a une durée de vie de 8 heures. Si les sessions expirent avant, "
           "il peut s'agir d'une désynchronisation du secret JWT (ex. après une restauration).",
    resolution="1. Vérifier que l'heure système du serveur est correcte (NTP). "
               "2. Vérifier la cohérence du secret JWT entre la base et PostgREST.",
    niveau="N2",
    code_block="# Vérifier l'heure système\ntimedatectl status\n\n# Comparer le secret JWT entre la base et PostgREST\nJWT_DB=$(sudo -u postgres psql -d parc_mobilier -t -A \\\n    -c \"SELECT value FROM auth.secrets WHERE key = 'jwt_secret';\")\nJWT_CONF=$(grep '^jwt-secret' /etc/trace-api.conf | cut -d'\"' -f2)\n[ \"$JWT_DB\" = \"$JWT_CONF\" ] && echo 'JWT OK' || echo 'DÉSYNCHRONISATION DÉTECTÉE'",
    escalade=None
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 5 — RÉSOLUTION DES PROBLÈMES (2/2)
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h2("(suite — Problèmes courants)")

pdf.probleme_bloc(
    symptome="Impression Zebra impossible — bouton actif mais aucune étiquette ne sort",
    causes="Service mobitrace-print arrêté ; CUPS ne communique plus avec l'imprimante réseau ; "
           "IP de l'imprimante Zebra changée.",
    resolution="1. Vérifier l'état du service et de CUPS. "
               "2. Vérifier la connectivité réseau vers l'imprimante. "
               "3. Mettre à jour l'IP si nécessaire via l'interface admin.",
    niveau="N2",
    code_block="# Vérifier le service d'impression\nsystemctl status mobitrace-print\nsudo systemctl restart mobitrace-print\n\n# Vérifier la connectivité imprimante (remplacer <IP_ZEBRA>)\nping -c 3 <IP_ZEBRA>\n\n# Vérifier CUPS\nlpstat -p Zebra_Trace",
    escalade=None
)

pdf.probleme_bloc(
    symptome="La PWA mobiTrace-SCAN ne se synchronise plus après une session hors ligne",
    causes="Token JWT expiré pendant la session hors ligne (durée de vie 8h). "
           "La PWA doit être reconnectée dès le retour en réseau.",
    resolution="1. Demander à l'agent de se reconnecter à mobiTrace-SCAN depuis l'URL principale "
               "sur le réseau interne. 2. Si le problème persiste, vider le cache de l'application "
               "dans les paramètres du navigateur (Paramètres → Applications → mobiTrace-SCAN → "
               "Vider le cache).",
    niveau="N1",
    escalade="Si le rechargement ne résout pas le problème → N2 (vérifier les logs Nginx pour erreurs 401/403)."
)

pdf.probleme_bloc(
    symptome="Export CSV vide ou incomplet",
    causes="Filtres actifs réduisant le résultat à zéro ; droits insuffisants (rôle lecteur sans accès à certaines structures) ; bug de génération côté client.",
    resolution="1. Demander à l'utilisateur de vérifier et supprimer tous les filtres actifs. "
               "2. Vérifier que le rôle de l'utilisateur lui donne accès aux données attendues. "
               "3. Essayer depuis un autre navigateur (Chrome/Firefox récent recommandé).",
    niveau="N1",
    escalade="Si le problème touche plusieurs utilisateurs simultanément → N2 (anomalie applicative)."
)

pdf.probleme_bloc(
    symptome="L'email de surveillance des sauvegardes indique [ALERTE CRITIQUE]",
    causes="Aucun dump PostgreSQL reçu sur le serveur NFS depuis la veille. "
           "Causes : montage NFS perdu sur le serveur TRACE ; serveur NFS éteint ; réseau entre les deux machines.",
    resolution="1. Vérifier le montage NFS sur le serveur TRACE. "
               "2. Relancer manuellement une sauvegarde. "
               "3. Vérifier l'état du serveur NFS.",
    niveau="N2",
    code_block="# Vérifier le montage NFS\ndf -h /mnt/savetrace\n\n# Forcer le montage\nsudo mount /mnt/savetrace\n\n# Relancer une sauvegarde manuelle\nsudo /usr/local/bin/trace_backup.sh\n\n# Vérifier les dumps présents\nls -lth /mnt/savetrace/trace_backup_*.dump | head -5",
    escalade="Si le serveur NFS est inaccessible → Procédure PRA S5 (sauvegarde locale temporaire)."
)

pdf.probleme_bloc(
    symptome="Alerte navigateur : « Certificat non sécurisé » ou « Votre connexion n'est pas privée »",
    causes="mobiTrace utilise un certificat SSL auto-signé généré à l'installation. "
           "Ce comportement est normal si aucun certificat institutionnel n'a été installé.",
    resolution="1. Informer l'utilisateur que l'alerte est attendue (certificat interne). "
               "2. Lui montrer comment ajouter une exception permanente dans son navigateur. "
               "3. Pour Chrome : Paramètres avancés → Continuer vers le site. "
               "Pour Firefox : Accepter le risque et continuer.",
    niveau="N1",
    escalade="Pour supprimer définitivement l'alerte → N2/N3 : installer un certificat institutionnel DGFiP (IGC/A)."
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 6 — FAQ UTILISATEURS (1/2)
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("4. FAQ utilisateurs")

pdf.body(
    "Questions fréquentes posées par les agents. Le badge indique à quel niveau de support "
    "la réponse doit être apportée."
)

pdf.faq_item(
    "Comment me connecter à mobiTrace depuis mon poste ?",
    "Ouvrir un navigateur (Chrome ou Firefox recommandé) et saisir l'adresse HTTPS du serveur "
    "mobiTrace communiquée par votre responsable informatique. Saisir votre email DGFiP et "
    "votre mot de passe, puis cliquer sur Connexion. Si votre navigateur affiche une alerte "
    "de certificat, cliquer sur « Paramètres avancés » puis « Continuer » (comportement normal).",
    niveau_badge="N1", badge_color=GREEN_OK, badge_bg=GREEN_LIGHT
)

pdf.faq_item(
    "J'ai oublié mon mot de passe. Que faire ?",
    "mobiTrace ne propose pas de réinitialisation autonome par email. Contacter votre "
    "administrateur mobiTrace ou l'équipe support, qui réinitialisera votre mot de passe "
    "depuis le panneau d'administration. Vous pourrez le modifier dès votre prochaine connexion "
    "depuis le menu Mon compte.",
    niveau_badge="N1", badge_color=GREEN_OK, badge_bg=GREEN_LIGHT
)

pdf.faq_item(
    "Je vois le mobilier mais je ne peux pas modifier son statut. Pourquoi ?",
    "Vous êtes connecté avec le rôle Lecteur, qui permet uniquement la consultation. "
    "Le rôle Agent est nécessaire pour modifier le statut des mobiliers. "
    "Contacter votre administrateur mobiTrace pour qu'il mette à jour votre rôle.",
    niveau_badge="N1", badge_color=GREEN_OK, badge_bg=GREEN_LIGHT
)

pdf.faq_item(
    "Comment scanner un QR code avec mobiTrace-SCAN sur le terrain ?",
    "1. Ouvrir mobiTrace-SCAN dans le navigateur de votre terminal mobile (l'URL vous a été "
    "communiquée par votre responsable). 2. Se connecter avec vos identifiants habituels. "
    "3. Appuyer sur le bouton Scanner et pointer la caméra vers le QR code. "
    "4. Si la caméra ne fonctionne pas, saisir manuellement l'ID métier (format MOB-000001). "
    "5. En mode hors ligne (sous-sol, cave, archive), les modifications sont mises en file "
    "d'attente et synchronisées automatiquement dès le retour en réseau.",
    niveau_badge="N1", badge_color=GREEN_OK, badge_bg=GREEN_LIGHT
)

pdf.faq_item(
    "Comment générer un Procès-Verbal de mise au rebut ?",
    "1. Dans mobiTrace, passer les mobiliers concernés au statut au_rebut. "
    "2. Sélectionner les mobiliers concernés (cases à cocher). "
    "3. Cliquer sur Générer PV de mise au rebut. "
    "4. Le PDF est généré directement dans votre navigateur (aucun envoi réseau). "
    "5. Imprimer et faire signer le document par le responsable habilité.",
    niveau_badge="N1", badge_color=GREEN_OK, badge_bg=GREEN_LIGHT
)

pdf.faq_item(
    "Comment imprimer une étiquette QR code sur l'imprimante Zebra ?",
    "1. Ouvrir la fiche du mobilier dans mobiTrace. "
    "2. Cliquer sur Imprimer l'étiquette (bouton Zebra). "
    "3. L'étiquette est envoyée directement à l'imprimante réseau Zebra configurée. "
    "Si le bouton ne répond pas, vérifier que l'imprimante est allumée et en ligne. "
    "En cas d'erreur persistante, contacter le support N2.",
    niveau_badge="N1", badge_color=GREEN_OK, badge_bg=GREEN_LIGHT
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 7 — FAQ UTILISATEURS (2/2)
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h2("(suite — FAQ utilisateurs)")

pdf.faq_item(
    "Comment exporter la liste des mobiliers en CSV ?",
    "1. Appliquer les filtres souhaités dans la liste des mobiliers (lieu, structure, statut, "
    "catégorie). 2. Cliquer sur Exporter en CSV en bas de la liste. "
    "3. Le fichier est généré entièrement dans votre navigateur sans passer par le serveur. "
    "Si l'export est vide, vérifier que des filtres ne masquent pas tous les résultats "
    "(bouton Réinitialiser les filtres).",
    niveau_badge="N1", badge_color=GREEN_OK, badge_bg=GREEN_LIGHT
)

pdf.faq_item(
    "Comment ajouter un nouveau gabarit d'équipement au catalogue ?",
    "La création de gabarits est réservée au rôle Administrateur. "
    "1. Se connecter avec un compte administrateur. "
    "2. Aller dans le menu Catalogue → Nouveau gabarit. "
    "3. Renseigner la référence catalogue (unique), la catégorie, le nom descriptif, "
    "et les caractéristiques (format JSON structuré). "
    "4. Une photo peut être ajoutée (encodée en base64 automatiquement par l'interface). "
    "Si vous n'avez pas le rôle administrateur, contacter l'équipe support.",
    niveau_badge="N1", badge_color=GREEN_OK, badge_bg=GREEN_LIGHT
)

pdf.faq_item(
    "Comment afficher l'historique des modifications d'un mobilier ?",
    "Chaque modification de statut ou d'affectation est enregistrée automatiquement dans "
    "le journal d'audit. Pour consulter l'historique : "
    "1. Ouvrir la fiche du mobilier. "
    "2. Cliquer sur l'onglet Historique (ou icône horloge selon la version). "
    "3. L'historique affiche la date, l'auteur et l'action pour chaque modification. "
    "L'audit log est en lecture seule pour tous les rôles.",
    niveau_badge="N1", badge_color=GREEN_OK, badge_bg=GREEN_LIGHT
)

pdf.faq_item(
    "Comment fonctionner sans mobiTrace si l'application est indisponible ?",
    "En cas d'indisponibilité, appliquer les procédures du mode dégradé (PCA §3.2) : "
    "1. Consultation : utiliser le dernier export CSV sauvegardé localement. "
    "2. Saisie de nouvelles affectations : renseigner une fiche papier temporaire "
    "(ID métier MOB-XXXXXX, lieu, structure, statut, date, agent). "
    "3. Les saisies papier seront intégrées dans mobiTrace dans les 24h suivant "
    "la remise en service. Ne pas dupliquer les enregistrements.",
    niveau_badge="N1", badge_color=GREEN_OK, badge_bg=GREEN_LIGHT
)

pdf.faq_item(
    "Mon compte a été créé mais je reçois « Identifiants incorrects » à la connexion",
    "1. Vérifier que le mot de passe communiqué est saisi exactement (respect de la casse, "
    "caractères spéciaux). 2. Copier-coller le mot de passe depuis le message reçu. "
    "3. Vérifier que le champ email correspond exactement à celui enregistré "
    "(sensible à la casse). 4. Si le problème persiste, demander une réinitialisation du "
    "mot de passe à l'administrateur (§5.2).",
    niveau_badge="N1", badge_color=GREEN_OK, badge_bg=GREEN_LIGHT
)

pdf.faq_item(
    "Comment vérifier quel rôle est attribué à un compte utilisateur ?",
    "Depuis l'interface administrateur : Menu Administration → Gestion des utilisateurs. "
    "La liste affiche l'email, le nom et le rôle de chaque compte. "
    "Depuis la ligne de commande (N2) :",
    niveau_badge="N2", badge_color=ORANGE_WARN, badge_bg=ORANGE_LIGHT
)
pdf.code("sudo -u postgres psql -d parc_mobilier \\\n    -c \"SELECT email, nom_complet, role FROM utilisateurs ORDER BY role, email;\"")

pdf.faq_item(
    "Peut-on avoir deux sessions simultanées avec le même compte ?",
    "Oui. mobiTrace utilise des tokens JWT stateless : chaque connexion génère un token "
    "indépendant valide 8 heures. Deux sessions simultanées sont possibles (ex. poste fixe + "
    "terminal mobile). La déconnexion sur l'un n'affecte pas l'autre. "
    "Il n'existe pas de mécanisme de détection de sessions multiples.",
    niveau_badge="N1", badge_color=GREEN_OK, badge_bg=GREEN_LIGHT
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 8 — GESTION DES COMPTES + CONTACTS
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("5. Gestion des comptes et des rôles")

pdf.body(
    "Les opérations de gestion des comptes nécessitent le rôle administrateur. "
    "Elles peuvent être effectuées depuis l'interface web (panel Administration) "
    "ou directement en base de données (N2 uniquement)."
)

pdf.h2("5.1  Créer un compte utilisateur")
pdf.body("Depuis l'interface web (recommandé) : Menu Administration → Utilisateurs → Nouvel utilisateur → "
         "saisir l'email, un mot de passe temporaire et le rôle souhaité.")
pdf.body("Depuis la base de données (N2) :")
pdf.code(
    "-- Créer un compte (rôle : 'lecteur', 'agent' ou 'administrateur')\n"
    "sudo -u postgres psql -d parc_mobilier -c \\\n"
    "    \"SELECT public.creer_utilisateur(\n"
    "        'prenom.nom@dgfip.finances.gouv.fr',\n"
    "        'MotDePasseTemporaire!2026',\n"
    "        'agent'\n"
    "    );\""
)
pdf.note(
    "Le mot de passe est haché automatiquement (Bcrypt) — ne jamais le stocker en clair. "
    "Communiquer le mot de passe temporaire par canal sécurisé et demander à l'agent de le "
    "changer à la première connexion.",
    color=ORANGE_LIGHT
)

pdf.h2("5.2  Réinitialiser un mot de passe")
pdf.body("Depuis l'interface web : Menu Administration → Utilisateurs → Sélectionner le compte → Réinitialiser le mot de passe.")
pdf.body("Depuis la base de données (N2) :")
pdf.code(
    "-- Réinitialiser le mot de passe d'un utilisateur\n"
    "sudo -u postgres psql -d parc_mobilier -c \\\n"
    "    \"SELECT public.reinitialiser_mdp(\n"
    "        'prenom.nom@dgfip.finances.gouv.fr',\n"
    "        'NouveauMotDePasse!2026'\n"
    "    );\""
)

pdf.h2("5.3  Modifier le rôle d'un utilisateur")
pdf.body("Depuis l'interface web : Administration → Utilisateurs → Modifier le rôle.")
pdf.body("Depuis la base de données (N2) :")
pdf.code(
    "-- Changer le rôle (valeurs : 'lecteur', 'agent', 'administrateur')\n"
    "sudo -u postgres psql -d parc_mobilier -c \\\n"
    "    \"UPDATE utilisateurs SET role = 'administrateur'\n"
    "     WHERE email = 'prenom.nom@dgfip.finances.gouv.fr';\""
)

pdf.h2("5.4  Désactiver un compte (agent quittant le service)")
pdf.body(
    "mobiTrace ne dispose pas d'un statut « inactif » natif. Pour désactiver un compte "
    "d'un agent quittant le service, deux approches :"
)
pdf.bullet("Option 1 (recommandée) : Changer le rôle en lecteur et modifier l'email pour le rendre inopérant.")
pdf.bullet("Option 2 : Supprimer le compte (irréversible — vérifier que l'agent n'est plus auteur d'audit logs nécessaires).")
pdf.code(
    "-- Option 1 : neutraliser le compte\n"
    "sudo -u postgres psql -d parc_mobilier -c \\\n"
    "    \"UPDATE utilisateurs SET role = 'lecteur',\n"
    "     email = 'desactive_prenom.nom@dgfip.finances.gouv.fr'\n"
    "     WHERE email = 'prenom.nom@dgfip.finances.gouv.fr';\"\n\n"
    "-- Option 2 : supprimer le compte\n"
    "sudo -u postgres psql -d parc_mobilier -c \\\n"
    "    \"DELETE FROM utilisateurs WHERE email = 'prenom.nom@dgfip.finances.gouv.fr';\""
)

pdf.h1("6. Contacts et ressources")

pdf.ln(1)
w_c = [45, 55, CONTENT_W - 45 - 55]
pdf.table_row(["Contact", "Coordonnées", "Disponibilité"], w_c,
              header=True, fill_color=BLUE_DARK)
contacts = [
    ("Support N2 — Équipe technique", "equipe.support@dgfip.finances.gouv.fr", "Heures ouvrées"),
    ("Responsable PCA",               "À compléter",                            "H24 (PCA activé)"),
    ("RSSI DGFiP",                    "À compléter",                            "H24 (incident SSI)"),
    ("Infrastructure DGFiP",          "À compléter",                            "H24 (N3)"),
]
for i, row in enumerate(contacts):
    pdf.table_row(row, w_c, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.ln(3)
pdf.h2("Documents de référence")
pdf.bullet("TRACE-PCA-2026 — Plan de Continuité d'Activité (procédures mode dégradé)")
pdf.bullet("TRACE-PCI-2026 — Plan de Continuité Informatique (redémarrage des services)")
pdf.bullet("TRACE-PRA-2026 — Plan de Reprise d'Activité (restauration après sinistre)")
pdf.bullet("TRACE-SEC-DATA-2026 — Arbitrage criticité des données")
pdf.bullet("README mobiTrace — Architecture et procédures d'installation")

pdf.ln(3)
pdf.note(
    "Document généré automatiquement par generate_guide_support_pdf.py (dépôt mobiTrace). "
    "Pour toute question ou mise à jour : equipe.support@dgfip.finances.gouv.fr",
    color=GREY_LIGHT
)

OUTPUT = "/home/adm1/TRACE/TRACE_Guide_Assistance.pdf"
pdf.output(OUTPUT)
print(f"PDF généré : {OUTPUT}")
