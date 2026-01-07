#!/bin/bash
# Stockpile Auto-Extract Script for macOS
# Automatically extracts ZIP files and removes __MACOSX folders
#
# Usage:
#   1. Edit WATCH_DIR below to your Stockpile download folder
#   2. Run: chmod +x auto-extract-mac.sh
#   3. Run: ./auto-extract-mac.sh
#
# For automatic execution, set up as a LaunchAgent (see README)

# === CONFIGURATION ===
# Change this to your Stockpile download folder
WATCH_DIR="$HOME/Downloads/Stockpile"

# === SCRIPT ===
if [ ! -d "$WATCH_DIR" ]; then
  echo "Error: Directory not found: $WATCH_DIR"
  echo "Please edit WATCH_DIR in this script to match your Stockpile folder."
  exit 1
fi

echo "Stockpile Auto-Extract"
echo "======================"
echo "Watching: $WATCH_DIR"
echo ""

# Find and extract all ZIP files
find "$WATCH_DIR" -name "*.zip" -type f | while read zipfile; do
  dir=$(dirname "$zipfile")
  filename=$(basename "$zipfile" .zip)

  echo "Extracting: $filename"

  # Extract to same directory (exclude __MACOSX)
  unzip -o -q "$zipfile" -d "$dir" -x "__MACOSX/*"

  # Remove the zip file
  rm "$zipfile"

  echo "  Done!"
done

# Clean up any remaining __MACOSX folders
find "$WATCH_DIR" -name "__MACOSX" -type d -exec rm -rf {} + 2>/dev/null

echo ""
echo "All ZIP files extracted!"
