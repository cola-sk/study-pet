#include "lvgl.h"
#include "husky_frames.h"
#include "action_layout.h"
#include "pet_image_view.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define ACTION(a) &husky_##a##_01,&husky_##a##_02,&husky_##a##_03,&husky_##a##_04
static const lv_img_dsc_t *frames[] = {ACTION(idle),ACTION(eat),ACTION(happy),ACTION(sleep),ACTION(hungry),ACTION(thirsty),ACTION(drink),ACTION(sleepy),ACTION(lonely),ACTION(pet),ACTION(play),ACTION(bath),ACTION(treat),ACTION(dress),ACTION(achievement),ACTION(stretch)};
static lv_color_t pixels[240*320];
static lv_color_t draw_pixels[240*20], previous[240*320];
static void flush(lv_disp_drv_t *driver,const lv_area_t *area,lv_color_t *data) {
    unsigned width=lv_area_get_width(area);
    for(int y=area->y1;y<=area->y2;y++) {
        memcpy(pixels+y*240+area->x1,data+(y-area->y1)*width,width*sizeof(*data));
    }
    lv_disp_flush_ready(driver);
}
int main(int argc,char **argv) {
    if(argc!=2) return 2;
    lv_init();
    int cookie_width = lv_txt_get_width("Cookie", 6, LV_FONT_DEFAULT, 0, LV_TEXT_FLAG_NONE);
    for(unsigned count=2;count<=12;count++) {
        for(unsigned i=0;i<count;i++) {
            action_bounds_t a=action_bounds(count,i);
            if(a.x<4 || a.y<44 || a.x+a.width>236 || a.y+a.height>304 || a.width-8<cookie_width) {
                fprintf(stderr,"Action bounds/text failure: count %u index %u\n",count,i);return 1;
            }
            for(unsigned j=0;j<i;j++) {
                action_bounds_t b=action_bounds(count,j);
                if(a.x<b.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y) {
                    fprintf(stderr,"Actions overlap: count %u indices %u,%u\n",count,i,j);return 1;
                }
            }
        }
    }
    printf("Action layouts 2–12: within screen, no overlapping buttons; Cookie fits all profiles.\n");
    lv_disp_draw_buf_t buffer;lv_disp_draw_buf_init(&buffer,draw_pixels,NULL,240*20);
    lv_disp_drv_t driver;lv_disp_drv_init(&driver);driver.hor_res=240;driver.ver_res=320;driver.draw_buf=&buffer;driver.flush_cb=flush;lv_disp_drv_register(&driver);
    lv_obj_t *screen=lv_scr_act();lv_obj_set_style_bg_color(screen,lv_color_hex(0xfff7e7),0);
    lv_obj_t *image=lv_img_create(screen);lv_obj_set_pos(image,50,102);
    for(unsigned i=0;i<sizeof(frames)/sizeof(frames[0]);i++) {
        lv_img_decoder_dsc_t decoded;
        if(lv_img_decoder_open(&decoded,frames[i],lv_color_black(),0)!=LV_RES_OK || !decoded.img_data) { fprintf(stderr,"Frame %u cannot be decoded\n",i);return 1; }
        lv_img_decoder_close(&decoded);
        lv_img_set_src(image,frames[i]);lv_refr_now(NULL);
        char path[1024];snprintf(path,sizeof(path),"%s/%02u.rgb565",argv[1],i);
        FILE *file=fopen(path,"rb");if(!file) return 2;
        for(unsigned y=0;y<132;y++) for(unsigned x=0;x<140;x++) {
            int low=fgetc(file),high=fgetc(file);
            unsigned expected=(unsigned)low|((unsigned)high<<8);
            if(low<0 || high<0 || pixels[(y+102)*240+x+50].full!=expected) {
                fprintf(stderr,"Frame %u pixel %u,%u mismatch (%04x != %04x)\n",i,x,y,pixels[(y+102)*240+x+50].full,expected);fclose(file);return 1;
            }
        }
        fclose(file);
    }
    printf("All 64 frames decoded and rendered through LVGL; 1182720 RGB565 pixels matched.\n");
    for(unsigned i=0;i<sizeof(frames)/sizeof(frames[0]);i++) {
        lv_img_set_src(image,frames[i]);lv_refr_now(NULL);
        for(unsigned toggle=0;toggle<4;toggle++) {
            pet_image_set_menu_open(image,toggle%2==0);
            lv_refr_now(NULL);memcpy(previous,pixels,sizeof(pixels));
            lv_obj_invalidate(screen);lv_refr_now(NULL);
            unsigned mismatches=0;
            for(unsigned pixel=0;pixel<240*320;pixel++) if(previous[pixel].full!=pixels[pixel].full) mismatches++;
            if(mismatches) {
                fprintf(stderr,"Menu zoom left stale pixels: frame %u toggle %u, %u pixels\n",i,toggle,mismatches);return 1;
            }
        }
    }
    printf("256 menu zoom transitions match full-screen redraw; no stale pet pixels.\n");return 0;
}
