"""
Génération du document PDF : Bill of Materials (BOM) et Suivi de Sécurité —
mobiTrace (TRACE & TRACE-SCAN)
Polices : DejaVu (Unicode TTF) pour la gestion des caractères français et symboles

Convention du projet (identique aux autres generate_*_pdf.py) : ce script est
l'unique source de vérité du document. Le PDF de
var/www/html/TRACE/Documentation/ est entièrement régénéré à chaque exécution,
à partir des données vérifiées dans sbom/trace-sbom-cyclonedx.json.
"""
import json
from fpdf import FPDF
from fpdf.fonts import FontFace
from fpdf.enums import XPos, YPos
from datetime import date

FONT_DIR = "/usr/share/fonts/truetype/dejavu/"

BLUE_DARK = (0, 0, 145)     # bleu Marianne — réservé aux titres (h1/h2/h3, bandeaux de page)
BLUE_MED = (0, 91, 187)     # idem, filet/accent de titre uniquement
BLUE_LIGHT = (224, 232, 255)
GREY_DARK = (66, 70, 82)    # neutre — en-têtes de tableau, filets de mise en page
GREEN_OK = (24, 128, 56)
GREEN_BG = (226, 245, 230)
ORANGE_WARN = (200, 110, 10)
ORANGE_BG = (255, 238, 214)
RED_CRIT = (168, 30, 30)
RED_BG = (250, 224, 221)
GREY_LIGHT = (246, 246, 246)
GREY_BORDER = (204, 204, 204)
GREY_TEXT = (110, 110, 110)
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)

MARGIN_L = 16
MARGIN_R = 16
PAGE_W = 210
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

TODAY = date.today().strftime("%d/%m/%Y")

SBOM = json.load(open("/home/adm1/TRACE/sbom/trace-sbom-cyclonedx.json", encoding="utf-8"))
DEB_OUT = "/home/adm1/TRACE/build/trace-server/var/www/html/TRACE/Documentation/Nomenclature BOM - TRACE & TRACE-SCAN v2.pdf"


def prop(c, name):
    for p in c.get("properties", []):
        if p["name"] == name:
            return p["value"]
    return ""


libs = [c for c in SBOM["components"] if c["type"] == "library"]
host_a = sorted([c for c in libs if prop(c, "trace:resolved-in") == "machine-trace"], key=lambda c: c["name"])
host_b = sorted([c for c in libs if prop(c, "trace:resolved-in") == "machine-nfs"], key=lambda c: c["name"])


def source_of(c):
    return prop(c, "trace:debian-source-package") or c["name"]


def arch_of(c):
    purl = c.get("purl", "")
    if "arch=" in purl:
        return purl.split("arch=")[1].split("&")[0]
    return ""


class PDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(MARGIN_L, 22, MARGIN_R)
        self.set_auto_page_break(auto=True, margin=18)
        self.add_font("Sans", "", FONT_DIR + "DejaVuSans.ttf")
        self.add_font("Sans", "B", FONT_DIR + "DejaVuSans-Bold.ttf")
        self.add_font("Sans", "I", FONT_DIR + "DejaVuSans-Oblique.ttf")
        self.add_font("Sans", "BI", FONT_DIR + "DejaVuSans-BoldOblique.ttf")
        self.add_font("Mono", "", FONT_DIR + "DejaVuSansMono.ttf")
        self.add_font("Mono", "B", FONT_DIR + "DejaVuSansMono-Bold.ttf")

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
            f"BOM & Suivi de Sécurité — mobiTrace  |  Édité le {TODAY}  |  Page {self.page_no()}",
            align="C",
        )
        self.set_text_color(*BLACK)

    def h1(self, text):
        self.ln(4)
        self.set_fill_color(*BLUE_DARK)
        self.set_text_color(*WHITE)
        self.set_font("Sans", "B", 12.5)
        self.cell(CONTENT_W, 9, f"  {text}", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*BLACK)
        self.ln(2)

    def h2(self, text):
        self.ln(3)
        self.set_fill_color(*BLUE_LIGHT)
        self.set_text_color(*BLUE_DARK)
        self.set_font("Sans", "B", 10.5)
        self.set_draw_color(*BLUE_MED)
        self.set_line_width(0.4)
        self.cell(CONTENT_W, 7.5, f"  {text}", border="L", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
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
            self.multi_cell(CONTENT_W - indent - bw, 5.2, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        else:
            self.multi_cell(CONTENT_W - indent, 5.2, f"{prefix_char}  {text}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def note(self, text, color=GREY_LIGHT, border_color=None):
        self.ln(1)
        self.set_fill_color(*color)
        self.set_draw_color(*(border_color or GREY_BORDER))
        self.set_line_width(0.3)
        self.set_font("Sans", "I", 8.2)
        self.set_x(MARGIN_L)
        self.multi_cell(CONTENT_W, 4.8, f"  {text}", border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*BLACK)
        self.ln(1)

    def wrap_table(self, headings, rows, widths, align=None, size=7.6, row_colors=None):
        """Table avec retour à la ligne automatique (API fpdf2 >= 2.7).
        row_colors : liste optionnelle de couleurs de fond par ligne (None = alternance grise).
        En-tête en gris neutre (GREY_DARK) : le bleu Marianne est réservé aux titres."""
        # fpdf2 (cell_fill_mode="ROWS") réutilise la couleur de remplissage "ambiante" du
        # PDF pour les lignes non alternées plutôt que d'imposer le blanc - sans ce reset,
        # une couleur laissée active par un h1/h2 précédent "fuit" dans le tableau (constaté
        # en pratique, lignes entières rendues dans la couleur du dernier titre).
        self.set_fill_color(*WHITE)
        headings_style = FontFace(family="Sans", emphasis="B", color=WHITE, fill_color=GREY_DARK, size_pt=size + 0.4)
        with self.table(
            col_widths=widths, text_align=(align or ["LEFT"] * len(widths)),
            headings_style=headings_style, line_height=4.0, first_row_as_headings=True,
            cell_fill_mode="ROWS", cell_fill_color=GREY_LIGHT,
            borders_layout="ALL", padding=1.1, num_heading_rows=1,
        ) as table:
            row = table.row()
            for hdg in headings:
                row.cell(hdg)
            self.set_font("Sans", "", size)
            for idx, r in enumerate(rows):
                row = table.row()
                bg = row_colors[idx] if row_colors else None
                for val in r:
                    if bg:
                        row.cell(str(val), style=FontFace(family="Sans", emphasis="", color=BLACK, fill_color=bg, size_pt=size))
                    else:
                        row.cell(str(val))
        self.set_fill_color(*WHITE)


pdf = PDF()
pdf.set_title("Bill of Materials (BOM) et Suivi de Sécurité — mobiTrace")
pdf.set_author("mobiTrace / DGFiP")

# =============================================================================
# PAGE DE TITRE
# =============================================================================
pdf.add_page()
pdf.set_y(30)
pdf.set_draw_color(*GREY_DARK)
pdf.set_line_width(0.8)
pdf.line(MARGIN_L, pdf.get_y(), PAGE_W - MARGIN_R, pdf.get_y())
pdf.ln(7)

pdf.set_font("Sans", "B", 20)
pdf.set_text_color(*BLUE_DARK)
pdf.cell(0, 11, "Bill of Materials (BOM)", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.cell(0, 11, "et Suivi de Sécurité", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "B", 14)
pdf.cell(0, 9, "mobiTrace (TRACE & TRACE-SCAN)", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(*BLACK)

pdf.ln(5)
pdf.set_line_width(0.4)
pdf.line(MARGIN_L, pdf.get_y(), PAGE_W - MARGIN_R, pdf.get_y())
pdf.ln(8)

meta = [
    ("Référence", "TRACE-BOM-2026-V4"),
    ("Version du document", "4 (remplace la v3 du 19/08/2026 et la v2 de juin 2026)"),
    ("Date de mise à jour", TODAY),
    ("Auteur", "Analyse technique assistée (Claude Sonnet 5)"),
    ("Applications", "TRACE (5 paquets Debian) & TRACE-SCAN (PWA satellite, hors paquet)"),
    ("Cible système", "Debian 13 (Trixie), amd64"),
    ("Pendant machine-lisible", "sbom/trace-sbom-cyclonedx.json (CycloneDX 1.6, validé sans erreur)"),
    ("Dernier correctif sécurité", "20/08/2026 — jsPDF et DSFR corrigés dans trace-server (1.0.0 -> 1.0.2), voir §3bis"),
]
cw = [60, CONTENT_W - 60]
for label, val in meta:
    pdf.set_x(MARGIN_L + 10)
    pdf.set_font("Sans", "B", 9)
    pdf.cell(cw[0], 6.5, label, new_x=XPos.RIGHT, new_y=YPos.LAST)
    pdf.set_font("Sans", "", 9)
    pdf.multi_cell(cw[1] - 10, 6.5, val, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

pdf.ln(6)
pdf.set_fill_color(*GREY_LIGHT)
pdf.set_text_color(*BLACK)
pdf.set_draw_color(*GREY_BORDER)
pdf.set_line_width(0.5)
pdf.set_x(MARGIN_L)
pdf.set_font("Sans", "B", 9.5)
pdf.cell(CONTENT_W, 7, "  Résumé exécutif", border="LTR", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "", 8.8)
resume = (
    "Cette édition (v4) corrige et complète la nomenclature de juin 2026 à partir d'une inspection "
    "directe des fichiers vendorisés et des paquets .deb du dépôt (versions confirmées par "
    "empreinte SHA-256 comparée aux tarballs npm/releases officiels, pas par simple lecture "
    "de code), et d'une résolution réelle des dépendances Debian transitives sur des conteneurs "
    "Debian 13 éphémères. Trois versions de composants de la précédente édition étaient "
    "erronées (PostgREST, bwip-js, Flask/Gunicorn — voir §2 et §2bis) et n'ont donc jamais été "
    "correctement surveillées. La v3 (19/08/2026) avait identifié jsPDF 2.5.1 comme concerné par "
    "12 CVE connues dont 2 critiques, ainsi qu'un défaut fonctionnel probable sur jsPDF-AutoTable "
    "(chemin de script incorrect). Ces deux points, ainsi que le retard de sécurité de DSFR, sont "
    "corrigés dans cette édition (jsPDF 4.2.1, jsPDF-AutoTable 5.0.8, DSFR 1.15.2 — trace-server "
    "1.0.0 -> 1.0.2) et vérifiés fonctionnels par exécution réelle dans un navigateur — voir §3, "
    "§3bis et §5."
)
pdf.set_x(MARGIN_L)
pdf.multi_cell(CONTENT_W, 5.2, f"  {resume}", border="LBR", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_draw_color(*BLACK)
pdf.ln(4)

pdf.set_fill_color(*GREEN_BG)
pdf.set_draw_color(*GREEN_OK)
pdf.set_line_width(0.4)
pdf.set_x(MARGIN_L)
pdf.set_font("Sans", "BI", 8.2)
pdf.multi_cell(
    CONTENT_W, 5,
    "  Corrigé le 20/08/2026 — jsPDF (2 CVE critiques, 12 au total), jsPDF-AutoTable (chemin de "
    "chargement cassé) et DSFR (correctif de sécurité 1.15.0 manquant) ont été mis à jour et "
    "vérifiés fonctionnels en conditions réelles. Détail en §3bis et §5.",
    border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT,
)
pdf.set_draw_color(*BLACK)
pdf.ln(3)

pdf.set_font("Sans", "I", 7.6)
pdf.set_text_color(*GREY_TEXT)
pdf.set_x(MARGIN_L)
pdf.multi_cell(
    CONTENT_W, 4.2,
    "Convention de lecture : fond rouge = vulnérabilité critique/haute connue et non corrigée ; "
    "fond orange = attention (retard, anomalie fonctionnelle) ; fond vert = conforme/à jour ; "
    "texte grisé italique = archivé (retiré du bundle actif).",
    new_x=XPos.LMARGIN, new_y=YPos.NEXT,
)
pdf.set_text_color(*BLACK)

# =============================================================================
# 1. ENVIRONNEMENT SYSTEME
# =============================================================================
pdf.add_page()
pdf.h1("1. Environnement système (OS)")
pdf.body(
    "Les 5 paquets .deb de TRACE se répartissent sur deux machines : la « Machine TRACE » "
    "(trace-server, trace-backup-client, trace-zebra-printer) et la « Machine NFS » "
    "(trace-backup-server, trace-backup-server-survey), toutes deux sous Debian 13 (Trixie)."
)
pdf.ln(1)
pdf.wrap_table(
    ["Composant", "Version cible", "Méthode d'installation", "Stratégie de mise à jour"],
    [("Debian Linux", "13 (Trixie)", "Image système / ISO",
      "apt-get update && apt-get upgrade réguliers (mensuel préconisé).")],
    [32, 26, 42, CONTENT_W - 100],
)

# =============================================================================
# 2. INFRASTRUCTURE & BACKEND
# =============================================================================
pdf.h1("2. Infrastructure & Backend (Machine TRACE)")
w2 = [26, 32, 30, CONTENT_W - 88]
rows2 = [
    ("Nginx", "1.26.3-3+deb13u7", "trace-server", "Reverse proxy TLS, routage API, rate limiting. apt."),
    ("PostgreSQL", "17.11-0+deb13u1", "trace-server", "Auth pgcrypto, logique métier (Triggers/RPC). apt."),
    ("PostgREST", "14.8 (binaire)", "trace-server", "Corrigé depuis « v12.x » (édition précédente, erroné) — voir §3bis."),
    ("OpenSSL", "3.5.6-1~deb13u2", "trace-server", "Certificats TLS/SSL locaux. apt."),
    ("Fail2Ban", "1.1.0-8", "trace-server", "Anti-bruteforce sur /api/rpc/login (5 tentatives -> ban 1h). apt."),
]
pdf.wrap_table(["Composant", "Version", "Paquet", "Rôle / suivi"], rows2, w2)
pdf.note(
    "PostgreSQL/Nginx/OpenSSL/Fail2Ban : versions résolues le 19/08/2026 par installation réelle "
    "des dépendances déclarées (postgresql, postgresql-contrib, nginx, openssl, sudo, fail2ban) "
    "dans un conteneur Debian 13 Trixie éphémère — pas de VM TRACE réelle disponible pour cette "
    "analyse (voir §9, méthodologie)."
)

pdf.h2("2bis. Modules d'infrastructure optionnels (paquets satellites)")
pdf.body("Installés uniquement si le paquet Debian correspondant est déployé.", size=8.5)
w2b = [32, 30, 38, CONTENT_W - 100]
rows2b = [
    ("CUPS", "2.4.10-3+deb13u2", "trace-zebra-printer", "File d'attente vers l'imprimante Zebra (port RAW 9100)."),
    ("Python3 + Flask", "Flask 3.1.1-1", "trace-zebra-printer", "Corrigé depuis « v3.0.2 » (édition précédente, erroné)."),
    ("Gunicorn", "23.0.0-1", "trace-zebra-printer", "Corrigé depuis « v20.1.0 » (édition précédente, erroné)."),
    ("NFS (serveur)", "nfs-kernel-server", "trace-backup-server", "Export /var/nfs/backupTRACE (Machine NFS)."),
    ("NFS (client)", "nfs-common 1:2.8.3-1", "trace-backup-client", "Montage automatique /mnt/savetrace (Machine TRACE)."),
    ("Postfix + mailutils", "Dépôts Debian 13", "trace-backup-server-survey", "Alertes email quotidiennes (Machine NFS)."),
]
pdf.wrap_table(["Composant", "Version", "Paquet Debian", "Rôle / suivi"], rows2b, w2b)
pdf.note(
    "Les trois versions marquées « corrigé depuis » ci-dessus étaient fausses dans la précédente "
    "édition (juin 2026) de ce document : PostgREST y était donné pour v12.x (le binaire réel est "
    "la v14.8, vérifiée par empreinte SHA-256 contre la release officielle), Flask pour v3.0.2 et "
    "Gunicorn pour v20.1.0 (les versions réellement installables depuis les dépôts Debian 13 sont "
    "respectivement 3.1.1-1 et 23.0.0-1). Ces écarts n'ont pu être détectés qu'en vérifiant "
    "directement les fichiers et en résolvant réellement les dépendances, pas en relisant le "
    "document précédent."
)

# =============================================================================
# 3. FRONTEND — TRACE
# =============================================================================
pdf.add_page()
pdf.h1("3. Frontend — Plateforme centrale (TRACE)")
w3 = [30, 24, CONTENT_W - 54 - 46, 46]
rows3 = [
    ("Vanilla JS", "N/A", "Logique métier de la SPA (app.js ~2500 lignes, v2.1). Revue de code interne (SAST), focus escapeHTML().", ""),
    ("DSFR", "1.15.2", "Système de Design de l'État. Corrigé depuis 1.14.3 le 20/08/2026 (intègre le correctif de sécurité 1.15.0, sanitisation du chargement de pictogrammes SVG). Vendorisé en dist npm complet (~87 Mo, non minimisé) dans TRACE ET TRACE-SCAN.", ""),
    ("bwip-js", "3.0.0", "Corrigé depuis « v4.x » (édition précédente, erroné). Génération DataMatrix pour zebra2.html (actif). Version confirmée par empreinte SHA-256 identique au tarball npm officiel.", ""),
    ("JsBarcode", "3.11.5", "Génération Code128/EAN, utilisée uniquement par l'ancien générateur zebra-codebar-generator.html, non lié depuis l'interface actuelle.", ""),
    ("jsPDF", "4.2.1", "Génération des PV de mise au rebut (côté client). Corrigé depuis 2.5.1 le 20/08/2026 (12 CVE connues dont 2 critiques, toutes corrigées en amont) — voir §3bis et §5, constat 1.", ""),
]
pdf.wrap_table(["Composant", "Version", "Rôle / suivi"], [r[:3] for r in rows3], [w3[0], w3[1], CONTENT_W - w3[0] - w3[1]])

pdf.h3("Statut du plugin jsPDF-AutoTable (anomalie corrigée)")
pdf.note(
    "app.js appelle activement doc.autoTable() (fonctionnalité utilisée pour les tableaux du PV de "
    "mise au rebut). index.html référence le script à l'emplacement "
    "« ./utils/jspdf.plugin.autotable.min.js », qui n'y existait pas (seul "
    "« ./utils/archives/jspdf.plugin.autotable.min.js » était présent). Corrigé le 20/08/2026 : le "
    "fichier (mis à jour en version 5.0.8, compatible jsPDF 4.x) est désormais placé directement à "
    "l'emplacement déjà attendu par index.html, sans qu'il ait été nécessaire de modifier ce dernier. "
    "Vérifié en appelant directement AdminCtrl.generateRebutPDF() dans un navigateur réel (la "
    "fonction de production exacte, pas une reconstitution) avec des données d'équipements "
    "simulées : chargement du logo Marianne depuis dsfr-v1.15.2/, en-tête RÉPUBLIQUE FRANÇAISE, "
    "doc.autoTable() et doc.lastAutoTable.finalY, bloc signature - PDF valide d'une page produit "
    "(104 Ko), aucune erreur console. Seuls l'import du fichier .txt et les appels PostgREST "
    "amont (recherche puis suppression des équipements, dans processRebut()) restent non testés, "
    "faute de base de données disponible pour cette analyse - ils sont indépendants des "
    "composants corrigés ici. Voir constat 2, §5.",
    color=GREEN_BG, border_color=GREEN_OK,
)

pdf.h3("Composants archivés (retirés du bundle actif)")
w3arch = [42, 26, CONTENT_W - 68]
rows3arch = [
    ("jsPDF-AutoTable", "3.5.25", "Version historique conservée dans archives/ (celle utilisée en production est désormais 5.0.8, directement dans utils/ — voir ci-dessus)."),
    ("QR Code Styling", "1.6.0-rc.1", "Version confirmée le 19/08/2026 par empreinte identique au tarball npm officiel. Aucune CVE connue."),
    ("qrcode.min.js (davidshimjs)", "1.0.0", "Version confirmée le 19/08/2026 par empreinte identique au dépôt GitHub officiel et au mirroir npm « qrcodejs » (seule release taguée disponible). Aucune CVE connue."),
]
pdf.wrap_table(["Composant", "Version", "Statut"], rows3arch, w3arch)

pdf.h3("Outils front-end (utils/)")
w3html = [70, 40, CONTENT_W - 110]
rows3html = [
    ("zebra2.html", "ACTIF — courant", "Générateur d'étiquettes ZPL (DataMatrix, via bwip-js). Lié depuis Administration."),
    ("zebra-codebar-generator.html", "présent, non lié", "Ancien générateur (Code128, via JsBarcode). Plus référencé depuis l'interface."),
    ("zebra-codebar-generator-finetune.html", "présent, non lié", "Variante affinée de l'ancien générateur. Non référencée."),
    ("codebar-generator.html / qrcode-generator.html / copytop-qrcode-generator.html / etiquettes-generator.html", "archivés", "Anciens générateurs, conservés en archives/ pour référence."),
]
pdf.wrap_table(["Fichier HTML", "Statut", "Rôle"], rows3html, w3html)

# =============================================================================
# 3bis. ETAT DES CORRECTIFS DE SECURITE AMONT
# =============================================================================
pdf.add_page()
pdf.h1("3bis. État des correctifs de sécurité amont")
pdf.body(
    "Chacun des composants vendorisés a été confronté à sa dernière version amont (registre npm / "
    "releases GitHub) et à la base de vulnérabilités OSV.dev interrogée sur la version exacte "
    "vendorisée, plutôt que sur une simple estimation de recence. Les deux composants en retard sur "
    "un correctif de sécurité (jsPDF, DSFR) ont été mis à jour et vérifiés fonctionnels le "
    "20/08/2026 — le tableau ci-dessous reflète l'état après correction."
)
w3b = [30, 26, 30, 22, CONTENT_W - 108]
rows3b = [
    ("PostgREST", "14.8", "14.17 (13/08/2026)", "En retard", "9 versions de retard ; aucune mention de correctif de sécurité dans le changelog sur cet intervalle."),
    ("DSFR", "~~1.14.3~~ 1.15.2", "1.15.2 (12/08/2026)", "Corrigé le 20/08/2026", "Intègre désormais le correctif de sécurité de la 1.15.0 (sanitisation SVG) ; version vendorisée = dernière amont."),
    ("bwip-js", "3.0.0", "4.11.4", "Très en retard", "Aucune CVE connue sur la 3.0.0 (historique complet OSV.dev vide pour ce paquet)."),
    ("JsBarcode", "3.11.5", "3.12.3", "Légèrement en retard", "Aucune CVE connue."),
    ("jsPDF", "~~2.5.1~~ 4.2.1", "4.2.1", "Corrigé le 20/08/2026", "12 CVE connues dont 2 critiques affectaient 2.5.1 (CVE-2025-68428, CVE-2026-31938) ; version vendorisée = dernière amont, toutes corrigées."),
    ("jsPDF-AutoTable", "~~3.5.25~~ 5.0.8", "5.0.8", "Corrigé le 20/08/2026", "Version vendorisée = dernière amont ; anomalie de chargement également corrigée, voir §3."),
    ("html5-qrcode", "2.3.8", "2.3.8", "À jour", "Dernière version publiée ; aucune CVE connue."),
    ("QR Code Styling (archivé)", "1.6.0-rc.1", "1.9.2", "En retard", "Aucune CVE connue ; composant archivé, non chargé par l'interface active."),
    ("qrcodejs (archivé)", "1.0.0", "1.0.0", "À jour", "Aucune CVE connue ; composant archivé, non chargé par l'interface active."),
]
pdf.wrap_table(["Composant", "Vendorisé", "Dernière amont", "État", "Détail"], rows3b, w3b,
                row_colors=[None, GREEN_BG, None, None, GREEN_BG, GREEN_BG, None, None, None])
pdf.note(
    "Contrairement à la précédente édition, les mentions « v4.x » (bwip-js) et « v12.x » "
    "(PostgREST) ont été remplacées par les versions réellement identifiées (voir méthodologie "
    "§9) : comparaison d'empreinte SHA-256 avec les tarballs npm / releases GitHub officiels pour "
    "les bibliothèques JS, et avec l'archive de release officielle pour le binaire PostgREST."
)

# =============================================================================
# 4. TRACE-SCAN
# =============================================================================
pdf.h1("4. Application satellite mobile (TRACE-SCAN)")
pdf.body(
    "L'application satellite est conçue pour le mode « Offline-First » (PWA), imposant "
    "l'hébergement local de toutes ses ressources. Elle ne fait partie d'aucun des 5 paquets "
    ".deb : son mode de déploiement n'est pas documenté dans ce dépôt (dépôt TRACE-SCAN distinct)."
)
w4 = [30, 24, CONTENT_W - 54]
rows4 = [
    ("PWA Engine", "HTML5/JS natif", "Interface de scan et gestion des exports (index.html). Revue de code interne."),
    ("Service Worker", "natif (sw.js)", "Gestion du cache et fonctionnement hors-ligne."),
    ("html5-qrcode", "2.3.8", "Lecture de QR Codes/DataMatrix via caméra. Version confirmée par empreinte SHA-256 identique au tarball npm officiel — c'est la dernière version publiée, aucune CVE connue."),
    ("DSFR", "1.15.2", "Identité visuelle (Header Marianne). Corrigé le 20/08/2026 (même version que TRACE) — voir §3bis."),
]
pdf.wrap_table(["Composant", "Version", "Rôle / suivi"], rows4, w4)

# =============================================================================
# 5. POINTS D'ATTENTION NIS2 / SECURITE
# =============================================================================
pdf.add_page()
pdf.h1("5. Points d'attention pour la conformité et la sécurité")
w5 = [8, CONTENT_W - 8 - 26 - 30, 26, 30]
rows5 = [
    ("1", "jsPDF 2.5.1 (génération des PV de mise au rebut côté client) était concerné par 12 CVE connues, dont 2 critiques : CVE-2025-68428 (inclusion de fichier local/traversée de chemin) et CVE-2026-31938 (injection HTML, CVSS 7,6). Plusieurs autres permettaient l'exécution de JavaScript arbitraire via injection PDF (AcroForm, addJS).", "Corrigé (20/08/2026)", "Mis à jour vers jsPDF 4.2.1 (dernière version amont, corrige les 12 CVE), trace-server 1.0.0 -> 1.0.2. Vérifié fonctionnel dans un navigateur réel."),
    ("2", "index.html référençait jsPDF-AutoTable à un chemin où le fichier n'existait pas (« ./utils/jspdf.plugin.autotable.min.js » au lieu de « ./utils/archives/jspdf.plugin.autotable.min.js ») alors qu'app.js appelle activement doc.autoTable(). Fonctionnalité de génération de tableaux dans les PV probablement cassée.", "Corrigé (20/08/2026)", "Fichier (mis à jour en 5.0.8, compatible jsPDF 4.x) placé directement à l'emplacement déjà attendu par index.html, sans modification de ce dernier. Vérifié en appelant directement AdminCtrl.generateRebutPDF() (fonction de production réelle) : PV d'une page produit sans erreur, avec logo, en-tête et tableau."),
    ("3", "DSFR 1.14.3 (TRACE et TRACE-SCAN) n'intégrait pas le correctif de sécurité publié en 1.15.0 (sanitisation du chargement de pictogrammes SVG en ligne, contournement d'injection sur IE11).", "Corrigé (20/08/2026)", "Mis à jour vers DSFR 1.15.2 (dernière version amont) dans les deux applications. Rendu vérifié sans erreur console dans un navigateur réel."),
    ("4", "Aucun script de vendoring/vérification automatisé pour le binaire PostgREST (à la différence, par exemple, d'un build.sh qui téléchargerait et vérifierait une somme de contrôle à la construction) : la provenance repose sur une vérification manuelle ponctuelle, non reproductible automatiquement.", "À noter", "Documenter la version et la somme SHA-256 attendues dans build.sh, à défaut d'automatiser le téléchargement."),
    ("5", "Trois versions de composants de l'édition précédente de ce document étaient incorrectes (PostgREST « v12.x », bwip-js « v4.x », Flask/Gunicorn) : la veille de sécurité s'appuyant sur ce document n'aurait pas surveillé les bonnes releases amont.", "Corrigé (19/08/2026)", "Versions corrigées dans cette édition par vérification directe des fichiers, pas par relecture du document précédent."),
    ("6", "DSFR est vendorisé en dist npm complet (~86 Mo) dans TRACE comme dans TRACE-SCAN, plutôt qu'un sous-ensemble minimal des fichiers réellement chargés (dsfr.min.css, favicon/, fonts/, icons/, utility/).", "Mineur (hygiène)", "Réduire au sous-ensemble effectivement référencé par index.html pour alléger le paquet, sans urgence."),
]
pdf.wrap_table(["#", "Constat", "Sévérité", "Recommandation"], rows5, w5, align=["CENTER", "LEFT", "CENTER", "LEFT"],
                row_colors=[GREEN_BG, GREEN_BG, GREEN_BG, None, GREEN_BG, None])

# =============================================================================
# 6. VEILLE ET AUDIT
# =============================================================================
pdf.add_page()
pdf.h1("6. Processus de maintenance et audit")
pdf.h2("6.1. Veille sur les dépendances")
pdf.body("Contrairement aux projets Node.js, mobiTrace n'utilise pas de package-lock.json. La veille doit donc être proactive :", size=8.8)
pdf.bullet("Système et paquets Debian : rejouer la résolution de dépendances (§9) sur des images Debian 13 à jour, ou, dès qu'une VM TRACE existe, comparer à un dpkg-query -W réel.", bold_prefix="Système : ")
pdf.bullet("Les fichiers vendorisés actifs dans utils/ (bwip-js, jspdf.umd.min.js) et dsfr-v1.15.2/ doivent être remplacés manuellement en cas de vulnérabilité majeure publiée (veille GitHub/OSV.dev). JsBarcode reste présent mais n'est plus utilisé par l'interface actuelle.", bold_prefix="Bibliothèques JS actives : ")
pdf.bullet("Les fichiers de utils/archives/ ne sont plus actifs en production (à l'exception du chemin erroné constaté au §3/§5, constat 2). Ils peuvent être supprimés définitivement après correction de cette anomalie.", bold_prefix="Bibliothèques archivées : ")
pdf.bullet("Flask, Gunicorn, CUPS (trace-zebra-printer) et Postfix (trace-backup-server-survey) sont gérés via apt. Surveiller les CVE Flask/Werkzeug en priorité.", bold_prefix="Modules optionnels : ")

pdf.h2("6.2. Sécurité du code source (audit statique)")
pdf.bullet("L'utilisation de escapeHTML() dans app.js est obligatoire pour toute injection de données provenant de la base de données ou de l'utilisateur dans le DOM.", bold_prefix="Protection XSS : ")
pdf.bullet("Le fichier manifest.json et le sw.js de TRACE-SCAN doivent être servis via HTTPS uniquement (garanti par la configuration Nginx).", bold_prefix="Intégrité PWA : ")
pdf.bullet("Les routes /imprimer-zpl, /imprimante/action et /imprimante/config sont protégées par authentification JWT via le bloc auth_request /_zebra-auth de Nginx. Aucun accès direct au port 5050 (Gunicorn écoute sur 127.0.0.1 uniquement).", bold_prefix="Microservice Zebra : ")
pdf.bullet("/etc/sudoers.d/mobitrace-print accorde à www-data l'exécution sans mot de passe de lpadmin, cupsenable, cupsdisable, cancel uniquement. Restreindre à ces commandes et auditer régulièrement.", bold_prefix="Sudoers Zebra : ")

pdf.h2("6.3. Gestion du patrimoine logiciel")
pdf.bullet("Creative Commons (CC BY-NC-SA).", bold_prefix="Licence : ")
pdf.bullet("GitHub (public). Permet l'utilisation d'outils d'analyse automatique (Dependabot, CodeQL) même sur du code Vanilla JS.", bold_prefix="Dépôt : ")
pdf.bullet("Les 5 paquets .deb sont versionnés 1.0.0 (trace-zebra-printer en 1.0.1). Incrémenter le numéro de version à chaque modification des scripts postinst ou des fichiers embarqués, et régénérer les .deb via build.sh.", bold_prefix="Paquets Debian : ")

# =============================================================================
# 7-8. ANNEXES
# =============================================================================
pdf.add_page()
pdf.h1(f"7. Annexe A — Paquets Debian résolus, Machine TRACE ({len(host_a)})")
pdf.body(
    "Fermeture transitive complète des dépendances de trace-server, trace-backup-client et "
    "trace-zebra-printer, résolue le 19/08/2026 par installation réelle dans un conteneur "
    "Debian 13 (Trixie) éphémère (voir méthodologie, §9).", size=8.5,
)
rows_a = [(c["name"], c["version"], source_of(c), arch_of(c)) for c in host_a]
pdf.wrap_table(["Paquet", "Version", "Paquet source Debian", "Arch."], rows_a,
                [56, 46, 56, CONTENT_W - 158], size=7.0)

pdf.add_page()
pdf.h1(f"8. Annexe B — Paquets Debian résolus, Machine NFS ({len(host_b)})")
pdf.body(
    "Fermeture transitive complète des dépendances de trace-backup-server et "
    "trace-backup-server-survey, résolue le 19/08/2026 par installation réelle dans un conteneur "
    "Debian 13 (Trixie) éphémère (voir méthodologie, §9).", size=8.5,
)
rows_b = [(c["name"], c["version"], source_of(c), arch_of(c)) for c in host_b]
pdf.wrap_table(["Paquet", "Version", "Paquet source Debian", "Arch."], rows_b,
                [56, 46, 56, CONTENT_W - 158], size=7.0)

# =============================================================================
# 9. METHODOLOGIE ET LIMITES
# =============================================================================
pdf.add_page()
pdf.h1("9. Méthodologie et limites")
pdf.h2("9.1. Méthode")
pdf.bullet("Relevées depuis le README.md du projet et les champs Depends de DEBIAN/control de chacun des 5 paquets .deb.", bold_prefix="Dépendances directes : ")
pdf.bullet("Résolues le 19/08/2026 par installation réelle (apt-get install --no-install-recommends) dans des conteneurs Debian 13 (Trixie) éphémères interrogeant les dépôts Debian officiels — un pour chacune des deux machines cibles (Machine TRACE, Machine NFS).", bold_prefix="Fermeture transitive : ")
pdf.bullet("Les 9 fichiers JS/binaires vendorisés (actifs et archivés) ont tous été comparés par empreinte SHA-256 à leur tarball npm ou release GitHub officielle, y compris les deux composants archivés dont la version restait incertaine dans l'édition précédente (QR Code Styling, confirmé en 1.6.0-rc.1 ; qrcode.min.js, identifié comme le mirroir npm « qrcodejs » 1.0.0).", bold_prefix="Composants vendorisés : ")
pdf.bullet("Chaque composant a été confronté à OSV.dev (interrogé sur sa version exacte) et à sa dernière version amont (registre npm / releases GitHub).", bold_prefix="Vulnérabilités connues : ")

pdf.h2("9.2. Limites")
pdf.bullet("Aucune VM ou installation réelle de TRACE n'était disponible pour cette analyse, contrairement à d'autres projets pouvant s'appuyer sur un environnement de test réel. Les versions des annexes A et B reflètent l'état des dépôts Debian 13 au 19 août 2026 — à rapprocher d'un dpkg-query -W réel dès qu'une cible sera déployée.")
pdf.bullet("Les correctifs jsPDF/jsPDF-AutoTable/DSFR (§3, §3bis, §5) ont été vérifiés le 20/08/2026 en conditions réelles dans un navigateur (serveur HTTP local servant les fichiers statiques du dépôt), en appelant directement AdminCtrl.generateRebutPDF() — la fonction de production réelle qui génère les PV de mise au rebut, pas une reconstitution — avec des données d'équipements simulées : logo, en-tête, tableau et bloc signature produits sans erreur, PDF valide de 104 Ko. Seuls processRebut() en amont (import du fichier .txt, recherche et suppression des équipements via PostgREST) restent non testés, faute de base de données disponible pour cette analyse ; ils sont indépendants des composants corrigés ici (dont l'absence de test reste une limite, voir ci-dessous).")
pdf.bullet("Aucun scan de vulnérabilités connues (CVE) réalisé sur les 406 paquets Debian des annexes A et B eux-mêmes (seuls les composants vendorisés hors dpkg ont fait l'objet d'une vérification individuelle, §3bis) — ces paquets sont par construction suivis par le Debian Security Tracker via leur paquet source.")
pdf.bullet("La couverture OSV.dev, bien que fiable et largement utilisée, ne garantit pas l'absence de vulnérabilité non encore publiée ou non répertoriée.")
pdf.bullet("TRACE-SCAN est un dépôt distinct de TRACE ; ce document couvre les fichiers présents localement au moment de l'analyse (/home/adm1/TRACE-SCAN), sans garantie de synchronisation avec le dépôt amont.")

pdf.output(DEB_OUT)
print(f"PDF régénéré : {DEB_OUT} ({pdf.page_no()} pages)")
