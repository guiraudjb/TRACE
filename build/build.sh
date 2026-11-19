#!/bin/bash
# Construit les paquets TRACE.
#   ./build.sh                 -> tous les paquets
#   ./build.sh trace-server    -> seulement ceux nommés (évite de changer l'empreinte
#                                  d'un .deb dont la version n'a pas changé)
set -e
cd "$(dirname "$0")"

PAQUETS=("$@")
[ ${#PAQUETS[@]} -eq 0 ] && PAQUETS=(trace-server trace-backup-client trace-backup-server trace-backup-server-survey trace-zebra-printer)

# Construction reproductible : dates figées sur le dernier commit
export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-$(git log -1 --format=%ct 2>/dev/null || date +%s)}"

for paquet in "${PAQUETS[@]}"; do
    version=$(sed -n 's/^Version:[[:space:]]*//p' "$paquet/DEBIAN/control")
    architecture=$(sed -n 's/^Architecture:[[:space:]]*//p' "$paquet/DEBIAN/control")
    # Pas de fichier modifiable par le groupe ou les autres (umask de la copie de travail)
    chmod -R go-w "$paquet"
    # --root-owner-group : fichiers installés en root:root (et non avec l'uid du développeur)
    dpkg-deb --root-owner-group -Zxz --build "$paquet" "${paquet}_${version}_${architecture}.deb"
done
