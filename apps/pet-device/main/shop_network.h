#pragma once
#include <stdbool.h>
#define SHOP_LIMIT 10
typedef enum { SHOP_EAT, SHOP_DRINK, SHOP_PET, SHOP_HAPPY } shop_action_t;
typedef struct { char id[37], name[40], version[40], binding_version[37]; unsigned price; shop_action_t action; } shop_item_t;
typedef struct { bool available; unsigned count; shop_item_t items[SHOP_LIMIT]; } shop_catalog_t;
typedef enum { PURCHASE_OK, PURCHASE_UNKNOWN, PURCHASE_INSUFFICIENT, PURCHASE_CHANGED, PURCHASE_UNAVAILABLE, PURCHASE_DENIED, PURCHASE_SAVE_FAILED, PURCHASE_CONFLICT } purchase_state_t;
typedef struct { purchase_state_t state; unsigned credits; shop_action_t action; } purchase_result_t;
void shop_network_init(void);
void shop_network_tick(const char *token, bool online, bool clock_ready);
bool shop_take_catalog(shop_catalog_t *catalog);
bool shop_take_result(purchase_result_t *result);
bool shop_request_purchase(const shop_item_t *item);
bool shop_purchase_pending(void);
void shop_refresh(void);
