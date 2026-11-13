#!/bin/sh
set -eu
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
task_build=$(mktemp -d /tmp/study-pet-behavior-check.XXXXXX)
trap 'rm -rf "$task_build"' EXIT HUP INT TERM
python3 "$task_root/tools/generate_pet_profiles.py" --check
"${CC:-cc}" -std=c11 -Wall -Wextra -Werror -fsanitize=address,undefined \
  -I "$task_root/main" "$task_root/tools/behavior_check/model_check.c" \
  "$task_root/main/pet_model.c" "$task_root/main/pet_profiles.c" "$task_root/main/screen_idle.c" \
  -o "$task_build/model_check"
"$task_build/model_check"
"${CC:-cc}" -std=c11 -Wall -Wextra -Werror -fsanitize=address,undefined \
  -I "$task_root/tools/behavior_check/stubs" -I "$task_root/main" \
  "$task_root/tools/behavior_check/runtime_check.c" "$task_root/main/pet_model.c" \
  "$task_root/main/pet_profiles.c" "$task_root/main/screen_idle.c" -o "$task_build/runtime_check"
"$task_build/runtime_check"
