#!/bin/bash

echo "Testing with a short educational video..."
echo ""

# Git in 100 seconds (2 minutes) - has text overlays
VIDEO_URL="https://www.youtube.com/watch?v=hwP7WQkmECE" # Git Explained in 100 Seconds - Fireship

echo "Video: Git in 100 Seconds"
echo "URL: $VIDEO_URL"
echo ""

# Clean previous test
rm -rf temp/* output/*

# Run conversion
pnpm run dev convert "$VIDEO_URL" -i 3

echo ""
echo "Check output/git_in_100_seconds.md for results!"
