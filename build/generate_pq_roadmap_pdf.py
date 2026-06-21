"""
Génération du document PDF : Feuille de route protection post-quantique — mobiTrace
Polices : DejaVu (Unicode TTF) pour la gestion des caractères français et symboles
"""
from fpdf import FPDF
from fpdf.enums import XPos, YPos
from datetime import date

# ── Chemins polices ───────────────────────────────────────────────────────────
FONT_DIR  = "/usr/share/fonts/truetype/dejavu/"
MONO_DIR  = FONT_DIR

# ── Palette couleurs (DSFR-inspirée) ─────────────────────────────────────────
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
        # Chargement des polices Unicode
        self.add_font("Sans",      "",  FONT_DIR + "DejaVuSans.ttf")
        self.add_font("Sans",      "B", FONT_DIR + "DejaVuSans-Bold.ttf")
        self.add_font("Sans",      "I", FONT_DIR + "DejaVuSans-Oblique.ttf")
        self.add_font("Sans",      "BI",FONT_DIR + "DejaVuSans-BoldOblique.ttf")
        self.add_font("Mono",      "",  FONT_DIR + "DejaVuSansMono.ttf")
        self.add_font("Mono",      "B", FONT_DIR + "DejaVuSansMono-Bold.ttf")

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
            f"Feuille de route — Protection post-quantique mobiTrace  |  "
            f"Édité le {TODAY}  |  Page {self.page_no()}",
            align="C",
        )
        self.set_text_color(*BLACK)

    # ── Helpers ──────────────────────────────────────────────────────────────

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
pdf.set_title("Feuille de route — Protection post-quantique mobiTrace")
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
pdf.cell(0, 9, "Feuille de route", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_font("Sans", "", 12)
pdf.cell(0, 8, "Protection post-quantique", align="C",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_text_color(*BLACK)

pdf.ln(5)
pdf.set_line_width(0.4)
pdf.line(MARGIN_L, pdf.get_y(), PAGE_W - MARGIN_R, pdf.get_y())
pdf.ln(8)

meta = [
    ("Référence",  "TRACE-SEC-PQC-2026"),
    ("Version",              "1.0"),
    ("Date",                 TODAY),
    ("Diffusion",            "Restreinte — Usage interne"),
    ("Auteur",               "Équipe technique mobiTrace / DGFiP"),
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
    "Ce document définit la stratégie de migration de mobiTrace vers une cryptographie "
    "résistante aux ordinateurs quantiques, conformément aux standards NIST FIPS 203/204/205 "
    "publiés en août 2024.\n\n"
    "La menace principale est le paradigme « Harvest Now, Decrypt Later » (HNDL) : un "
    "adversaire peut capturer le trafic TLS chiffré aujourd'hui et le déchiffrer "
    "ultérieurement grâce à un ordinateur quantique. La migration est structurée en "
    "quatre phases progressives, de la mise à niveau classique immédiate (ECDSA P-384, "
    "HS512) jusqu'à l'infrastructure PQC complète (ML-KEM, ML-DSA)."
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
    "  ⚠  Ce document contient des informations relatives à la sécurité "
    "de l'infrastructure. Ne pas diffuser hors des équipes habilitées.",
    border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT
)
pdf.set_draw_color(*BLACK)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 2 — CONTEXTE ET INVENTAIRE
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("1. Contexte et menace quantique")

pdf.h2("1.1  La menace « Harvest Now, Decrypt Later »")
pdf.body(
    "Un ordinateur quantique suffisamment puissant (« cryptographiquement pertinent », CRQC) "
    "serait capable de casser les algorithmes asymétriques classiques (RSA, ECDSA, ECDH) grâce "
    "à l'algorithme de Shor, en temps polynomial. Les algorithmes symétriques (AES, HMAC-SHA) "
    "sont affectés par l'algorithme de Grover, qui divise leur niveau de sécurité effectif par deux."
)
pdf.body(
    "La menace immédiate n'est pas l'existence d'un tel ordinateur — les estimations sérieuses "
    "le situent entre 2030 et 2040 — mais la collecte de trafic chiffré aujourd'hui en vue "
    "d'un déchiffrement différé. Pour des données devant rester confidentielles sur 10 ans "
    "ou plus, la migration doit commencer maintenant."
)

pdf.h2("1.2  Standards NIST (août 2024)")
pdf.body("Le NIST a finalisé trois standards de cryptographie post-quantique :")
pdf.ln(1)

w_nist = [28, 52, 36, CONTENT_W - 28 - 52 - 36]
pdf.table_row(["Standard", "Algorithme", "Type", "Usage"], w_nist,
              header=True, fill_color=BLUE_DARK)
rows_nist = [
    ("FIPS 203", "ML-KEM (CRYSTALS-Kyber)",    "KEM hybride",  "Echange de clés — remplace RSA/ECDH"),
    ("FIPS 204", "ML-DSA (CRYSTALS-Dilithium)","Signature",    "Signatures — remplace RSA/ECDSA"),
    ("FIPS 205", "SLH-DSA (SPHINCS+)",          "Signature",    "Signatures hash-based, conservateur"),
]
for i, row in enumerate(rows_nist):
    pdf.table_row(row, w_nist, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.ln(2)
pdf.note(
    "Approche recommandée : hybride classique + PQC. Combiner X25519 (classique éprouvé) "
    "avec ML-KEM-768 (post-quantique) garantit la sécurité même si l'un des deux "
    "algorithmes est ultérieurement compromis."
)

pdf.h2("1.3  Inventaire cryptographique de mobiTrace")
pdf.ln(1)

w_inv = [38, 40, 50, CONTENT_W - 38 - 40 - 50]
pdf.table_row(["Composant", "Algorithme actuel", "Fichier source", "Vulnérabilité QC"],
              w_inv, header=True, fill_color=BLUE_DARK)
rows_inv = [
    ("Certificat TLS",    "RSA 2048",           "postinst:114",    "CRITIQUE — Shor"),
    ("Echange clés TLS",  "RSA/DHE (défaut)", "nginx (défaut)", "CRITIQUE — Shor"),
    ("Protocole TLS",     "TLS 1.2+1.3",        "nginx",           "Moyenne"),
    ("Signature JWT",     "HS256 / HMAC-SHA256", "schema.sql:49",  "Faible-Moy. — Grover"),
    ("Secret JWT",        "48 chars (~285 b)",  "postinst:17",     "Faible"),
    ("Hachage MDP",       "Bcrypt (bf/8)",       "schema.sql:100", "Faible — symétrique"),
    ("Transit NFS",       "Non chiffré",    "fstab (client)",  "Moyenne — écoute réseau"),
]
level_map = {
    "CRITIQUE": (255, 225, 225),
    "Faible-Moy": (255, 248, 215),
    "Faible": (235, 255, 235),
    "Moyenne": (255, 245, 220),
}
for row in rows_inv:
    col = WHITE
    for k, c in level_map.items():
        if row[3].startswith(k):
            col = c
            break
    pdf.table_row(row, w_inv, fill_color=col)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 3 — PHASE 1
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("2. Feuille de route — Les quatre phases")

pdf.phase_badge("PHASE 1 — Durcissement classique renforcé",
                BLUE_MED, effort_n=1, impact_n=3, timeline="Mois 0 à 2")
pdf.body(
    "Gains immédiats applicables sans changer de stack technique ni risquer de régression "
    "de compatibilité. Ces modifications constituent le socle minimum à déployer en priorité."
)

pdf.h3("1.1  Certificat TLS : RSA 2048 → ECDSA P-384")
pdf.body(
    "ECDSA P-384 offre ~192 bits de sécurité classique, soit ~96 bits de sécurité quantique "
    "(Grover), contre ~64 bits pour RSA 2048. La modification porte sur une commande dans "
    "postinst:114 et est transparente pour tous les navigateurs modernes."
)
pdf.code(
    "# Dans DEBIAN/postinst -- remplacer le bloc openssl existant\n"
    "openssl ecparam -name secp384r1 -genkey -noout -out \"$SSL_DIR/trace.key\"\n"
    "openssl req -new -x509 -key \"$SSL_DIR/trace.key\" -out \"$SSL_DIR/trace.crt\" \\\n"
    "    -days 825 -sha384 \\\n"
    "    -subj \"/C=FR/ST=Paris/L=Paris/O=DGFIP/OU=TRACE/CN=localhost\""
)

pdf.h3("1.2  Nginx : TLS 1.3 exclusif + courbes modernes + headers de sécurité")
pdf.body(
    "Forcer TLS 1.3 élimine les suites de chiffrement obsolètes (RC4, 3DES, CBC). "
    "L'ajout du header HSTS protège contre les downgrades HTTP. CSP limite la surface XSS."
)
pdf.code(
    "# nginx/sites-available/trace -- dans le bloc server 443\n"
    "ssl_protocols           TLSv1.3;\n"
    "ssl_prefer_server_ciphers off;\n"
    "ssl_ecdh_curve          X25519:secp384r1;\n"
    "\n"
    "add_header Strict-Transport-Security  \"max-age=63072000; includeSubDomains; preload\" always;\n"
    "add_header X-Frame-Options            \"DENY\" always;\n"
    "add_header X-Content-Type-Options     \"nosniff\" always;\n"
    "add_header Content-Security-Policy    \"default-src 'self'; script-src 'self';\n"
    "                                       style-src 'self' 'unsafe-inline';\" always;"
)

pdf.h3("1.3  JWT : HS256 → HS512 + secret 64 caractères")
pdf.body(
    "HS512 avec clé 512 bits offre 256 bits de sécurité quantique effective (après Grover). "
    "NIST considère 128 bits quantiques suffisants à horizon 2035 ; 256 bits offre une marge "
    "de 20 ans supplémentaires. Modification en deux lignes dans schema.sql, "
    "PostgREST supporte HS512 nativement."
)
pdf.code(
    "-- schema.sql:49 et :51 -- remplacer HS256/sha256 par HS512/sha512\n"
    "header_b64 := auth.url_encode(convert_to('{\"alg\":\"HS512\",\"typ\":\"JWT\"}', 'utf8'));\n"
    "signature  := auth.url_encode(hmac(..., convert_to(secret,'utf8'), 'sha512'));\n"
    "\n"
    "-- postinst:17 -- passer a 64 caracteres (512 bits d'entropie)\n"
    "JWT_SECRET=$(tr -dc 'A-Za-z0-9_-' < /dev/urandom | head -c 64)"
)
pdf.note(
    "Impact utilisateurs : nul. Les sessions actives seront invalides après redémarrage "
    "(comportement identique à toute rotation de secret JWT). Une seule reconnexion requise.",
    color=(240, 255, 240)
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 4 — PHASE 2
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.phase_badge("PHASE 2 — Hybride PQC pour l'échange de clés TLS",
                GREEN_OK, effort_n=2, impact_n=4, timeline="Mois 3 à 9")
pdf.body(
    "Phase la plus structurante : elle neutralise la menace HNDL sur le trafic TLS en "
    "activant ML-KEM-768 (FIPS 203) pour l'échange de clés. Nécessite OpenSSL 3.5+, "
    "disponible sur Debian 13 (Trixie), cible de déploiement du projet."
)

pdf.h3("2.1  Prérequis : OpenSSL 3.5 sur Debian 13 (Trixie)")
pdf.body(
    "OpenSSL 3.5 (avril 2025) intègre ML-KEM nativement sans dépendance externe. "
    "Nginx compilé contre OpenSSL 3.5 supporte le groupe X25519MLKEM768."
)
pdf.code(
    "# Verification post-migration Debian 13\n"
    "openssl version                              # doit afficher 3.5.x\n"
    "openssl list -kem-algorithms | grep ML-KEM   # ML-KEM-512 / 768 / 1024"
)

pdf.h3("2.2  Nginx : activer le groupe hybride X25519MLKEM768")
pdf.body(
    "X25519MLKEM768 est le groupe hybride standardisé (IETF draft) : combinaison de "
    "X25519 (classique) + ML-KEM-768 (post-quantique FIPS 203). La directive est un simple "
    "ajout dans ssl_ecdh_curve, sans rupture de compatibilité : les clients sans support "
    "PQC négocient automatiquement X25519 (graceful downgrade)."
)
pdf.code(
    "# nginx/sites-available/trace -- bloc server 443\n"
    "ssl_protocols  TLSv1.3;\n"
    "ssl_ecdh_curve X25519MLKEM768:X25519:secp384r1;\n"
    "# Ordre : PQC hybride d'abord, fallback classique ensuite"
)

pdf.h3("2.3  Compatibilité clients")
pdf.ln(1)
w_c = [52, 58, CONTENT_W - 52 - 58]
pdf.table_row(["Client", "Support X25519MLKEM768", "Version minimale"],
              w_c, header=True, fill_color=BLUE_DARK)
rows_c = [
    ("Chrome / Chromium",   "Oui (depuis v124)",    "Chrome 124+"),
    ("Firefox",             "Oui (depuis v127)",    "Firefox 127+"),
    ("Safari",              "En cours (2026)",      "Safari 18+"),
    ("curl + OpenSSL 3.5",  "Oui",                  "curl 8.3+"),
    ("Navigateurs anciens", "Fallback sur X25519",  "TLS 1.3 requis"),
]
for i, row in enumerate(rows_c):
    pdf.table_row(row, w_c, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

pdf.ln(2)

pdf.h3("2.4  Validation post-déploiement")
pdf.code(
    "# Verifier la negociation PQC\n"
    "openssl s_client -connect localhost:443 -groups X25519MLKEM768 2>&1 \\\n"
    "  | grep 'Server Temp Key'\n"
    "# Resultat attendu : Server Temp Key: X25519MLKEM768, ...\n"
    "\n"
    "# Depuis un autre poste du reseau\n"
    "curl -v --curves X25519MLKEM768 https://<IP_SERVEUR>/api/rpc/me 2>&1 \\\n"
    "  | grep -i 'SSL connection\\|curve'"
)

pdf.note(
    "Cette phase seule suffit à protéger la confidentialité des échanges contre un adversaire "
    "disposant d'un ordinateur quantique en 2030-2040. C'est l'objectif prioritaire.",
    color=(235, 255, 235)
)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 5 — PHASES 3 & 4
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.phase_badge("PHASE 3 — Signatures PQC pour les JWTs",
                ORANGE_WARN, effort_n=3, impact_n=3, timeline="Mois 9 à 18")
pdf.body(
    "HS512 est symétrique : le même secret sert à créer et à vérifier les tokens. "
    "Une signature asymétrique post-quantique (ML-DSA) permet de ne jamais exposer la clé "
    "privée, même à PostgREST. Phase optionnelle si le secret JWT est suffisamment "
    "protégé (accès root uniquement à /etc/trace-api.conf)."
)

pdf.h3("3.1  Architecture cible : ML-DSA-65 via plpython3u")
pdf.body(
    "PostgreSQL génère et conserve la clé privée ML-DSA dans auth.secrets (inaccessible "
    "aux rôles applicatifs). PostgREST reçoit uniquement la clé publique PEM via trace-api.conf."
)
pdf.code(
    "-- Activer Python dans PostgreSQL\n"
    "CREATE EXTENSION IF NOT EXISTS plpython3u;\n"
    "\n"
    "-- Generer la paire de cles ML-DSA-65 (une fois, a l'installation)\n"
    "CREATE OR REPLACE FUNCTION auth.generate_mldsa_keypair()\n"
    "RETURNS TABLE(private_key text, public_key text) AS $$\n"
    "import oqs\n"
    "sig = oqs.Signature('ML-DSA-65')\n"
    "pub = sig.generate_keypair()\n"
    "priv = sig.export_secret_key()\n"
    "return [(priv.hex(), pub.hex())]\n"
    "$$ LANGUAGE plpython3u;\n"
    "\n"
    "-- Stockage securise (auth.secrets inaccessible aux roles applicatifs)\n"
    "INSERT INTO auth.secrets VALUES ('mldsa_private', ...), ('mldsa_public', ...);"
)

pdf.h3("3.2  Prérequis")
pdf.bullet("PostgreSQL configuré avec plpython3u (paquet postgresql-plpython3)")
pdf.bullet("liboqs-python installé : pip3 install liboqs-python")
pdf.bullet("Vérifier la compatibilité PostgREST avec les JWTs ML-DSA (suivre les releases)")

pdf.ln(4)

pdf.phase_badge("PHASE 4 — Infrastructure PQC complète",
                PURPLE, effort_n=4, impact_n=4, timeline="Mois 18 à 36")
pdf.body(
    "Cette phase dépend de la maturité de l'écosystème externe (CAs institutionnelles, "
    "PostgreSQL, bibliothèques système). Elle finalise la migration vers une surface "
    "cryptographique entièrement post-quantique."
)

pdf.ln(1)
w_p4 = [65, 62, CONTENT_W - 65 - 62]
pdf.table_row(["Action", "Déclencheur", "Dépendance externe"],
              w_p4, header=True, fill_color=BLUE_DARK)
rows_p4 = [
    ("Certificats TLS ML-DSA signés CA",
     "Émission FIPS 204 par ANSSI / IGC/A",
     "ANSSI / DigiCert PQ"),
    ("Argon2id remplace Bcrypt",
     "pgcrypto intègre argon2id",
     "PostgreSQL 18+ / extension"),
    ("Sauvegardes NFS chiffrées ML-KEM",
     "Avant migration vers stockage cloud",
     "gpg + liboqs ou age-pq"),
    ("Audit conformité ANSSI / RGS PQ",
     "Avant déploiement production étendue",
     "Prestataire habilité"),
]
for i, row in enumerate(rows_p4):
    pdf.table_row(row, w_p4, fill_color=GREY_LIGHT if i % 2 == 0 else WHITE)

# ─────────────────────────────────────────────────────────────────────────────
# PAGE 6 — SYNTHESE
# ─────────────────────────────────────────────────────────────────────────────
pdf.add_page()

pdf.h1("3. Tableau de bord de synthèse")

pdf.ln(2)
w_s = [24, 20, 72, 16, 16, CONTENT_W - 24 - 20 - 72 - 16 - 16]
pdf.table_row(["Phase", "Horizon", "Action clé", "Effort", "Impact", "Statut"],
              w_s, header=True, fill_color=BLUE_DARK)
rows_s = [
    ("Phase 1", "0-2 mois",
     "ECDSA P-384  |  TLS 1.3 + HSTS  |  JWT HS512",
     "★☆☆☆", "★★★☆", "A planifier"),
    ("Phase 2", "3-9 mois",
     "OpenSSL 3.5 + X25519MLKEM768 (Debian 13)",
     "★★☆☆", "★★★★", "Sous condition"),
    ("Phase 3", "9-18 mois",
     "ML-DSA-65 pour signatures JWT",
     "★★★☆", "★★★☆", "Optionnel"),
    ("Phase 4", "18-36 mois",
     "Certificats CA PQC + Argon2id + NFS chiffré",
     "★★★★", "★★★★", "Ecosystème"),
]
phase_colors = [BLUE_LIGHT, (220, 255, 220), (255, 245, 215), (240, 225, 255)]
for row, color in zip(rows_s, phase_colors):
    pdf.table_row(row, w_s, fill_color=color)

pdf.ln(5)

pdf.h2("Priorités immédiates (Phase 1)")
pdf.body("Les trois actions suivantes sont réalisables en moins d'une journée de travail :")
pdf.bullet(
    "Générer un certificat ECDSA P-384 dans le script postinst (1 commande openssl)",
    bold_prefix="1. ")
pdf.bullet(
    "Forcer TLS 1.3 + activer HSTS et CSP dans la configuration Nginx (5 lignes)",
    bold_prefix="2. ")
pdf.bullet(
    "Passer le JWT de HS256/sha256 à HS512/sha512 dans schema.sql (2 lignes) "
    "et étendre le secret à 64 chars dans postinst (1 ligne)",
    bold_prefix="3. ")

pdf.ln(4)

pdf.h2("Visualisation temporelle")
pdf.ln(3)

phases_tl = [
    ("Phase 1",  0,  2, BLUE_MED,   "Classique renforcé"),
    ("Phase 2",  3,  9, GREEN_OK,   "TLS hybride PQC"),
    ("Phase 3",  9, 18, ORANGE_WARN,"JWT ML-DSA"),
    ("Phase 4", 18, 36, PURPLE,     "Infra PQC complète"),
]
total_months = 36
bar_x = MARGIN_L + 22
bar_w = CONTENT_W - 24
bar_h = 7
gap   = 2

for label, start, end, color, desc in phases_tl:
    xs = bar_x + (start / total_months) * bar_w
    xe = bar_x + (end   / total_months) * bar_w
    bw = xe - xs

    pdf.set_x(MARGIN_L)
    pdf.set_font("Sans", "B", 7.5)
    pdf.cell(22, bar_h + gap, label, align="R", new_x=XPos.RIGHT, new_y=YPos.LAST)

    y_bar = pdf.get_y()
    pdf.set_fill_color(*color)
    pdf.rect(xs, y_bar, bw, bar_h, "F")
    pdf.set_xy(xs, y_bar)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Sans", "B", 7)
    pdf.cell(bw, bar_h, f"  {desc}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*BLACK)
    pdf.ln(gap)

# Graduations mois
pdf.set_font("Sans", "", 6.8)
for m in [0, 3, 6, 9, 12, 18, 24, 36]:
    xm = bar_x + (m / total_months) * bar_w
    pdf.set_xy(xm - 2, pdf.get_y())
    pdf.cell(10, 4, f"M{m}")

pdf.ln(6)

pdf.h2("Références")
refs = [
    "NIST FIPS 203 — ML-KEM (Module-Lattice-Based Key-Encapsulation Mechanism)",
    "NIST FIPS 204 — ML-DSA (Module-Lattice-Based Digital Signature Standard)",
    "NIST FIPS 205 — SLH-DSA (Stateless Hash-Based Digital Signature Standard)",
    "OpenSSL 3.5 — ML-KEM et ML-DSA natifs (avril 2025)",
    "ANSSI — Recommandations de sécurité relatives à la cryptographie post-quantique (2024)",
    "IETF — Hybrid key exchange in TLS 1.3 (draft-ietf-tls-hybrid-design)",
    "RFC 8446 — The Transport Layer Security (TLS) Protocol Version 1.3",
    "PostgREST Documentation — JWT Authentication",
]
for ref in refs:
    pdf.bullet(ref)

pdf.ln(3)
pdf.note(
    "Document généré automatiquement par generate_pq_roadmap_pdf.py (dépôt mobiTrace). "
    "Pour toute question : équipe technique DGFiP.",
    color=GREY_LIGHT
)

# ── Sauvegarde ────────────────────────────────────────────────────────────────
OUTPUT = "/home/adm1/TRACE/TRACE_Feuille_Route_PostQuantique.pdf"
pdf.output(OUTPUT)
print(f"PDF genere : {OUTPUT}")
