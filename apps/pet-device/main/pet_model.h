#pragma once
#include <stdbool.h>
#include <stdint.h>

#define PET_MAX_MEALS 4
#define PET_MAX_SLEEP_WINDOWS 6
#define PET_MAX_AGE_SECONDS (7u * 24 * 60 * 60)
typedef struct { uint16_t start, end; } pet_sleep_window_t;
typedef struct {
    const char *id, *name;
    int timezone_offset_minutes;
    uint16_t meals[PET_MAX_MEALS];
    unsigned meal_count;
    uint32_t minimum_meal_gap_s, unsynced_hunger_s, water_interval_s, companionship_interval_s;
    pet_sleep_window_t sleep_windows[PET_MAX_SLEEP_WINDOWS];
    unsigned sleep_window_count;
    uint32_t sleepy_lead_s, manual_nap_s, wake_grace_s;
} pet_profile_t;
typedef enum { PET_IDLE, PET_HUNGRY, PET_THIRSTY, PET_SLEEPY, PET_LONELY, PET_SLEEPING } pet_mood_t;
typedef enum { PET_CARE_FOOD, PET_CARE_WATER, PET_CARE_COMPANY } pet_care_t;
typedef struct {
    uint32_t food_age_s, water_age_s, company_age_s;
    uint32_t manual_sleep_s, wake_grace_s;
} pet_model_t;

const pet_profile_t *pet_profile_find(const char *id);
const pet_profile_t *pet_profile_default(void);
void pet_model_advance(pet_model_t *model, uint64_t elapsed_s);
pet_mood_t pet_model_mood(const pet_profile_t *profile, const pet_model_t *model, int64_t utc_s);
void pet_model_care(const pet_profile_t *profile, pet_model_t *model, pet_care_t care);
void pet_model_toggle_sleep(const pet_profile_t *profile, pet_model_t *model, int64_t utc_s);
