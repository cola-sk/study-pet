#include "lvgl.h"
#include "husky_frames.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define ACTION(a) &husky_##a##_01,&husky_##a##_02,&husky_##a##_03,&husky_##a##_04
static const lv_img_dsc_t *frames[] = {ACTION(idle),ACTION(eat),ACTION(happy),ACTION(sleep),ACTION(hungry),ACTION(thirsty),ACTION(drink),ACTION(sleepy),ACTION(lonely),ACTION(pet)};
static lv_color_t pixels[240*320];
static void flush(lv_disp_drv_t *driver,const lv_area_t *area,lv_color_t *data) { (void)area;(void)data;lv_disp_flush_ready(driver); }
int main(int argc,char **argv) {
    if(argc!=2) return 2;
    lv_init();
    lv_disp_draw_buf_t buffer;lv_disp_draw_buf_init(&buffer,pixels,NULL,240*320);
    lv_disp_drv_t driver;lv_disp_drv_init(&driver);driver.hor_res=240;driver.ver_res=320;driver.draw_buf=&buffer;driver.flush_cb=flush;driver.full_refresh=1;lv_disp_drv_register(&driver);
    lv_obj_t *screen=lv_scr_act();lv_obj_set_style_bg_color(screen,lv_color_hex(0xfff7e7),0);
    lv_obj_t *image=lv_img_create(screen);lv_obj_set_pos(image,50,102);
    for(unsigned i=0;i<40;i++) {
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
    printf("All 40 PNG frames decoded and rendered through LVGL; 739200 RGB565 pixels matched.\n");return 0;
}
