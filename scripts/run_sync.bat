@echo off
cd /d "c:\Users\guyku\okf_knowledge_viewer"
node scripts/sync_google_health.mjs >> sync_log.txt 2>&1
