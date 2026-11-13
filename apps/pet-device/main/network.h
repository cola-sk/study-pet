#pragma once
#include <stdbool.h>
void network_start(void);
typedef enum { WALLET_READY, WALLET_WAITING_FOR_CHILD, WALLET_UNAUTHORIZED, WALLET_SYNC_FAILED } network_wallet_state_t;
typedef struct { network_wallet_state_t state; unsigned credits; bool manual; } network_wallet_update_t;
bool network_take_wallet(network_wallet_update_t *update);
bool network_refresh_wallet(void);
bool network_business_enabled(void);
bool network_pair_request(const char *code);
int network_take_pair_result(void);
