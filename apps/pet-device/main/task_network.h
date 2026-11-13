#pragma once
#include <stdbool.h>
#define TASK_PAGE_SIZE 10
#define TASK_TITLE_BYTES 161
#define TASK_DESCRIPTION_BYTES 801
#define TASK_REASON_BYTES 481
typedef enum { TASK_PENDING, TASK_SUBMITTED, TASK_COMPLETED, TASK_REJECTED } task_status_t;
typedef struct {
    char id[37], title[TASK_TITLE_BYTES], description[TASK_DESCRIPTION_BYTES], reason[TASK_REASON_BYTES];
    unsigned reward; task_status_t status; bool parent_confirm;
} pet_task_t;
typedef enum { TASKS_READY, TASKS_LOADING, TASKS_OFFLINE, TASKS_DENIED, TASKS_FAILED } task_page_state_t;
typedef struct {
    task_page_state_t state; char date[11], child_id[37];
    unsigned offset, count, total, completed; bool approved;
    pet_task_t items[TASK_PAGE_SIZE];
} task_page_t;
typedef enum { CHECKIN_OK, CHECKIN_UNKNOWN, CHECKIN_SAVE_FAILED, CHECKIN_DENIED, CHECKIN_EXPIRED, CHECKIN_UNAVAILABLE, CHECKIN_CONFLICT } checkin_state_t;
typedef struct { checkin_state_t state; char task_id[37]; task_status_t status; unsigned credits; bool awarded; } checkin_result_t;
void task_network_init(void);
void task_network_tick(const char *token, bool online, bool clock_ready);
void task_refresh(unsigned offset);
bool task_take_page(task_page_t *page);
bool task_request_checkin(const char *id);
bool task_checkin_pending(void);
bool task_take_checkin(checkin_result_t *result);
