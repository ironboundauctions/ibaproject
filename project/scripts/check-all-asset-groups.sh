#!/bin/bash

WORKER_URL="https://ibaproject-production.up.railway.app"

ASSET_GROUPS=(
  "de7f090b-124b-4a44-84d2-6d7bbd0f03e2"
  "2326e6c3-f719-4d62-a168-39ec388cfb48"
  "67725319-24df-46bd-84ed-e53410964bc6"
  "a0e76a7d-4014-40ba-bd75-f1a9ce592fd7"
  "6e5fb8a8-5929-4a86-b949-bfac0e0fcac8"
  "353668cf-baf9-4114-90bf-34761e26100c"
)

echo "Checking all 6 asset groups..."
echo ""

total_b2=0
total_db=0

for asset_group_id in "${ASSET_GROUPS[@]}"; do
  response=$(curl -s "$WORKER_URL/api/check-asset-group/$asset_group_id")
  b2_count=$(echo $response | grep -o '"b2Count":[0-9]*' | cut -d':' -f2)
  db_count=$(echo $response | grep -o '"dbCount":[0-9]*' | cut -d':' -f2)
  
  total_b2=$((total_b2 + b2_count))
  total_db=$((total_db + db_count))
  
  if [ "$b2_count" -eq 0 ] && [ "$db_count" -eq 0 ]; then
    echo "✅ $asset_group_id - CLEAN (B2: $b2_count, DB: $db_count)"
  else
    echo "⚠️  $asset_group_id - FILES FOUND (B2: $b2_count, DB: $db_count)"
  fi
done

echo ""
echo "Total files remaining:"
echo "  B2: $total_b2"
echo "  DB: $total_db"
echo ""

if [ "$total_b2" -eq 0 ] && [ "$total_db" -eq 0 ]; then
  echo "🎉 ALL CLEAN! Ready for fresh testing."
else
  echo "⚠️  Cleanup needed. Run ./cleanup-6-orphaned-files.sh"
fi
