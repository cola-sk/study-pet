#include "pet_behavior.h"
#include "esp_timer.h"
#include "esp_log.h"
#include "nvs.h"
#include <string.h>
#include <stdio.h>
#include <time.h>

typedef struct {
    uint32_t version;
    char species[24], child_id[37];
    int64_t saved_utc;
    pet_model_t model;
} saved_behavior_t;
static saved_behavior_t saved;
static const pet_profile_t *profile;
static int64_t tick_s, loaded_s, checkpoint_s, restore_utc;
static unsigned cared_since_load;
static bool dirty;
static const char *TAG = "pet_behavior";

static int64_t clock_now(void) { int64_t now = time(NULL); return now >= 1704067200 ? now : 0; }
static bool valid(const saved_behavior_t *value)
{
    const pet_model_t *m = &value->model;
    return value->version == 1 && value->species[23] == 0 && value->child_id[36] == 0 &&
        !strcmp(value->species, profile->id) && value->saved_utc >= 0 &&
        m->food_age_s <= PET_MAX_AGE_SECONDS && m->water_age_s <= PET_MAX_AGE_SECONDS &&
        m->company_age_s <= PET_MAX_AGE_SECONDS && m->manual_sleep_s <= profile->manual_nap_s &&
        m->wake_grace_s <= profile->wake_grace_s;
}
static void save(void)
{
    saved.saved_utc = clock_now();
    nvs_handle_t handle;
    esp_err_t error = nvs_open("pet_behavior", NVS_READWRITE, &handle);
    if (error == ESP_OK) {
        error = nvs_set_blob(handle, "state", &saved, sizeof(saved));
        if (error == ESP_OK) error = nvs_commit(handle);
        nvs_close(handle);
    }
    dirty = error != ESP_OK;
    checkpoint_s = esp_timer_get_time() / 1000000;
    if (dirty) ESP_LOGW(TAG, "Could not save care state; will retry");
}
void pet_behavior_init(void)
{
    profile = pet_profile_default();
    memset(&saved, 0, sizeof(saved));
    saved.version = 1;
    snprintf(saved.species, sizeof(saved.species), "%s", profile->id);
    nvs_handle_t handle;
    if (nvs_open("pet_behavior", NVS_READWRITE, &handle) == ESP_OK) {
        saved_behavior_t value = {0}; size_t size = sizeof(value);
        if (nvs_get_blob(handle, "state", &value, &size) == ESP_OK && size == sizeof(value) && valid(&value)) saved = value;
        nvs_close(handle);
    }
    tick_s = loaded_s = checkpoint_s = esp_timer_get_time() / 1000000;
    restore_utc = saved.saved_utc;
    cared_since_load = 0;
    dirty = false;
    pet_behavior_tick();
    ESP_LOGI(TAG, "Animal rules: %s; care history loaded", profile->id);
}
void pet_behavior_tick(void)
{
    int64_t now_s = esp_timer_get_time() / 1000000;
    pet_model_advance(&saved.model, now_s > tick_s ? (uint64_t)(now_s - tick_s) : 0);
    tick_s = now_s;
    int64_t utc = clock_now();
    if (restore_utc && utc) {
        int64_t offline = utc - restore_utc - (now_s - loaded_s);
        if (offline > 0) {
            pet_model_t restored = saved.model;
            pet_model_advance(&restored, (uint64_t)offline);
            // A care action after boot must not be aged by pre-boot downtime.
            if (!(cared_since_load & (1u << PET_CARE_FOOD))) saved.model.food_age_s = restored.food_age_s;
            if (!(cared_since_load & (1u << PET_CARE_WATER))) saved.model.water_age_s = restored.water_age_s;
            if (!(cared_since_load & (1u << PET_CARE_COMPANY))) saved.model.company_age_s = restored.company_age_s;
            if (!(cared_since_load & 8u)) {
                saved.model.manual_sleep_s = restored.manual_sleep_s;
                saved.model.wake_grace_s = restored.wake_grace_s;
            }
        }
        restore_utc = 0;
    }
    if (now_s - checkpoint_s >= (dirty ? 5 : 300)) save();
}
pet_mood_t pet_behavior_mood(void)
{
    return pet_model_mood(profile, &saved.model, clock_now());
}
void pet_behavior_care(pet_care_t care)
{
    pet_behavior_tick();
    pet_model_care(profile, &saved.model, care);
    cared_since_load |= (1u << care) | 8u;
    save();
}
void pet_behavior_toggle_sleep(void)
{
    pet_behavior_tick();
    pet_model_toggle_sleep(profile, &saved.model, clock_now());
    cared_since_load |= 8u;
    save();
}
void pet_behavior_bind_child(const char *child_id)
{
    if (!child_id || strlen(child_id) != 36 || !strcmp(saved.child_id, child_id)) return;
    if (saved.child_id[0]) {
        // A reassigned device starts the new child's pet with a healthy baseline.
        memset(&saved.model, 0, sizeof(saved.model));
        restore_utc = 0;
        cared_since_load = 0;
    }
    snprintf(saved.child_id, sizeof(saved.child_id), "%s", child_id);
    save();
}
