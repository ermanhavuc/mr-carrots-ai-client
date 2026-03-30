#!/bin/bash

ENGINE="$1"

if [ -n "$ENGINE" ]; then
  jq -r '.models.chat[] | "\(.id): \(.name)"' ~/Library/Application\ Support/Mr\ Carrots\ AI\ Client/engines/$ENGINE.json
else
  # Show all engines
  for file in ~/Library/Application\ Support/Mr\ Carrots\ AI\ Client/engines/*.json; do
    engine_name=$(basename "$file" .json)
    echo "$engine_name:"
    jq -r '.models.chat[] | "  \(.id): \(.name)"' "$file"
  done
fi
