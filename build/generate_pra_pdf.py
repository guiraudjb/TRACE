"""
Génération du document PDF : Plan de Reprise d'Activité (PRA) — mobiTrace / DGFiP
Polices : DejaVu (Unicode TTF) pour la gestion des caractères français et symboles
"""
from fpdf import FPDF
from fpdf.enums import XPos, YPos
from datetime import date

FONT_DIR  = "/usr/share/fonts/truetype/dejavu/"

BLUE_DARK   = (0,   0,  145)
BLUE_MED    = (0,  91, 187)
BLUE_LIGHT  = (224, 232, 255)
GREEN_OK    = ( 24, 128,  56)
GREEN_LIGHT = (220, 255, 220)
ORANGE_WARN = (200, 110,  10)
ORANGE_LIGHT= (255, 245, 215)
RED_CRIT    = (180,  20,  20)
RED_LIGHT   = (255, 225, 225)
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
            f"PRA — Plan de Reprise d'Activité mobiTrace  |  "
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

    def phase_badge(self, label, color, effort_n, impact_n, timeline):
        self.ln(3)
        self.set_fill_color(*color)
        self.set_text_color(*WHITE)
        self.set_font("Sans", "B", 10.5)
        self.cell(CONTENT_W, 9, f"  {label}  —  {timeline}",
                  fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*BLACK)
        self.set_font("Sans", "", 8.2)
        self.set_x(MARGIN_L)
        self.cell(28, 6, "Effort :", new_x=XPos.RIGHT, new_y=YPos.LAST)
        self.set_font("Sans", "B", 9)
        self.cell(24, 6, self.stars(effort_n), new_x=XPos.RIGHT, new_y=YPos.LAST)
        self.set_font("Sans", "", 8.2)
        self.cell(28, 6, "  Impact :", new_x=XPos.RIGHT, new_y=YPos.LAST)
        self.set_font("Sans", "B", 9)
        self.cell(24, 6, self.stars(impact_n), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(1)


# =============================================================================
# Construction du document
# =============================================================================

pdf = PDF()
pdf.set_title("Plan de Reprise d'Activité — mobiTrace")
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
pdf.cell(0, 9, "Plan de Reprise d'Activité", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "", 11)
pdf.cell(0, 7, "PRA — Procédures de reprise après sinistre", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(*BLACK)

pdf.ln(5)
pdf.set_line_width(0.4)
pdf.line(MARGIN_L, pdf.get_y(), PAGE_W - MARGIN_R, pdf.get_y())
pdf.ln(8)

meta = [
    ("Référence",  "TRACE-PRA-2026"),
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
    "Ce document définit les procédures étape par étape pour reprendre les services "
    "mobiTrace après un sinistre majeur, avec un objectif de RTO de 4 heures et RPO "
    "de 12 heures.\n\n"
    "Il couvre quatre scénarios : corruption de la base de données (S2), compromission "
    "de sécurité (S3), sinistre total du serveur TRACE (S4) et perte du serveur NFS (S5). "
    "Chaque procédure est accompagnée des commandes exactes à exécuter, d'une check-list "
    "de validation et d'un programme de tests annuels."
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
    "  Avertissement — Ce document contient des procédures techniques sensibles. "
    "Ne pas diffuser hors des équipes habilitées. Conserver une copie hors ligne.",
    border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT
)
pdf.set_draw_color(*BLACK)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 2 — OBJECTIFS ET SCÉNARIOS
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("1. Objectifs de reprise")

pdf.h2("1.1  Indicateurs de reprise")
pdf.ln(1)
w4 = [28, 24, 60, CONTENT_W - 28 - 24 - 60]
pdf.table_row(["Indicateur", "Valeur", "Définition", "Base"], w4,
              header=True, fill_color=BLUE_DARK)
rows_ind = [
    ("RTO", "4 heures",    "Temps max entre sinistre et reprise",   "Activité non temps-réel"),
    ("RPO", "12 heures",   "Perte de données maximale tolérée",     "2 sauvegardes/jour"),
    ("RTD", "30 minutes",  "Temps de détection du sinistre",        "Sonde email 08h00 + monitoring"),
    ("RLO", "99 %",        "Niveau de reprise minimal acceptable",  "Toutes fonctions sauf impression Zebra"),
]
for i, row in enumerate(rows_ind):
    pdf.table_row(row, w4, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.h2("1.2  Scénarios couverts")
pdf.ln(1)
w_sc = [52, 12, 68, CONTENT_W - 52 - 12 - 68]
pdf.table_row(["Scénario", "Code", "Description", "RTO cible"], w_sc,
              header=True, fill_color=BLUE_DARK)
rows_sc = [
    ("Panne service (Nginx/PostgREST/PG)", "S1",
     "Un ou plusieurs services KO, données intactes", "< 30 min → PCI"),
    ("Corruption base de données", "S2",
     "Base corrompue ou inaccessible, serveur OK", "< 2h"),
    ("Compromission de sécurité", "S3",
     "Intrusion, ransomware partiel, fuite credentials", "< 4h"),
    ("Sinistre total serveur TRACE", "S4",
     "Perte matérielle totale (incendie, vol, panne)", "< 4h"),
    ("Perte serveur NFS", "S5",
     "Sauvegardes inaccessibles, serveur TRACE OK", "< 1h"),
]
sc_colors = [GREY_LIGHT, WHITE, GREY_LIGHT, RED_LIGHT, ORANGE_LIGHT]
for row, color in zip(rows_sc, sc_colors):
    pdf.table_row(row, w_sc, fill_color=color)

pdf.note(
    "Le scénario S1 (panne de service) est traité dans le PCI. "
    "Le PRA couvre les scénarios S2 à S5, nécessitant une restauration ou une réinstallation.",
    color=ORANGE_LIGHT
)

pdf.h2("1.3  Prérequis à la reprise")
pdf.body("Avant de démarrer toute procédure PRA, s'assurer de disposer de :")
pdf.bullet("Accès physique ou SSH root au serveur TRACE (ou à une machine de remplacement)")
pdf.bullet("Accès SSH au serveur NFS (pour copier les dumps si NFS non monté)")
pdf.bullet("Les fichiers .deb des paquets mobiTrace (trace-server, trace-backup-client, etc.)")
pdf.bullet("Une connexion réseau opérationnelle entre les deux machines")
pdf.bullet(
    "Note : le RTO commence à l'heure de détection du sinistre, "
    "pas à l'heure de début des travaux"
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 3 — SCÉNARIO S2 : CORRUPTION BDD
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("2. Procédure S2 — Corruption de la base de données")

pdf.body(
    "Le serveur TRACE fonctionne mais la base parc_mobilier est corrompue ou inaccessible. "
    "Les fichiers de sauvegarde NFS sont disponibles."
)

pdf.h2("2.1  Diagnostic préalable  (0–15 min)")
pdf.code(
    "# Vérifier l'état de PostgreSQL\n"
    "sudo systemctl status postgresql\n"
    "sudo -u postgres psql -c 'SELECT version();'\n"
    "\n"
    "# Vérifier l'intégrité de la base (si PostgreSQL démarre)\n"
    "sudo -u postgres psql -d parc_mobilier -c 'SELECT count(*) FROM mobiliers;'\n"
    "\n"
    "# En cas d'erreur : noter le message exact pour le rapport d'incident"
)

pdf.h2("2.2  Restauration depuis le dump NFS  (15–90 min)")
pdf.body(
    "La restauration utilise le script interactif trace_restore.sh qui gère automatiquement "
    "la synchronisation du secret JWT."
)
pdf.code(
    "# Vérifier que le montage NFS est actif\n"
    "df -h /mnt/savetrace || sudo mount /mnt/savetrace\n"
    "\n"
    "# Lister les sauvegardes disponibles (les plus récentes en premier)\n"
    "ls -lt /mnt/savetrace/trace_backup_*.dump | head -10\n"
    "\n"
    "# Lancer la restauration interactive\n"
    "# Le script : liste les dumps, demande une confirmation OUI,\n"
    "# restaure, puis synchronise le secret JWT automatiquement\n"
    "sudo /usr/local/bin/trace_restore.sh"
)
pdf.note(
    "Le script trace_restore.sh gère automatiquement la synchronisation du secret JWT "
    "entre la base restaurée et /etc/trace-api.conf, puis redémarre trace-api.",
    color=GREEN_LIGHT
)

pdf.h2("2.3  Vérification post-restauration  (90–120 min)")
pdf.code(
    "# Vérifier que tous les services sont actifs\n"
    "systemctl is-active postgresql trace-api nginx\n"
    "\n"
    "# Test fonctionnel : login (remplacer par vos credentials admin)\n"
    "curl -sk -c /tmp/cookie.txt \\\n"
    "    -H 'Content-Type: application/json' \\\n"
    "    -d '{\"email\":\"admin@dgfip.fr\",\"password\":\"<mot_de_passe>\"}' \\\n"
    "    https://localhost/api/rpc/login\n"
    "\n"
    "# Test consultation données\n"
    "curl -sk -b /tmp/cookie.txt 'https://localhost/api/mobiliers?limit=5'\n"
    "\n"
    "# Vérifier la cohérence (comparer avec les chiffres avant sinistre)\n"
    "sudo -u postgres psql -d parc_mobilier \\\n"
    "    -c 'SELECT count(*) FROM mobiliers; SELECT max(date_saisie) FROM mobiliers;'"
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 4 — SCÉNARIO S3 : COMPROMISSION SÉCURITÉ
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("3. Procédure S3 — Compromission de sécurité")

pdf.body(
    "Suspicion ou confirmation d'une intrusion, d'un accès non autorisé ou d'un ransomware "
    "partiel. Priorité : préserver les preuves, isoler, puis restaurer."
)

pdf.h2("3.1  Isolation immédiate  (0–15 min)")
pdf.code(
    "# Option 1 : Bloquer l'accès externe (conserver l'accès SSH admin)\n"
    "sudo iptables -I INPUT -p tcp --dport 443 -j DROP\n"
    "sudo iptables -I INPUT -p tcp --dport 80  -j DROP\n"
    "\n"
    "# Option 2 : Arrêter uniquement Nginx (SSH reste ouvert)\n"
    "sudo systemctl stop nginx\n"
    "\n"
    "# IMPORTANT : NE PAS redémarrer, NE PAS effacer de logs avant préservation"
)

pdf.h2("3.2  Préservation des preuves  (15–45 min)")
pdf.code(
    "# Copier les logs avant toute action corrective\n"
    "INC=/root/incident_$(date +%Y%m%d)\n"
    "mkdir -p $INC\n"
    "sudo cp -r /var/log/nginx/ $INC/nginx_logs/\n"
    "sudo journalctl -u trace-api   --since '7 days ago' > $INC/trace-api.log\n"
    "sudo journalctl -u postgresql  --since '7 days ago' > $INC/postgresql.log\n"
    "sudo -u postgres psql -d parc_mobilier \\\n"
    "    -c 'SELECT * FROM audit_logs ORDER BY date_action DESC LIMIT 500;' \\\n"
    "    > $INC/audit_logs.txt\n"
    "# Notifier le RSSI DGFiP avec ces éléments avant toute action corrective"
)

pdf.h2("3.3  Rotation des secrets et réinitialisation  (45–90 min)")
pdf.code(
    "# 1. Rotation du secret JWT (invalide toutes les sessions actives)\n"
    "NEW_JWT=$(tr -dc 'A-Za-z0-9_-' < /dev/urandom | head -c 48)\n"
    "sudo -u postgres psql -d parc_mobilier \\\n"
    "    -c \"UPDATE auth.secrets SET value = '$NEW_JWT' WHERE key = 'jwt_secret';\"\n"
    "sudo sed -i \"s|^jwt-secret = .*|jwt-secret = \\\"$NEW_JWT\\\"|\" /etc/trace-api.conf\n"
    "\n"
    "# 2. Réinitialiser les mots de passe des comptes suspects\n"
    "sudo -u postgres psql -d parc_mobilier -c \\\n"
    "    \"SELECT public.reinitialiser_mdp('email@suspect.fr', 'NouveauMDP!2026');\"\n"
    "\n"
    "# 3. Redémarrer les services\n"
    "sudo systemctl restart trace-api nginx fail2ban"
)

pdf.h2("3.4  Décision : restaurer depuis sauvegarde ?")
pdf.body(
    "Si l'analyse des audit_logs révèle des modifications de données non autorisées, "
    "une restauration depuis le dernier dump sain est nécessaire (suivre la procédure S2 §2). "
    "Sinon, le service peut être réouvert après rotation des secrets."
)
pdf.bullet("Données non altérées → rotation des secrets suffisante → réouvrir le service")
pdf.bullet("Données altérées → restaurer depuis le dernier dump antérieur à l'intrusion")
pdf.bullet("Périmètre inconnu → maintenir l'isolation et contacter le RSSI DGFiP")

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 5 — SCÉNARIO S4 : SINISTRE TOTAL
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("4. Procédure S4 — Sinistre total du serveur TRACE")

pdf.body(
    "La machine principale est perdue (panne irréparable, incendie, vol). "
    "Objectif : reconstruire mobiTrace sur une nouvelle machine et restaurer "
    "depuis les dumps NFS. RTO cible : 4 heures."
)

pdf.phase_badge("PHASE 0 — Évaluation et provisionnement",
                BLUE_MED, effort_n=1, impact_n=4, timeline="0–30 min")
pdf.body("Confirmer la perte totale du serveur. Provisionner une machine de remplacement.")
pdf.bullet("Machine de remplacement : Debian 13 (Trixie), ≥ 4 Go RAM, ≥ 50 Go disque")
pdf.bullet("Configurer la même adresse IP que l'ancien serveur (DHCP/DNS si nécessaire)")
pdf.bullet("Vérifier l'accès SSH root opérationnel sur la nouvelle machine")
pdf.bullet("Vérifier la connectivité réseau vers le serveur NFS : ping <IP_NFS>")

pdf.phase_badge("PHASE 1 — Réinstallation des paquets",
                GREEN_OK, effort_n=2, impact_n=4, timeline="30 min–1h30")
pdf.code(
    "# Sur la nouvelle machine Debian 13 :\n"
    "# 1. Copier les paquets .deb depuis une source sûre (clé USB, dépôt interne)\n"
    "#    Les paquets sont dans le dépôt mobiTrace : build/*.deb\n"
    "\n"
    "# 2. Installer dans l'ordre :\n"
    "sudo apt install ./trace-server_1.0.0_all.deb          # installation principale\n"
    "# !! NOTER les credentials admin affichés à la fin de l'installation !!\n"
    "sudo apt install ./trace-backup-client_1.0.0_all.deb  # monte le NFS\n"
    "sudo apt install ./trace-zebra-printer_1.0.0_all.deb  # optionnel\n"
    "\n"
    "# 3. Vérifier que le NFS est monté\n"
    "df -h /mnt/savetrace && ls /mnt/savetrace/trace_backup_*.dump | head -5"
)

pdf.phase_badge("PHASE 2 — Restauration des données",
                ORANGE_WARN, effort_n=2, impact_n=4, timeline="1h30–2h30")
pdf.code(
    "# Lancer la restauration interactive\n"
    "# Le script liste les dumps NFS et gère la synchronisation JWT automatiquement\n"
    "sudo /usr/local/bin/trace_restore.sh\n"
    "\n"
    "# -> Choisir le dump le plus récent (max 12h de perte selon RPO)\n"
    "# -> Taper OUI pour confirmer\n"
    "# -> Le script restaure et synchronise automatiquement le secret JWT\n"
    "#    puis redémarre trace-api"
)

pdf.phase_badge("PHASE 3 — Vérification et validation",
                PURPLE, effort_n=1, impact_n=3, timeline="2h30–3h30")
pdf.code(
    "# Tests de validation complète\n"
    "systemctl is-active postgresql trace-api nginx fail2ban\n"
    "\n"
    "# Test authentification admin\n"
    "curl -sk -c /tmp/c.txt -H 'Content-Type: application/json' \\\n"
    "    -d '{\"email\":\"admin@...\",\"password\":\"...\"}' \\\n"
    "    https://localhost/api/rpc/login\n"
    "\n"
    "# Vérifier la cohérence des données\n"
    "sudo -u postgres psql -d parc_mobilier -c '\n"
    "    SELECT count(*) AS nb_mobiliers    FROM mobiliers;\n"
    "    SELECT count(*) AS nb_utilisateurs FROM utilisateurs;\n"
    "    SELECT max(date_saisie) AS derniere_saisie FROM mobiliers;'\n"
    "\n"
    "# Test depuis un poste agent (vérifier le certificat SSL si regénéré)"
)
pdf.body(
    "Si le certificat SSL a été regénéré, les agents verront une alerte SSL à la première "
    "connexion (certificat auto-signé). Les informer en amont."
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 6 — SCÉNARIO S5 + CHECK-LIST
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("5. Procédure S5 — Perte du serveur NFS")

pdf.body(
    "Le serveur NFS est indisponible mais le serveur TRACE fonctionne. "
    "Les sauvegardes planifiées échouent silencieusement."
)

pdf.h2("5.1  Impact immédiat")
pdf.bullet("Les sauvegardes automatiques échouent (trace_backup.sh retourne une erreur)")
pdf.bullet("La sonde mobitrace_backup_survey.sh enverra une ALERTE CRITIQUE à 08h00 le lendemain")
pdf.bullet("Les données en base sont intactes, l'application continue de fonctionner")
pdf.bullet("Le RPO se dégrade : chaque heure sans sauvegarde augmente la fenêtre de perte potentielle")

pdf.h2("5.2  Mitigation immédiate — Sauvegarde locale temporaire")
pdf.code(
    "# Sauvegarde locale d'urgence (hors NFS)\n"
    "DATE=$(date +%Y-%m-%d_%H-%M-%S)\n"
    "sudo -u postgres pg_dump -Fc -d parc_mobilier \\\n"
    "    -f /var/backups/trace_local_$DATE.dump\n"
    "echo \"Sauvegarde locale : /var/backups/trace_local_${DATE}.dump\"\n"
    "\n"
    "# Planifier des sauvegardes locales temporaires toutes les 2h\n"
    "# (supprimer ce cron dès que NFS est restauré)\n"
    "echo '0 */2 * * * postgres /usr/bin/pg_dump -Fc -d parc_mobilier \\\n"
    "    -f /var/backups/trace_local_$(date +\\%Y\\%m\\%d_\\%H\\%M).dump' \\\n"
    "    | sudo tee /etc/cron.d/trace_backup_local"
)

pdf.h2("5.3  Restauration du serveur NFS")
pdf.bullet("Réinstaller trace-backup-server_1.0.0_all.deb sur la machine NFS")
pdf.bullet("Vérifier que /var/nfs/backupTRACE est recréé (droits 700, nobody:nogroup)")
pdf.bullet("Remonter le NFS côté serveur TRACE : sudo mount /mnt/savetrace")
pdf.bullet("Copier les sauvegardes locales temporaires vers NFS")
pdf.bullet("Supprimer le cron local temporaire : sudo rm /etc/cron.d/trace_backup_local")

pdf.h1("6. Check-list de validation post-reprise")
pdf.body("À compléter et signer avant toute communication de reprise aux utilisateurs.")

pdf.h2("6.1  Check-list technique")
pdf.ln(1)
w_cl = [10, 92, 26, CONTENT_W - 10 - 92 - 26]
pdf.table_row(["#", "Vérification", "Résultat", "Validé par"], w_cl,
              header=True, fill_color=BLUE_DARK)
checks = [
    ("1",  "postgresql actif : systemctl is-active postgresql"),
    ("2",  "trace-api actif : systemctl is-active trace-api"),
    ("3",  "nginx actif : systemctl is-active nginx"),
    ("4",  "fail2ban actif : systemctl is-active fail2ban"),
    ("5",  "Authentification admin fonctionnelle (POST /api/rpc/login)"),
    ("6",  "Consultation mobiliers (GET /api/mobiliers?limit=1)"),
    ("7",  "Secret JWT synchronisé (/etc/trace-api.conf à jour)"),
    ("8",  "Montage NFS actif (df -h /mnt/savetrace)"),
    ("9",  "Dernière sauvegarde NFS présente et récente"),
    ("10", "Cohérence données (count mobiliers cohérent avant/après)"),
    ("11", "Interface web accessible depuis un poste agent"),
    ("12", "Rôle agent : modification de statut mobilier fonctionnelle"),
    ("13", "Rôle lecteur : consultation seule (pas d'écriture)"),
    ("14", "Fail2Ban : pas d'IPs légitimes bannies"),
    ("15", "Rapport d'incident rédigé et transmis au RSSI"),
]
for i, (num, check) in enumerate(checks):
    fc = GREY_LIGHT if i % 2 == 0 else WHITE
    pdf.table_row([num, check, "OK / KO", ""], w_cl, fill_color=fc)

pdf.h2("6.2  Signature et approbation")
pdf.ln(1)
w_sig = [60, 60, CONTENT_W - 60 - 60]
pdf.table_row(["Rôle", "Nom / Prénom", "Signature / Date"], w_sig,
              header=True, fill_color=BLUE_DARK)
sigs = [
    ("Responsable technique", "", ""),
    ("Responsable PCA", "", ""),
    ("RSSI DGFiP (si incident sécurité)", "", ""),
]
for row in sigs:
    pdf.table_row(row, w_sig, fill_color=WHITE)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 7 — PLAN DE TESTS ET MAINTIEN EN CONDITION
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("7. Plan de tests et maintien en condition")

pdf.h2("7.1  Programme de tests annuels")
pdf.ln(1)
w_t = [58, 24, 16, 48, CONTENT_W - 58 - 24 - 16 - 48]
pdf.table_row(["Test", "Fréquence", "Durée", "Objectif", "Responsable"], w_t,
              header=True, fill_color=BLUE_DARK)
tests = [
    ("Test restauration S2 (dump NFS vers base de test)",
     "Trimestriel", "2h",
     "Valider l'intégrité des dumps NFS",
     "Équipe technique"),
    ("Test PRA S4 complet (bare metal, machine vierge)",
     "Annuel", "4h",
     "Valider RTO=4h de bout en bout",
     "Équipe technique"),
    ("Test coupure NFS (S5) — sauvegarde locale",
     "Semestriel", "30 min",
     "Valider la mitigation sauvegarde locale",
     "Équipe technique"),
    ("Test communication de crise",
     "Annuel", "1h",
     "Valider arbre d'appel et modèles email",
     "Responsable PCA"),
]
for i, row in enumerate(tests):
    pdf.table_row(row, w_t, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.h2("7.2  Fiche de test — Restauration trimestrielle")
pdf.body("À remplir après chaque test trimestriel de restauration.")
pdf.ln(1)
w_fiche = [60, CONTENT_W - 60]
pdf.table_row(["Champ", "Valeur"], w_fiche, header=True, fill_color=BLUE_DARK)
fiche_rows = [
    "Date du test",
    "Dump restauré (nom du fichier)",
    "Durée de la restauration",
    "Nombre de mobiliers restaurés",
    "Nombre d'utilisateurs restaurés",
    "Anomalies constatées",
    "Actions correctives",
    "Validé par",
]
for i, champ in enumerate(fiche_rows):
    pdf.table_row([champ, ""], w_fiche,
                  fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.h2("7.3  Mise à jour du PRA")
pdf.body("Ce document doit être mis à jour dans les cas suivants :")
pdf.bullet("Après tout sinistre réel (retour d'expérience, révision des procédures)")
pdf.bullet("Après toute évolution de l'architecture (nouveau composant, changement de machine)")
pdf.bullet("Après tout changement de version majeure des paquets trace-server")
pdf.bullet("Annuellement, même sans évolution (révision formelle et validation)")

pdf.ln(3)
pdf.note(
    "Document généré automatiquement par generate_pra_pdf.py (dépôt mobiTrace). "
    "Pour toute question : equipe.support@dgfip.finances.gouv.fr",
    color=GREY_LIGHT
)

# ── Sauvegarde ────────────────────────────────────────────────────────────────
OUTPUT = "/home/adm1/TRACE/TRACE_PRA.pdf"
pdf.output(OUTPUT)
print(f"PDF généré : {OUTPUT}")
