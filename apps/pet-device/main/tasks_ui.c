#include "tasks_ui.h"
#include <stdio.h>
#include <string.h>
LV_FONT_DECLARE(shop_cjk_font);
static lv_obj_t *host, *root, *home, *home_caption, *content;
static task_page_t snapshot;
static char selected_id[37], feedback[100];
static bool waiting_page;
static void render(void);
static const char *state_text(task_status_t s) {
    const char *names[]={"To do","Waiting for parent","Completed","Try again"};return names[s];
}
static lv_obj_t *text(lv_obj_t *parent,const char *value,int width) {
    // The bundled CJK font omits common full-width punctuation. Replace it
    // with readable ASCII equivalents without changing the stored task text.
    static const struct { const char *from, *to; } punctuation[] = {
        {"，", ","}, {"。", "."}, {"！", "!"}, {"？", "?"}, {"：", ":"},
        {"；", ";"}, {"、", ","}, {"（", "("}, {"）", ")"}, {"“", "\""}, {"”", "\""},
        {"‘", "'"}, {"’", "'"}, {"【", "["}, {"】", "]"}, {"～", "~"}, {"　", " "}
    };
    char normalized[TASK_DESCRIPTION_BYTES];size_t n=0;
    while(*value && n<sizeof(normalized)-1) {
        bool mapped=false;
        for(unsigned i=0;i<sizeof(punctuation)/sizeof(punctuation[0]);i++) {
            size_t len=strlen(punctuation[i].from);
            if(!strncmp(value,punctuation[i].from,len)) {normalized[n++]=punctuation[i].to[0];value+=len;mapped=true;break;}
        }
        if(!mapped) normalized[n++]=*value++;
    }
    normalized[n]=0;
    lv_obj_t *label=lv_label_create(parent);lv_label_set_text(label,normalized);lv_obj_set_width(label,width);
    lv_obj_set_style_text_font(label,&shop_cjk_font,0);lv_obj_set_style_text_color(label,lv_color_hex(0x433c32),0);
    return label;
}
static lv_obj_t *button(lv_obj_t *parent,const char *value,int x,int y,int w,int h,lv_event_cb_t cb,void *data) {
    lv_obj_t *b=lv_btn_create(parent);lv_obj_set_pos(b,x,y);lv_obj_set_size(b,w,h);
    lv_obj_set_style_pad_all(b,6,0);lv_obj_set_style_radius(b,12,0);lv_obj_set_style_shadow_width(b,0,0);
    lv_obj_set_style_bg_color(b,lv_color_hex(0x728e62),0);
    lv_obj_t *caption=text(b,value,w-12);lv_obj_set_style_text_color(caption,lv_color_white(),0);lv_obj_set_style_text_align(caption,LV_TEXT_ALIGN_CENTER,0);lv_obj_center(caption);
    lv_obj_add_event_cb(b,cb,LV_EVENT_CLICKED,data);return b;
}
static void back(lv_event_t *e) {
    (void)e;
    if(selected_id[0]) {selected_id[0]=0;feedback[0]=0;render();}
    else {lv_obj_del(root);root=NULL;content=NULL;}
}
static void refresh(lv_event_t *e) {
    (void)e;waiting_page=true;feedback[0]=0;task_refresh(snapshot.offset);render();
}
static void page_change(lv_event_t *e) {
    int delta=(int)(intptr_t)lv_event_get_user_data(e);
    unsigned offset=delta<0?(snapshot.offset>=TASK_PAGE_SIZE?snapshot.offset-TASK_PAGE_SIZE:0):snapshot.offset+TASK_PAGE_SIZE;
    waiting_page=true;feedback[0]=0;task_refresh(offset);render();
}
static void choose(lv_event_t *e) {
    unsigned index=(unsigned)(uintptr_t)lv_event_get_user_data(e);
    if(index>=snapshot.count)return;
    snprintf(selected_id,sizeof(selected_id),"%s",snapshot.items[index].id);feedback[0]=0;render();
}
static void complete(lv_event_t *e) {
    (void)e;
    if(task_checkin_pending()) {snprintf(feedback,sizeof(feedback),"Confirming previous check-in...");}
    else if(task_request_checkin(selected_id))snprintf(feedback,sizeof(feedback),"Submitting. Waiting for sync...");
    else snprintf(feedback,sizeof(feedback),"Cannot save. Please try again.");
    render();
}
static const pet_task_t *selected(void) {
    for(unsigned i=0;i<snapshot.count;i++)if(!strcmp(selected_id,snapshot.items[i].id))return &snapshot.items[i];
    return NULL;
}
static void render(void) {
    if(!root)return;
    lv_obj_clean(root);content=NULL;
    button(root,LV_SYMBOL_LEFT,6,5,36,32,back,NULL);
    lv_obj_t *heading=text(root,selected_id[0]?"Task details":"Today tasks",135);lv_obj_set_pos(heading,50,13);
    button(root,LV_SYMBOL_REFRESH,198,5,36,32,refresh,NULL);
    const char *error=snapshot.state==TASKS_OFFLINE?"Offline / waiting for Wi-Fi":snapshot.state==TASKS_DENIED?"Select child / pair in Settings":snapshot.state==TASKS_FAILED?"Tasks unavailable. Tap refresh.":"Loading tasks...";
    char summary[80];snprintf(summary,sizeof(summary),"%s    %u/%u done",snapshot.date,snapshot.completed,snapshot.total);
    lv_obj_t *subtitle=text(root,waiting_page?"Loading tasks...":snapshot.state==TASKS_READY?summary:error,224);lv_obj_set_pos(subtitle,8,43);
    if(snapshot.state!=TASKS_READY || waiting_page) {
        if(task_checkin_pending()) {lv_obj_t *m=text(root,"Check-in saved. It will retry\nafter the connection returns.",220);lv_obj_set_pos(m,10,116);}
        return;
    }
    if(selected_id[0]) {
        const pet_task_t *t=selected();
        if(!t) {lv_obj_t *m=text(root,"This task is no longer in today's list. Go back to refresh.",216);lv_obj_set_pos(m,12,95);return;}
        content=lv_obj_create(root);lv_obj_set_pos(content,6,66);lv_obj_set_size(content,228,190);
        lv_obj_set_style_pad_all(content,8,0);lv_obj_set_style_border_width(content,0,0);
        lv_obj_set_flex_flow(content,LV_FLEX_FLOW_COLUMN);lv_obj_set_style_pad_row(content,10,0);
        text(content,t->title,210);
        char reward[80];snprintf(reward,sizeof(reward),"+%u credits / %s",t->reward,t->parent_confirm?"Parent confirms":"Instant reward");text(content,reward,210);
        if(t->description[0])text(content,t->description,210);
        text(content,state_text(t->status),210);
        if(t->status==TASK_REJECTED && t->reason[0])text(content,t->reason,210);
        if(feedback[0])text(content,feedback,210);
        const char *caption=t->status==TASK_COMPLETED?"Completed":t->status==TASK_SUBMITTED?"Waiting for parent":task_checkin_pending()?"Confirming check-in...":t->status==TASK_REJECTED?"Try again / Complete":"Complete task";
        lv_obj_t *submit=button(root,caption,10,270,220,40,complete,NULL);
        if(t->status==TASK_COMPLETED || t->status==TASK_SUBMITTED || task_checkin_pending())lv_obj_add_state(submit,LV_STATE_DISABLED);
    } else {
        content=lv_obj_create(root);lv_obj_set_pos(content,6,66);lv_obj_set_size(content,228,199);
        lv_obj_set_style_pad_all(content,0,0);lv_obj_set_style_border_width(content,0,0);
        if(!snapshot.count) {lv_obj_t *empty=text(content,"No tasks today.\nAsk your parent to add one.",210);lv_obj_set_pos(empty,8,30);}
        for(unsigned i=0;i<snapshot.count;i++) {
            const pet_task_t *t=&snapshot.items[i];
            lv_obj_t *row=button(content,"",0,i*66,224,60,choose,(void *)(uintptr_t)i);
            lv_obj_set_style_bg_color(row,lv_color_hex(t->status==TASK_COMPLETED?0xe4efdd:0xf5ead8),0);
            lv_obj_t *title=text(row,t->title,208);lv_label_set_long_mode(title,LV_LABEL_LONG_DOT);lv_obj_set_height(title,18);lv_obj_set_pos(title,0,0);
            char info[80];snprintf(info,sizeof(info),"+%u cr  %s",t->reward,state_text(t->status));
            lv_obj_t *status=text(row,info,208);lv_obj_set_pos(status,0,24);
        }
        char page[32];snprintf(page,sizeof(page),"%u / %u",snapshot.offset/TASK_PAGE_SIZE+1,snapshot.total?(snapshot.total+TASK_PAGE_SIZE-1)/TASK_PAGE_SIZE:1);
        lv_obj_t *previous=button(root,LV_SYMBOL_LEFT,10,274,55,36,page_change,(void *)(intptr_t)-1);
        lv_obj_t *next=button(root,LV_SYMBOL_RIGHT,175,274,55,36,page_change,(void *)(intptr_t)1);
        lv_obj_t *caption=text(root,page,100);lv_obj_set_style_text_align(caption,LV_TEXT_ALIGN_CENTER,0);lv_obj_set_pos(caption,70,285);
        if(!snapshot.offset)lv_obj_add_state(previous,LV_STATE_DISABLED);
        if(snapshot.offset+snapshot.count>=snapshot.total)lv_obj_add_state(next,LV_STATE_DISABLED);
    }
}
static void open_event(lv_event_t *e) {(void)e;tasks_ui_open();}
void tasks_ui_init(lv_obj_t *parent) {
    host=parent;snapshot.state=TASKS_LOADING;
    home=button(host,"Today tasks",30,264,180,34,open_event,NULL);home_caption=lv_obj_get_child(home,0);
}
void tasks_ui_open(void) {
    if(root)return;
    root=lv_obj_create(host);lv_obj_set_pos(root,0,0);lv_obj_set_size(root,240,320);lv_obj_set_style_pad_all(root,0,0);
    lv_obj_set_style_border_width(root,0,0);lv_obj_set_style_bg_color(root,lv_color_hex(0xfff7e7),0);lv_obj_clear_flag(root,LV_OBJ_FLAG_SCROLLABLE);
    selected_id[0]=0;feedback[0]=0;waiting_page=true;task_refresh(snapshot.offset);render();
}
bool tasks_ui_is_open(void) {return root!=NULL;}
void tasks_ui_home_visible(bool visible) {if(home){if(visible)lv_obj_clear_flag(home,LV_OBJ_FLAG_HIDDEN);else lv_obj_add_flag(home,LV_OBJ_FLAG_HIDDEN);}}
void tasks_ui_page(const task_page_t *page) {
    lv_coord_t y=content?lv_obj_get_scroll_y(content):0;
    bool same=page->offset==snapshot.offset && !strcmp(page->child_id,snapshot.child_id) && !strcmp(page->date,snapshot.date);
    const pet_task_t *before=selected();
    task_status_t old_status=before?before->status:TASK_PENDING;
    snapshot=*page;waiting_page=false;
    const pet_task_t *after=selected();
    if(before && after && old_status!=after->status) feedback[0]=0;
    if(!same){selected_id[0]=0;feedback[0]=0;}
    if(snapshot.state==TASKS_READY)lv_label_set_text_fmt(home_caption,"Today %u/%u",snapshot.completed,snapshot.total);
    else lv_label_set_text(home_caption,"Today tasks");
    render();if(content && same)lv_obj_scroll_to_y(content,y,LV_ANIM_OFF);
}
void tasks_ui_result(const checkin_result_t *r) {
    bool same=!strcmp(selected_id,r->task_id);
    if(r->state==CHECKIN_OK) {
        for(unsigned i=0;i<snapshot.count;i++)if(!strcmp(snapshot.items[i].id,r->task_id))snapshot.items[i].status=r->status;
        if(same)snprintf(feedback,sizeof(feedback),"%s",r->status==TASK_COMPLETED?"Great job! Credits updated.":r->status==TASK_SUBMITTED?"Sent! Waiting for your parent.":"Parent suggests another try.");
    } else if(same) {
        const char *errors[]={"","Saved. Waiting for network...","Save failed. Please retry.","Check pairing in Settings.","This task belongs to another day.","Task unavailable. Refresh list.","Check-in needs review."};
        snprintf(feedback,sizeof(feedback),"%s",errors[r->state]);
    }
    render();
}
