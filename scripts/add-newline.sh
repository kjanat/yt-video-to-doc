#!/bin/bash
# Add trailing newline to files that lack it

for file in "$@"; do
  if [ -f "$file" ]; then
    # Check if file ends with newline
    if [ -n "$(tail -c 1 "$file")" ]; then
      # Add newline if missing
      echo >> "$file"
    fi
  fi
done
