#!/bin/bash

# Cleanup script for the 6 orphaned asset groups
# These files were uploaded during testing and never properly deleted

WORKER_URL="https://ibaproject-production.up.railway.app"

ASSET_GROUPS=(
  "de7f090b-124b-4a44-84d2-6d7bbd0f03e2"
  "2326e6c3-f719-4d62-a168-39ec388cfb48"
  "67725319-24df-46bd-84ed-e53410964bc6"
  "a0e76a7d-4014-40ba-bd75-f1a9ce592fd7"
  "6e5fb8a8-5929-4a86-b949-bfac0e0fcac8"
  "353668cf-baf9-4114-90bf-34761e26100c"
)

echo "🧹 Starting cleanup of 6 orphaned asset groups..."
echo ""

for asset_group_id in "${ASSET_GROUPS[@]}"; do
  echo "📁 Checking asset group: $asset_group_id"

  # First check what exists
  check_response=$(curl -s "$WORKER_URL/api/check-asset-group/$asset_group_id")
  echo "   Status: $check_response"

  # Then delete
  echo "   Deleting..."
  delete_response=$(curl -s -X POST "$WORKER_URL/api/delete-asset-group" \
    -H "Content-Type: application/json" \
    -d "{\"assetGroupId\": \"$asset_group_id\"}")

  echo "   Result: $delete_response"
  echo ""

  sleep 1
done

echo "✅ Cleanup complete! Check the results above."
echo ""
echo "To verify all files are gone, run:"
echo "  curl $WORKER_URL/api/check-asset-group/de7f090b-124b-4a44-84d2-6d7bbd0f03e2"
