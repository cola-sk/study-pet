#define SNTP_OPMODE_POLL 0
static inline void esp_sntp_setoperatingmode(int mode) {(void)mode;}
static inline void esp_sntp_setservername(int index,const char *name) {(void)index;(void)name;}
static inline void esp_sntp_init(void) {}
