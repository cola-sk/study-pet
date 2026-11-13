#include "pet_model.h"

static uint32_t age(uint32_t current, uint64_t elapsed)
{
    return elapsed >= PET_MAX_AGE_SECONDS - current ? PET_MAX_AGE_SECONDS : current + (uint32_t)elapsed;
}
static uint32_t remaining(uint32_t current, uint64_t elapsed)
{
    return elapsed >= current ? 0 : current - (uint32_t)elapsed;
}
void pet_model_advance(pet_model_t *model, uint64_t elapsed_s)
{
    model->food_age_s = age(model->food_age_s, elapsed_s);
    model->water_age_s = age(model->water_age_s, elapsed_s);
    model->company_age_s = age(model->company_age_s, elapsed_s);
    model->manual_sleep_s = remaining(model->manual_sleep_s, elapsed_s);
    model->wake_grace_s = remaining(model->wake_grace_s, elapsed_s);
}
static bool scheduled_sleep(const pet_profile_t *profile, unsigned minute)
{
    for (unsigned i = 0; i < profile->sleep_window_count; i++) {
        pet_sleep_window_t window = profile->sleep_windows[i];
        if (window.start < window.end ? minute >= window.start && minute < window.end : minute >= window.start || minute < window.end) return true;
    }
    return false;
}
pet_mood_t pet_model_mood(const pet_profile_t *profile, const pet_model_t *model, int64_t utc_s)
{
    bool clock_ready = utc_s >= 1704067200;
    unsigned second = clock_ready ? (unsigned)((utc_s + profile->timezone_offset_minutes * 60) % 86400) : 0;
    if (model->manual_sleep_s || (clock_ready && !model->wake_grace_s && scheduled_sleep(profile, second / 60))) return PET_SLEEPING;
    if (model->water_age_s >= profile->water_interval_s) return PET_THIRSTY;
    bool hungry = model->food_age_s >= profile->unsynced_hunger_s;
    if (clock_ready) {
        unsigned since_meal = 86400;
        for (unsigned i = 0; i < profile->meal_count; i++) {
            unsigned since = (second + 86400 - profile->meals[i] * 60) % 86400;
            if (since < since_meal) since_meal = since;
        }
        hungry = model->food_age_s >= profile->minimum_meal_gap_s && model->food_age_s > since_meal;
    }
    if (hungry) return PET_HUNGRY;
    if (clock_ready && !model->wake_grace_s) {
        for (unsigned i = 0; i < profile->sleep_window_count; i++) {
            unsigned until = (profile->sleep_windows[i].start * 60 + 86400 - second) % 86400;
            if (until > 0 && until <= profile->sleepy_lead_s) return PET_SLEEPY;
        }
    }
    if (model->company_age_s >= profile->companionship_interval_s) return PET_LONELY;
    return PET_IDLE;
}
void pet_model_care(const pet_profile_t *profile, pet_model_t *model, pet_care_t care)
{
    if (care == PET_CARE_FOOD) model->food_age_s = 0;
    if (care == PET_CARE_WATER) model->water_age_s = 0;
    if (care == PET_CARE_COMPANY) model->company_age_s = 0;
    model->manual_sleep_s = 0;
    model->wake_grace_s = profile->wake_grace_s;
}
void pet_model_toggle_sleep(const pet_profile_t *profile, pet_model_t *model, int64_t utc_s)
{
    bool sleeping = pet_model_mood(profile, model, utc_s) == PET_SLEEPING;
    model->manual_sleep_s = sleeping ? 0 : profile->manual_nap_s;
    model->wake_grace_s = sleeping ? profile->wake_grace_s : 0;
}
