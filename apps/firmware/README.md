# ESP32-S3 桌面宠物固件工程 (Firmware)

本目录为“学习任务养成宠物”桌面硬件固件代码，基于**微雪 ESP32-S3-Touch-LCD-2.8** 开发板与 **ESP-IDF v5.4.x / FreeRTOS / LVGL**。

## 目录规划

```text
apps/firmware/
├── hello_world/       # [已验证] 乐鑫官方 Hello World 原型例程 (验证编译与串口)
├── study_pet_firmware/ # [核心开发] 桌面宠物正式固件工程 (待接入微雪屏幕/触摸/UI驱动)
│   ├── CMakeLists.txt
│   ├── partitions.csv # 存储分区 (NVS 凭据、LittleFS 离线队列、OTA)
│   ├── sdkconfig.defaults
│   ├── main/          # 主程序业务代码
│   │   ├── app_main.c
│   │   ├── ui/        # LVGL 界面 (宠物、今日任务大按钮、商店、6位配对码设置)
│   │   ├── net/       # 2.4GHz Wi-Fi、HTTPS REST API 同步
│   │   └── storage/   # NVS 密钥、断网离线任务提交持久化队列
│   └── components/    # 板载外设驱动 (ST7789 显示驱动、CST328/3530 触摸驱动、音频)
└── README.md
```

## 开发与编译指令

需要先在终端加载乐鑫编译环境：

```bash
. ~/esp/esp-idf/export.sh

# 编译验证
cd apps/firmware/hello_world
idf.py set-target esp32s3
idf.py build

# 烧录并打开串口监视器 (请替换实际端口)
idf.py -p /dev/cu.usbmodem* flash monitor
```
