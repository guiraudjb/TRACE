"""
Génération du document PDF : Plan de Continuité Informatique (PCI) — mobiTrace / DGFiP
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
RED_CRIT    = (180,  20,  20)
RED_LIGHT   = (255, 225, 225)
ORANGE_LIGHT= (255, 245, 215)
GREEN_LIGHT = (220, 255, 220)

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
            f"PCI — Plan de Continuité Informatique mobiTrace  |  "
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

    def code(self, text):
        self.ln(1)
        lines = text.split("\n")
        self.set_fill_color(28, 28, 35)
        self.set_text_color(160, 255, 160)
        self.set_font("Mono", "", 7.5)
        for line in lines:
            self.set_x(MARGIN_L)
            self.cell(CONTENT_W, 4.8, f"  {line}", fill=True,
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*BLACK)
        self.ln(1)

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

    def stars(self, n, total=4):
        return "★" * n + "☆" * (total - n)

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
pdf.set_title("Plan de Continuité Informatique — mobiTrace")
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
pdf.cell(0, 9, "Plan de Continuité Informatique", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "", 12)
pdf.cell(0, 8, "PCI — Architecture, surveillance et procédures de reprise", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(*BLACK)

pdf.ln(5)
pdf.set_line_width(0.4)
pdf.line(MARGIN_L, pdf.get_y(), PAGE_W - MARGIN_R, pdf.get_y())
pdf.ln(8)

meta = [
    ("Référence",  "TRACE-PCI-2026"),
    ("Version",    "1.0"),
    ("Date",       TODAY),
    ("Diffusion",  "Restreinte — Usage interne"),
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

# Résumé exécutif
pdf.set_fill_color(*BLUE_LIGHT)
pdf.set_draw_color(*BLUE_MED)
pdf.set_line_width(0.5)
pdf.set_x(MARGIN_L)
pdf.set_font("Sans", "B", 9.5)
pdf.cell(CONTENT_W, 7, "  Résumé exécutif", border="LTR", fill=True,
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "", 8.8)
resume = (
    "Ce document constitue le Plan de Continuité Informatique (PCI) de mobiTrace, "
    "application souveraine de gestion d'inventaire mobilier de la DGFiP. "
    "Il décrit l'architecture de référence, les procédures de surveillance et de détection "
    "d'incidents, les modes dégradés, les séquences de redémarrage des services et le "
    "calendrier de maintenance préventive.\n\n"
    "Objectifs : RTO = 4 heures (délai maximal de remise en service), "
    "RPO = 12 heures (perte de données maximale tolérée). "
    "Le PCI est complémentaire du PCA (Plan de Continuité d'Activité) et du PRA "
    "(Plan de Reprise d'Activité)."
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
    "  Avertissement — Ce document contient des informations relatives à l'architecture "
    "et aux procédures de sécurité de l'infrastructure. Ne pas diffuser hors des équipes habilitées.",
    border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT
)
pdf.set_draw_color(*BLACK)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 2 — ARCHITECTURE ET SPOF
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("1. Architecture de référence")

pdf.h2("1.1  Cartographie des composants")
pdf.ln(1)

w5 = [44, 34, 28, 30, CONTENT_W - 44 - 34 - 28 - 30]
pdf.table_row(["Composant", "Machine", "Port / Config", "Dépendance", "Criticité"],
              w5, header=True, fill_color=BLUE_DARK)
rows_compo = [
    ("Nginx (reverse proxy / SSL)", "Serveur TRACE", "80 / 443",        "—",           "Critique"),
    ("PostgREST (trace-api)",       "Serveur TRACE", "3000 (loopback)", "postgresql",  "Critique"),
    ("PostgreSQL 17",               "Serveur TRACE", "5432 (loopback)", "—",           "Critique"),
    ("Fail2Ban",                    "Serveur TRACE", "—",               "nginx logs",  "Élevée"),
    ("Montage NFS",                 "Serveur TRACE", "/mnt/savetrace",  "Serveur NFS", "Élevée"),
    ("Serveur NFS",                 "Machine NFS",   "2049",            "—",           "Élevée"),
    ("mobitrace-print (optionnel)", "Serveur TRACE", "5050",            "cups",        "Faible"),
]
crit_colors = {
    "Critique": RED_LIGHT,
    "Élevée":   ORANGE_LIGHT,
    "Faible":   GREEN_LIGHT,
}
for row in rows_compo:
    color = crit_colors.get(row[4], WHITE)
    pdf.table_row(row, w5, fill_color=color)

pdf.ln(2)

pdf.h2("1.2  Points de défaillance uniques (SPOF)")
pdf.body("L'architecture actuelle présente les points de défaillance uniques suivants, par ordre de criticité :")
pdf.ln(1)

w3a = [52, 60, CONTENT_W - 52 - 60]
pdf.table_row(["SPOF", "Impact", "Mitigation actuelle"], w3a,
              header=True, fill_color=BLUE_DARK)
rows_spof = [
    ("Serveur TRACE (machine unique)",
     "Arrêt total de l'application",
     "Restauration sur nouvelle machine via PRA"),
    ("Base PostgreSQL (instance unique)",
     "Perte d'accès aux données",
     "Sauvegardes NFS 2x/jour, restore < 1h"),
    ("Serveur NFS (machine unique)",
     "Perte des sauvegardes récentes",
     "Rétention 30j, backup local temporaire"),
    ("Secret JWT (point de confiance)",
     "Compromission de toutes les sessions",
     "Rotation manuelle (procédure §3.5)"),
]
for i, row in enumerate(rows_spof):
    pdf.table_row(row, w3a, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.ln(1)
pdf.note(
    "L'absence de haute disponibilité (HA) est un choix architectural délibéré pour minimiser "
    "la complexité. Le RTO de 4h est atteignable par restauration sur bare metal, sans clustering.",
    color=(255, 245, 215)
)

pdf.h2("1.3  Flux de données et dépendances")
pdf.body("Séquence d'appel pour une requête HTTP standard :")
pdf.code(
    "Navigateur → HTTPS:443 → Nginx → vérif. cookie JWT → HTTP:3000 → PostgREST\n"
    "PostgREST  → vérifie JWT (secret dans auth.secrets) → SQL → PostgreSQL:5432\n"
    "PostgreSQL → logique métier (triggers, RBAC, RLS) → résultat → PostgREST → Nginx → Navigateur"
)
pdf.body(
    "En cas de panne d'un composant, toute la chaîne en aval est affectée. "
    "PostgreSQL est le composant fondamental : sans lui, aucun autre service n'est fonctionnel."
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 3 — SURVEILLANCE ET DÉTECTION
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("2. Surveillance et détection des incidents")

pdf.h2("2.1  Sondes actives en place")
pdf.ln(1)
w4 = [46, 50, 30, CONTENT_W - 46 - 50 - 30]
pdf.table_row(["Sonde", "Mécanisme", "Fréquence", "Alerte"], w4,
              header=True, fill_color=BLUE_DARK)
rows_sondes = [
    ("Sauvegarde NFS",
     "Script mobitrace_backup_survey.sh",
     "Quotidien 08h00",
     "Email : OK / AVERTISSEMENT / ALERTE CRITIQUE"),
    ("Redémarrage services",
     "Restart=always dans les units systemd",
     "Continu",
     "Journal systemd"),
    ("Anti-bruteforce",
     "Fail2Ban filtre nginx-trace",
     "Temps réel",
     "Journal fail2ban"),
]
for i, row in enumerate(rows_sondes):
    pdf.table_row(row, w4, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.ln(2)

pdf.h2("2.2  Procédure de diagnostic — Arbre décisionnel")
pdf.body("Face à un signalement d'indisponibilité, suivre cette séquence dans l'ordre :")
pdf.code(
    "# Étape 1 : vérifier les services systemd\n"
    "systemctl status nginx trace-api postgresql fail2ban\n"
    "\n"
    "# Étape 2 : tester la connectivité applicative\n"
    "curl -sk https://localhost/api/rpc/me | head -c 200\n"
    "\n"
    "# Étape 3 : vérifier les logs récents\n"
    "journalctl -u trace-api -u nginx --since '30 min ago' | tail -50\n"
    "\n"
    "# Étape 4 : vérifier PostgreSQL\n"
    "sudo -u postgres psql -c 'SELECT version();'\n"
    "\n"
    "# Étape 5 : vérifier le montage NFS\n"
    "df -h /mnt/savetrace && ls -lt /mnt/savetrace | head -5"
)

pdf.h2("2.3  Indicateurs d'alerte")
pdf.ln(1)
w3b = [62, 42, CONTENT_W - 62 - 42]
pdf.table_row(["Indicateur", "Seuil d'alerte", "Action"], w3b,
              header=True, fill_color=BLUE_DARK)
rows_ind = [
    ("Codes HTTP 5xx sur /api/",    "> 5 en 5 min",       "Diagnostic §2.2"),
    ("Temps de réponse /api/",      "> 5 secondes",        "Vérifier pg_stat_activity"),
    ("Connexions PostgreSQL",        "> 80 % max_conn.",    "Vérifier PostgREST"),
    ("Espace disque /mnt/savetrace", "< 20 % libre",        "Purge manuelle ou extension NFS"),
    ("Email sonde 08h00 absent",     "Absence > 24h",       "Vérifier serveur NFS et cron"),
    ("Fail2Ban bans",                "> 10 IPs/heure",      "Alerte sécurité → §3.5"),
]
for i, row in enumerate(rows_ind):
    pdf.table_row(row, w3b, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 4 — PROCÉDURES DE REDÉMARRAGE
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("3. Procédures de continuité technique")

pdf.h2("3.1  Séquence de redémarrage des services (priorité)")
pdf.body("En cas de redémarrage nécessaire, respecter impérativement cet ordre :")
pdf.ln(1)

w3c = [12, 50, CONTENT_W - 12 - 50]
pdf.table_row(["Ordre", "Service", "Commande"], w3c, header=True, fill_color=BLUE_DARK)
rows_restart = [
    ("1", "PostgreSQL (fondation)",        "sudo systemctl restart postgresql"),
    ("2", "trace-api (PostgREST)",         "sudo systemctl restart trace-api"),
    ("3", "Nginx (point d'entrée)",        "sudo systemctl reload nginx"),
    ("4", "Fail2Ban (sécurité)",           "sudo systemctl restart fail2ban"),
    ("5", "mobitrace-print (optionnel)",   "sudo systemctl restart mobitrace-print"),
]
colors_restart = [RED_LIGHT, RED_LIGHT, ORANGE_LIGHT, ORANGE_LIGHT, GREEN_LIGHT]
for row, color in zip(rows_restart, colors_restart):
    pdf.table_row(row, w3c, fill_color=color)

pdf.code(
    "# Redémarrage complet de la pile (ordre correct)\n"
    "sudo systemctl restart postgresql\n"
    "sleep 3\n"
    "sudo systemctl restart trace-api\n"
    "sudo systemctl reload nginx\n"
    "sudo systemctl restart fail2ban\n"
    "# Vérification globale\n"
    "systemctl is-active postgresql trace-api nginx fail2ban"
)

pdf.h2("3.2  Mode dégradé — PostgREST indisponible")
pdf.body(
    "Si trace-api ne démarre pas mais que PostgreSQL fonctionne, les données sont préservées. "
    "L'interface web est inaccessible mais aucune donnée n'est perdue."
)
pdf.bullet("Diagnostic : journalctl -u trace-api -n 50")
pdf.bullet("Cause fréquente 1 : désynchronisation du secret JWT → voir §3.3")
pdf.bullet("Cause fréquente 2 : /etc/trace-api.conf corrompu → restaurer depuis sauvegarde du paquet")
pdf.bullet("Vérification config : sudo -u www-data /usr/local/bin/postgrest /etc/trace-api.conf")

pdf.h2("3.3  Synchronisation du secret JWT")
pdf.body(
    "Après une restauration de base de données, le secret JWT dans auth.secrets peut différer "
    "de celui dans /etc/trace-api.conf, bloquant toutes les authentifications (erreur 401 généralisée). "
    "Le script trace_restore.sh gère cette synchronisation automatiquement. "
    "En cas de désynchronisation manuelle :"
)
pdf.code(
    "# Lire le secret JWT depuis la base\n"
    "JWT=$(sudo -u postgres psql -d parc_mobilier -t -A \\\n"
    "    -c \"SELECT value FROM auth.secrets WHERE key = 'jwt_secret';\")\n"
    "\n"
    "# Mettre à jour la configuration PostgREST\n"
    "sudo sed -i \"s|^jwt-secret = .*|jwt-secret = \\\"$JWT\\\"|\" /etc/trace-api.conf\n"
    "\n"
    "# Redémarrer PostgREST\n"
    "sudo systemctl restart trace-api\n"
    "echo 'Secret JWT synchronisé.'"
)

pdf.h2("3.4  Remontage NFS")
pdf.body("Si le montage NFS est perdu (timeout, redémarrage réseau) :")
pdf.code(
    "# Vérifier l'état du montage\n"
    "mountpoint -q /mnt/savetrace && echo 'Monté' || echo 'Non monté'\n"
    "\n"
    "# Forcer le remontage\n"
    "sudo systemctl restart mnt-savetrace.automount\n"
    "# ou\n"
    "sudo mount /mnt/savetrace\n"
    "\n"
    "# Vérifier la connectivité vers le serveur NFS\n"
    "showmount -e <IP_SERVEUR_NFS>"
)

pdf.h2("3.5  Procédure en cas d'incident de sécurité")
pdf.body(
    "En cas de suspicion de compromission (intrusion, bruteforce réussi, comportement anormal) :"
)
pdf.bullet("Étape 1 — Isolation immédiate : bloquer l'accès externe (iptables ou arrêt Nginx)")
pdf.bullet("Étape 2 — Préservation des preuves : copie des logs avant toute action corrective")
pdf.bullet("Étape 3 — Rotation du secret JWT : toutes les sessions sont invalidées")
pdf.bullet("Étape 4 — Réinitialisation des mots de passe des comptes suspects")
pdf.bullet("Étape 5 — Analyse des audit_logs pour retracer l'activité anormale")
pdf.bullet("Étape 6 — Notification RSSI DGFiP")
pdf.code(
    "# Rotation du secret JWT (invalide toutes les sessions actives)\n"
    "NEW_SECRET=$(tr -dc 'A-Za-z0-9_-' < /dev/urandom | head -c 48)\n"
    "sudo -u postgres psql -d parc_mobilier \\\n"
    "    -c \"UPDATE auth.secrets SET value = '$NEW_SECRET' WHERE key = 'jwt_secret';\"\n"
    "sudo sed -i \"s|^jwt-secret = .*|jwt-secret = \\\"$NEW_SECRET\\\"|\" /etc/trace-api.conf\n"
    "sudo systemctl restart trace-api"
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 5 — MAINTENANCE PRÉVENTIVE
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("4. Maintenance préventive et tests")

pdf.h2("4.1  Calendrier de maintenance")
pdf.ln(1)
w4b = [32, 66, 34, CONTENT_W - 32 - 66 - 34]
pdf.table_row(["Fréquence", "Action", "Responsable", "Durée"], w4b,
              header=True, fill_color=BLUE_DARK)
rows_maint = [
    ("Quotidien (auto)",  "Sauvegarde NFS 02h00 et 13h00",                           "Cron",                   "Auto"),
    ("Quotidien (auto)",  "Sonde surveillance email 08h00",                           "Cron",                   "Auto"),
    ("Mensuel",           "Vérification espace disque NFS",                           "Équipe technique",       "15 min"),
    ("Mensuel",           "Contrôle des bans Fail2Ban actifs",                        "Équipe technique",       "15 min"),
    ("Trimestriel",       "Test de restauration d'un dump (env. de test)",            "Équipe technique",       "2h"),
    ("Semestriel",        "Mise à jour des paquets Debian (apt upgrade)",             "Équipe technique",       "1h"),
    ("Annuel",            "Rotation du secret JWT",                                   "Équipe technique",       "30 min"),
    ("Annuel",            "Test complet PCA/PRA",                                     "Équipe tech. + métier",  "4h"),
]
for i, row in enumerate(rows_maint):
    pdf.table_row(row, w4b, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.ln(3)

pdf.h2("4.2  Procédure de mise à jour des paquets")
pdf.body(
    "La mise à jour des paquets système doit suivre cette procédure pour éviter les régressions :"
)
pdf.bullet("Avant la mise à jour : effectuer une sauvegarde manuelle (sudo /usr/local/bin/trace_backup.sh)")
pdf.bullet("Vérifier la compatibilité PostgreSQL → PostgREST avant toute mise à jour majeure")
pdf.bullet("Appliquer en heures creuses (hors 08h30-18h00, hors période de saisie intensive)")
pdf.bullet("Tester l'authentification et la consultation après chaque mise à jour")

pdf.ln(2)

pdf.h2("4.3  Vérification de l'intégrité des sauvegardes")
pdf.body(
    "Un dump PostgreSQL non testé est une sauvegarde de valeur inconnue. "
    "Procédure de test trimestrielle sur environnement de test (jamais en production) :"
)
pdf.code(
    "# Sur une machine de test (jamais en production)\n"
    "# 1. Copier le dump depuis NFS\n"
    "scp serveur-nfs:/var/nfs/backupTRACE/trace_backup_YYYY-MM-DD.dump /tmp/\n"
    "\n"
    "# 2. Créer une base de test\n"
    "sudo -u postgres createdb parc_mobilier_test\n"
    "\n"
    "# 3. Restaurer\n"
    "sudo -u postgres pg_restore --clean --if-exists \\\n"
    "    -d parc_mobilier_test /tmp/trace_backup_YYYY-MM-DD.dump\n"
    "\n"
    "# 4. Vérifier les tables principales\n"
    "sudo -u postgres psql -d parc_mobilier_test \\\n"
    "    -c 'SELECT count(*) FROM mobiliers; SELECT count(*) FROM utilisateurs;'\n"
    "\n"
    "# 5. Nettoyer\n"
    "sudo -u postgres dropdb parc_mobilier_test"
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 6 — FICHE DE GARDE
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("5. Fiche de référence rapide — Garde technique")

pdf.body(
    "Cette page est destinée à l'astreinte technique. "
    "Elle synthétise les actions immédiates en cas d'incident sans nécessiter la lecture complète du PCI."
)

pdf.h2("5.1  Contacts d'urgence")
pdf.ln(1)
w3d = [54, 74, CONTENT_W - 54 - 74]
pdf.table_row(["Rôle", "Contact", "Disponibilité"], w3d,
              header=True, fill_color=BLUE_DARK)
rows_contacts = [
    ("Support technique mobiTrace",   "equipe.support@dgfip.finances.gouv.fr", "Heures ouvrées"),
    ("Responsable PCA",               "À compléter",                            "H24 si PCA activé"),
    ("RSSI DGFiP",                    "À compléter",                            "H24 si incident SSI"),
    ("Astreinte infrastructure DGFiP","À compléter",                            "H24"),
]
for i, row in enumerate(rows_contacts):
    pdf.table_row(row, w3d, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.ln(2)

pdf.h2("5.2  Commandes de diagnostic rapide")
pdf.code(
    "# Statut global de tous les services mobiTrace\n"
    "systemctl status nginx trace-api postgresql fail2ban mobitrace-print 2>/dev/null\n"
    "\n"
    "# Test fonctionnel (réponse attendue : 200 OK ou 401 si non connecté)\n"
    "curl -sk -o /dev/null -w '%{http_code}' https://localhost/api/rpc/me\n"
    "\n"
    "# 10 dernières erreurs applicatives\n"
    "journalctl -u trace-api -u nginx -p err --since '1h ago'\n"
    "\n"
    "# Dernières sauvegardes disponibles\n"
    "ls -lth /mnt/savetrace/trace_backup_*.dump 2>/dev/null | head -5\n"
    "\n"
    "# Connexions PostgreSQL actives\n"
    "sudo -u postgres psql -c 'SELECT count(*) FROM pg_stat_activity;'"
)

pdf.h2("5.3  Décision rapide — Que faire ?")
pdf.ln(1)
w2 = [84, CONTENT_W - 84]
pdf.table_row(["Symptôme observé", "Action immédiate"], w2,
              header=True, fill_color=BLUE_DARK)
rows_decision = [
    ("Interface web inaccessible (ERR_CONNECTION_REFUSED)",
     "sudo systemctl restart nginx"),
    ("Erreur 502 Bad Gateway",
     "sudo systemctl restart trace-api (puis nginx si nécessaire)"),
    ("Erreur 401 sur toutes les requêtes",
     "Vérifier désynchronisation JWT (§3.3)"),
    ("PostgreSQL ne répond pas",
     "sudo systemctl restart postgresql → puis trace-api"),
    ("NFS non monté",
     "sudo mount /mnt/savetrace"),
    ("Fail2Ban bloque des IPs légitimes",
     "sudo fail2ban-client set nginx-trace unbanip <IP>"),
    ("Email sonde absent depuis > 24h",
     "Vérifier serveur NFS et cron sur machine NFS"),
    ("Performance très dégradée",
     "psql -c \"SELECT * FROM pg_stat_activity WHERE state='active';\""),
]
for i, row in enumerate(rows_decision):
    pdf.table_row(row, w2, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.ln(3)
pdf.note(
    "Document généré automatiquement par generate_pci_pdf.py (dépôt mobiTrace). "
    "Pour toute question : equipe.support@dgfip.finances.gouv.fr",
    color=GREY_LIGHT
)

# ── Sauvegarde ────────────────────────────────────────────────────────────────
OUTPUT = "/home/adm1/TRACE/TRACE_PCI.pdf"
pdf.output(OUTPUT)
print(f"PDF généré : {OUTPUT}")
