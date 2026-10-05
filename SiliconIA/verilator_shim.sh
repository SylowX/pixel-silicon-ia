#!/usr/bin/env bash
# Verilator compatibility wrapper for Verilator 4.038
# Strips flags not supported in Verilator 4.038 (such as -Wno-EOFNEWLINE)

clean_args=()
for arg in "$@"; do
    if [ "$arg" = "-Wno-EOFNEWLINE" ]; then
        continue
    fi
    clean_args+=("$arg")
done

exec /usr/bin/verilator "${clean_args[@]}"
