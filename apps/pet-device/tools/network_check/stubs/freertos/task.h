#define pdMS_TO_TICKS(x) (x)
static inline int xTaskCreate(void (*fn)(void *),const char *name,int stack,void *arg,int priority,void *handle) {(void)fn;(void)name;(void)stack;(void)arg;(void)priority;(void)handle;return 1;}
