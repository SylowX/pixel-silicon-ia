#!/usr/bin/env bash
# Verilator compatibility wrapper.
# - Prefers Verilator >= 5.036 from /opt/verilator (built in the Dockerfile;
#   cocotb 2.x refuses older versions).
# - Falls back to the distro Verilator (4.038 on Ubuntu 22.04) and, only for
#   4.x, strips flags it does not understand (such as -Wno-EOFNEWLINE).

if [ -x /opt/verilator/bin/verilator ]; then
    exec /opt/verilator/bin/verilator "$@"
fi

clean_args=()
for arg in "$@"; do
    if [ "$arg" = "-Wno-EOFNEWLINE" ]; then
        continue
    fi
    clean_args+=("$arg")
done

exec /usr/bin/verilator "${clean_args[@]}"
