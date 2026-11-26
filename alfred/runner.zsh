#!/bin/zsh

set -u

workflow_dir="${0:A:h}"
command_name="${0:t}"
exec /usr/bin/osascript -l JavaScript "${workflow_dir}/logseq.js" "${command_name}" "$@"
