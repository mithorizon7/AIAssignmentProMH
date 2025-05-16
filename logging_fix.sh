#!/bin/bash
sed -i '279s/console.log(`\[GEMINI\] Response preview: ${text.substring(0, Math.min(100, text.length))}...`);/console.log(`[GEMINI] Response format check - appears to be valid JSON: ${text.trim().startsWith("{") && text.trim().endsWith("}")}`);/' server/adapters/gemini-adapter.ts
sed -i '496s/console.log(`\[GEMINI\] Response preview: ${text.substring(0, Math.min(100, text.length))}...`);/console.log(`[GEMINI] Response format check - appears to be valid JSON: ${text.trim().startsWith("{") && text.trim().endsWith("}")}`);/' server/adapters/gemini-adapter.ts
chmod +x logging_fix.sh
./logging_fix.sh
