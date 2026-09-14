#!/bin/bash
# Crea/actualiza el job Pipeline 'HelpDesk' en Jenkins local.
# Uso:
#   ./scripts/jenkins-create-job.sh [JOB_NAME]
# Requiere: usuario + API token de Jenkins (Manage Jenkins > Users > Security > API Token).
#   export JENKINS_USER=admin JENKINS_TOKEN=<api-token>
set -euo pipefail

JENKINS_URL="${JENKINS_URL:-http://127.0.0.1:8080}"
JOB_NAME="${1:-HelpDesk}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$REPO_ROOT/jenkins/job-config.xml"

: "${JENKINS_USER:?export JENKINS_USER=<usuario>}"
: "${JENKINS_TOKEN:?export JENKINS_TOKEN=<api-token>}"
[ -f "$CONFIG" ] || { echo "No existe $CONFIG"; exit 1; }

CRUMB_JSON=$(curl -s -u "$JENKINS_USER:$JENKINS_TOKEN" "$JENKINS_URL/crumbIssuer/api/json")
CRUMB=$(echo "$CRUMB_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('crumb',''))" 2>/dev/null || true)
CRUMB_FIELD=$(echo "$CRUMB_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('crumbRequestField','Jenkins-Crumb'))" 2>/dev/null || true)
HEADER=(); [ -n "$CRUMB" ] && HEADER=(-H "$CRUMB_FIELD: $CRUMB")

CODE=$(curl -s -o /dev/null -w "%{http_code}" -u "$JENKINS_USER:$JENKINS_TOKEN" "$JENKINS_URL/job/$JOB_NAME/config.xml")

if [ "$CODE" = "200" ]; then
  echo "Job '$JOB_NAME' existe → actualizando config..."
  curl -s -X POST -u "$JENKINS_USER:$JENKINS_TOKEN" "${HEADER[@]}" \
    -H "Content-Type: application/xml" --data-binary "@$CONFIG" \
    "$JENKINS_URL/job/$JOB_NAME/config.xml"
else
  echo "Creando job '$JOB_NAME'..."
  curl -s -X POST -u "$JENKINS_USER:$JENKINS_TOKEN" "${HEADER[@]}" \
    -H "Content-Type: application/xml" --data-binary "@$CONFIG" \
    "$JENKINS_URL/createItem?name=$JOB_NAME"
fi
echo "OK → $JENKINS_URL/job/$JOB_NAME/"
