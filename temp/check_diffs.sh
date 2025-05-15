#!/bin/bash

# Check if the file exists
if [ ! -f "../.git" ]; then
  echo "WARNING: No Git repository detected. Cannot check file history."
else
  # Try to get the previous version of the file from Git
  git show HEAD:server/adapters/gemini-adapter.ts > original_gemini_adapter.ts
  echo "First few lines of the previous version from Git:"
  head -n 10 original_gemini_adapter.ts
fi

# Check what npm package was being used
echo "Checking package.json for Google's Generative AI packages:"
grep -A 1 -B 1 "google" ../package.json

# Look for recent changes to the adapter file
echo "Recent changes to the Gemini adapter:"
find ../server/adapters -name "gemini-adapter.ts" -mtime -1 -ls

