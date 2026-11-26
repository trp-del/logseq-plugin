#!/bin/zsh

set -u

message="$*"
if [[ -z "${message//[[:space:]]/}" ]]; then
    exit 0
fi

workflow_dir="${0:A:h}"
source_path="${workflow_dir}/toast.swift"
cache_dir="${alfred_workflow_cache:-${TMPDIR:-/tmp}/com.openai.alfred.logseq-db}"
binary_path="${cache_dir}/toast-native"
log_path="${cache_dir}/toast-build.log"

fallback_notification() {
    local message="${1:-Done}"
    /usr/bin/osascript - "$message" <<'APPLESCRIPT' >/dev/null 2>&1
on run argv
    display notification (item 1 of argv) with title "Logseq"
end run
APPLESCRIPT
}

if [[ ! -x "${binary_path}" || "${source_path}" -nt "${binary_path}" ]]; then
    /bin/mkdir -p "${cache_dir}"
    compiler_path="$(/usr/bin/xcrun --sdk macosx --find swiftc 2>"${log_path}")" || {
        print -u2 "Swift compiler not found. Install Apple Command Line Tools."
        fallback_notification "$*"
        exit 1
    }

    sdk_path="$(/usr/bin/xcrun --sdk macosx --show-sdk-path 2>>"${log_path}")" || {
        print -u2 "The macOS SDK could not be found. Update Apple Command Line Tools."
        fallback_notification "$*"
        exit 1
    }

    sdk_version="$(/usr/bin/xcrun --sdk macosx --show-sdk-version 2>>"${log_path}")" || {
        print -u2 "The macOS SDK version could not be read. Update Apple Command Line Tools."
        fallback_notification "$*"
        exit 1
    }

    target_architecture="$(/usr/bin/uname -m)"
    target_triple="${target_architecture}-apple-macosx${sdk_version}"

    temporary_binary="$(/usr/bin/mktemp "${cache_dir}/toast-native.XXXXXX")" || exit 1
    trap '/bin/rm -f "${temporary_binary}"' EXIT

    if ! "${compiler_path}" \
        -sdk "${sdk_path}" \
        -target "${target_triple}" \
        "${source_path}" \
        -o "${temporary_binary}" >"${log_path}" 2>&1; then
        print -u2 "Toast compilation failed. See ${log_path}"
        fallback_notification "$*"
        exit 1
    fi
    /bin/chmod +x "${temporary_binary}"
    /bin/mv -f "${temporary_binary}" "${binary_path}"
    trap - EXIT
fi

if ! "${binary_path}" "$@"; then
    print -u2 "The custom toast could not start. See ${log_path}"
    fallback_notification "$*"
    exit 1
fi
