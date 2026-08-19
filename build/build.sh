#!/bin/bash
set -e
echo "Build all"
cd "$(dirname "$0")"

for paquet in trace-server trace-backup-client trace-backup-server trace-backup-server-survey trace-zebra-printer; do
    version=$(sed -n 's/^Version:[[:space:]]*//p' "$paquet/DEBIAN/control")
    architecture=$(sed -n 's/^Architecture:[[:space:]]*//p' "$paquet/DEBIAN/control")
    dpkg-deb --build "$paquet" "${paquet}_${version}_${architecture}.deb"
done
