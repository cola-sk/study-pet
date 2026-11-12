#pragma once
#include <stdbool.h>
void network_start(void);
bool network_take_wallet(unsigned *credits);
bool network_business_enabled(void);
bool network_pair_request(const char *code);
int network_take_pair_result(void);
