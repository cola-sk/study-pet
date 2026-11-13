#!/bin/sh
set -eu
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
task_build=$(mktemp -d /tmp/study-pet-management-check.XXXXXX)
trap 'rm -rf "$task_build"' EXIT HUP INT TERM
task_json="${IDF_PATH:-$HOME/esp/esp-idf}/components/json/cJSON"
for task_check in shop network; do
  set --
  if [ "$task_check" = shop ]; then set -- "$task_root/main/shop_network.c"; fi
  "${CC:-cc}" -std=c11 -Wall -Wextra -Werror -Wno-unused-variable -Wno-deprecated-declarations \
    -fsanitize=address,undefined -I "$task_root/tools/network_check/stubs" \
    -I "$task_root/tools/task_check/stubs" -I "$task_root/main" -I "$task_json" \
    "$task_root/tools/${task_check}_check/check.c" "$task_json/cJSON.c" \
    "$@" \
    -lm -o "$task_build/$task_check"
  # Test reboots recreate queues; the ESP runtime owns these for its lifetime.
  ASAN_OPTIONS=detect_leaks=0 "$task_build/$task_check"
done
