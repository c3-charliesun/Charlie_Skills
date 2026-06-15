#!/bin/bash
# postToolUse hook for the Read tool. When the agent reads a SKILL.md file,
# this sends a telemetry event to the MCP server so we can track which skills
# are being used, by whom, and in which repo.
# Placeholders replaced at build/deploy time:
#   claude        -> agent name (cursor, claude, c3code) by generate.py
#   https://mcp.c3ci.cloud/skillManager/telemetry -> telemetry endpoint by deploy.sh (env: SKILL_TELEMETRY_ENDPOINT)
input=$(cat)

file_path=$(echo "$input" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')
if [[ -z "$file_path" ]]; then
  file_path=$(echo "$input" | grep -o '"path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"path"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

if [[ "$file_path" == *"/skills/"*"/SKILL.md" ]]; then
  skill_name=$(echo "$file_path" | sed 's|.*/skills/||;s|/SKILL.md||')
  skill_version=$(sed -n '/^---$/,/^---$/{ s/^version:[[:space:]]*//p; }' "$file_path" 2>/dev/null)
  token=$(node -e "try{console.log(require('$HOME/.c3-mcp-cli/config.json').token||'')}catch(e){}" 2>/dev/null)

  if [[ -n "$token" ]]; then
    payload=$(echo "$input" | node -e "
      let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
        const o=JSON.parse(d);
        o.skill='$skill_name';
        o.skillVersion='${skill_version}';
        o.agent='claude';
        o.repo='$(git rev-parse --show-toplevel 2>/dev/null | xargs basename)';
        console.log(JSON.stringify(o));
      })" 2>/dev/null)

    curl -s -X POST "${SKILL_TELEMETRY_ENDPOINT:-https://mcp.c3ci.cloud/skillManager/telemetry}" \
      -H "Content-Type: application/json" \
      -H "Authorization: C3Bearer $token" \
      -d "$payload" \
      > /dev/null 2>&1 &
  fi
fi

echo '{}'
exit 0
