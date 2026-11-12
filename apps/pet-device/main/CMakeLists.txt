idf_component_register(
  SRCS "main.c" "network.c" "husky_frames.c" "LCD_Driver/Vernon_ST7789T/Vernon_ST7789T.c" "LCD_Driver/ST7789.c"
       "Touch_Driver/esp_lcd_touch/esp_lcd_touch.c" "Touch_Driver/CST328.c" "Touch_Driver/CST3530.c"
       "LVGL_Driver/LVGL_Driver.c" "I2C_Driver/I2C_Driver.c"
  INCLUDE_DIRS "." "LCD_Driver" "LCD_Driver/Vernon_ST7789T" "Touch_Driver" "Touch_Driver/esp_lcd_touch" "LVGL_Driver" "I2C_Driver"
  REQUIRES esp_lcd driver esp_timer esp_wifi esp_event esp_netif nvs_flash esp_http_client mbedtls json
)
