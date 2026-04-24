#!/bin/bash

# Remove old analysis worker service files that are causing build failures
# These files were replaced with barcodeScanner.ts only

echo "Removing old analysis worker service files from git..."

git rm -f analysis-worker/src/services/database.ts 2>/dev/null || echo "database.ts not in git"
git rm -f analysis-worker/src/services/jobProcessor.ts 2>/dev/null || echo "jobProcessor.ts not in git"
git rm -f analysis-worker/src/services/irondrive.ts 2>/dev/null || echo "irondrive.ts not in git"

echo "Done! Now commit and push these deletions."
echo ""
echo "Run:"
echo "  git commit -m 'Remove old analysis worker service files'"
echo "  git push"
