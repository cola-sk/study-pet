#pragma once
#include <stdbool.h>
#include <stdint.h>

#define PET_WIFI_SCAN_LIMIT 12
typedef enum { PET_WIFI_UNCONFIGURED, PET_WIFI_CONNECTING, PET_WIFI_CONNECTED, PET_WIFI_OFFLINE, PET_WIFI_UNAVAILABLE } pet_wifi_state_t;
typedef enum { PET_WIFI_ATTEMPT_NONE, PET_WIFI_ATTEMPT_CONNECTING, PET_WIFI_ATTEMPT_SAVED, PET_WIFI_ATTEMPT_FAILED, PET_WIFI_ATTEMPT_SAVE_FAILED, PET_WIFI_ATTEMPT_CANCELLED } pet_wifi_attempt_t;
typedef struct { char ssid[33]; int8_t rssi; bool secured, supported; } pet_wifi_ap_t;
typedef struct {
    pet_wifi_state_t state;
    pet_wifi_attempt_t attempt;
    bool configured, scanning, scan_failed;
    uint32_t attempt_id;
    char ssid[33];
    unsigned count;
    pet_wifi_ap_t networks[PET_WIFI_SCAN_LIMIT];
} pet_wifi_snapshot_t;

bool wifi_manager_start(void);
void wifi_manager_snapshot(pet_wifi_snapshot_t *out);
bool wifi_manager_online(void);
bool wifi_manager_scan(void);
bool wifi_manager_connect(const char *ssid, const char *password);
void wifi_manager_cancel(void);
