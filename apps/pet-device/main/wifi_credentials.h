#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

typedef struct { uint32_t version; char ssid[33], password[65]; } pet_wifi_credentials_t;

static inline bool pet_wifi_credentials_valid(const char *ssid, const char *password)
{
    size_t name_len = strlen(ssid), password_len = strlen(password);
    if (!name_len || name_len > 32) return false;
    if (password_len == 0 || (password_len >= 8 && password_len <= 63)) return true;
    if (password_len != 64) return false;
    for (size_t i = 0; i < password_len; i++) {
        char c = password[i];
        if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))) return false;
    }
    return true;
}
