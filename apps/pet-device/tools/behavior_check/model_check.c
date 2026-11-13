#include "pet_model.h"
#include "screen_idle.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <stdint.h>

// 2026-11-13 00:00:00 at UTC+8. Tests never change the computer clock.
static int64_t at(unsigned hour, unsigned minute) { return 1794499200LL + hour * 3600 + minute * 60; }
int main(void)
{
    const pet_profile_t *husky = pet_profile_default();
    assert(husky && !strcmp(husky->id, "husky"));
    assert(!pet_profile_find("missing"));
    pet_model_t pet = {0};
    assert(pet_model_mood(husky, &pet, at(9, 0)) == PET_IDLE);
    // Water has its full cooldown. Looking at the pet does not reset it.
    pet_model_advance(&pet, 7199);
    assert(pet_model_mood(husky, &pet, at(16, 0)) == PET_IDLE);
    pet_model_advance(&pet, 1);
    assert(pet_model_mood(husky, &pet, at(16, 0)) == PET_THIRSTY);
    pet_model_care(husky, &pet, PET_CARE_COMPANY);
    assert(pet_model_mood(husky, &pet, at(16, 0)) == PET_THIRSTY);
    pet_model_care(husky, &pet, PET_CARE_WATER);
    assert(pet_model_mood(husky, &pet, at(16, 0)) == PET_IDLE);
    // Yesterday's dinner lasts until breakfast, but never through a due meal.
    pet = (pet_model_t){.food_age_s = 12 * 3600 + 59 * 60};
    assert(pet_model_mood(husky, &pet, at(7, 29)) == PET_IDLE);
    pet.food_age_s += 60;
    assert(pet_model_mood(husky, &pet, at(7, 30)) == PET_HUNGRY);
    pet_model_care(husky, &pet, PET_CARE_WATER);
    assert(pet_model_mood(husky, &pet, at(7, 30)) == PET_HUNGRY);
    pet_model_care(husky, &pet, PET_CARE_FOOD);
    assert(pet_model_mood(husky, &pet, at(7, 30)) == PET_IDLE);
    // Extra food cannot immediately cause another meal request.
    pet.food_age_s = 5 * 3600 + 59 * 60;
    assert(pet_model_mood(husky, &pet, at(18, 30)) == PET_IDLE);
    pet.food_age_s = 6 * 3600;
    assert(pet_model_mood(husky, &pet, at(18, 30)) == PET_HUNGRY);
    pet = (pet_model_t){.company_age_s = husky->companionship_interval_s};
    assert(pet_model_mood(husky, &pet, at(16, 0)) == PET_LONELY);
    pet_model_care(husky, &pet, PET_CARE_FOOD);
    assert(pet_model_mood(husky, &pet, at(16, 0)) == PET_LONELY);
    pet_model_care(husky, &pet, PET_CARE_COMPANY);
    assert(pet_model_mood(husky, &pet, at(16, 0)) == PET_IDLE);
    // Night sleep crosses midnight; daytime naps also have explicit end times.
    pet = (pet_model_t){0};
    assert(pet_model_mood(husky, &pet, at(21, 50)) == PET_SLEEPY);
    assert(pet_model_mood(husky, &pet, at(22, 0)) == PET_SLEEPING);
    assert(pet_model_mood(husky, &pet, at(0, 0)) == PET_SLEEPING);
    assert(pet_model_mood(husky, &pet, at(6, 59)) == PET_SLEEPING);
    assert(pet_model_mood(husky, &pet, at(7, 0)) == PET_IDLE);
    assert(pet_model_mood(husky, &pet, at(13, 0)) == PET_SLEEPING);
    assert(pet_model_mood(husky, &pet, at(15, 0)) == PET_IDLE);
    pet.water_age_s = PET_MAX_AGE_SECONDS;
    assert(pet_model_mood(husky, &pet, at(23, 0)) == PET_SLEEPING);
    pet_model_toggle_sleep(husky, &pet, at(23, 0));
    assert(pet_model_mood(husky, &pet, at(23, 0)) == PET_THIRSTY);
    pet_model_advance(&pet, husky->wake_grace_s);
    assert(pet_model_mood(husky, &pet, at(23, 30)) == PET_SLEEPING);
    pet = (pet_model_t){0};
    pet_model_toggle_sleep(husky, &pet, at(16, 0));
    assert(pet_model_mood(husky, &pet, at(16, 0)) == PET_SLEEPING);
    pet_model_advance(&pet, husky->manual_nap_s);
    assert(pet_model_mood(husky, &pet, at(16, 45)) != PET_SLEEPING);
    // Without a trustworthy clock we still track elapsed care, but invent no bedtime.
    pet = (pet_model_t){0};
    assert(pet_model_mood(husky, &pet, 0) == PET_IDLE);
    pet_model_advance(&pet, husky->unsynced_hunger_s);
    pet_model_care(husky, &pet, PET_CARE_WATER);
    assert(pet_model_mood(husky, &pet, 0) == PET_HUNGRY);
    pet_model_advance(&pet, UINT64_MAX);
    assert(pet.food_age_s == PET_MAX_AGE_SECONDS && pet.water_age_s == PET_MAX_AGE_SECONDS);
    // Engine supports a different animal's own timing without a new code path.
    pet_profile_t nocturnal = *husky;
    nocturnal.id = "test_nocturnal";
    nocturnal.sleep_window_count = 1;
    nocturnal.sleep_windows[0] = (pet_sleep_window_t){8 * 60, 18 * 60};
    nocturnal.water_interval_s = 4 * 3600;
    pet = (pet_model_t){.water_age_s = 2 * 3600};
    assert(pet_model_mood(&nocturnal, &pet, at(23, 0)) == PET_IDLE);
    assert(pet_model_mood(&nocturnal, &pet, at(9, 0)) == PET_SLEEPING);
    // Whole-day schedule has exactly the configured thirteen sleep hours.
    unsigned sleeping_minutes = 0;
    pet = (pet_model_t){0};
    for (unsigned minute = 0; minute < 1440; minute++) {
        if (pet_model_mood(husky, &pet, at(0, 0) + minute * 60) == PET_SLEEPING) sleeping_minutes++;
    }
    assert(sleeping_minutes == 13 * 60);

    screen_idle_t screen;
    screen_idle_init(&screen, 120, 0);
    screen_idle_tick(&screen, 119999); assert(!screen.asleep);
    screen_idle_tick(&screen, 120000); assert(screen.asleep);
    assert(!screen_idle_touch(&screen, true, 120100) && !screen.asleep);
    assert(!screen_idle_touch(&screen, true, 120200)); // same held finger cannot purchase
    assert(!screen_idle_touch(&screen, false, 120300));
    assert(screen_idle_touch(&screen, true, 120400)); // second tap works normally
    screen_idle_tick(&screen, 300000); assert(!screen.asleep); // held fingers never time out
    screen_idle_touch(&screen, false, 300001);
    screen_idle_timeout(&screen, 0, 300001);
    screen_idle_tick(&screen, UINT64_C(9999999999)); assert(!screen.asleep);
    screen_idle_timeout(&screen, 60, UINT64_C(9999999999));
    screen_idle_tick(&screen, UINT64_C(10000059999)); assert(screen.asleep);
    puts("Pet model passed: independent care, meal cooldowns, sleep/naps, clock fallback, species rules; screen idle/wake touch suppression passed.");
}
