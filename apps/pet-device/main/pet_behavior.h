#pragma once
#include "pet_model.h"

void pet_behavior_init(void);
void pet_behavior_tick(void);
pet_mood_t pet_behavior_mood(void);
void pet_behavior_care(pet_care_t care);
void pet_behavior_toggle_sleep(void);
void pet_behavior_bind_child(const char *child_id);
