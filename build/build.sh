#!/bin/bash
echo "Build all"
dpkg-deb --build trace-build trace-server_1.0.0_all.deb
dpkg-deb --build trace-backup-client trace-backup-client_1.0.0_all.deb
dpkg-deb --build trace-backup-server trace-backup-server_1.0.0_all.deb
dpkg-deb --build trace-backup-server-survey trace-backup-server-survey_1.0.0_all.deb
dpkg-deb --build trace-zebra-printer trace-zebra-printer_1.0.0_all.deb

