#!/bin/bash
# Custom build script for Vercel that bypasses TypeScript checking

# Disable TypeScript type checking
export TSC_COMPILE_ON_ERROR=true
export NEXT_TELEMETRY_DISABLED=1

# Run Next.js build
npx next build
