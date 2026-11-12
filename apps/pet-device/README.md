# 桌面宠物设备原型

适配微雪 ESP32-S3-Touch-LCD-2.8 V2。启动后有 30 枚模拟金币，点击 Feed 消耗 10 枚并依次播放吃饭、开心和待机；Sleep/Wake up 切换睡觉和待机；余额不足时提示。重启后数据重置，尚未接入联网或家长端。设备版本暂用英文，因为 LVGL 默认字体不包含中文字形。

## 电脑预览

用 VS Code 打开 `preview/index.html`，右键选择在浏览器打开（或用 Live Server 插件打开）。预览是独立的 HTML/CSS/JS，模拟同样的交互，**不是运行实际 LVGL 固件**；仅用于快速验证页面与规则，不能替代真机上的触摸、颜色、性能和连接测试。改固件不会自动同步预览。

## 编译

```bash
. ~/esp/esp-idf/export.sh
cd /Users/liuzhe.x/coding/study-pet/apps/pet-device
idf.py set-target esp32s3
idf.py build
```

首次构建需联网下载 LVGL。不要对已有工作工程随意重复 `set-target`，因为它会重建配置；新工程第一次运行即可。

## 烧录

确认允许覆盖设备当前演示程序后，连接数据线并确认实际串口，例如：

```bash
idf.py -p /dev/cu.usbmodem1101 flash monitor
```

退出日志按 Ctrl+]。串口可能改变；设备显示和触摸需在真实硬件上验证。微雪下载包 `Firmware` 有测试固件，但不保证与出厂固件完全相同，恢复操作参照厂商文档。

## 第三方来源

`main/LCD_Driver`、`Touch_Driver`、`LVGL_Driver` 和 `I2C_Driver` 来自微雪 ESP32-S3-Touch-LCD-2.8 V2 示例；移植及分发前应核实这些代码的许可。LVGL 由 ESP-IDF 组件管理器获取，遵循其许可证。

## 图片素材

用户提供的透明 PNG 经 `tools/prepare_frames.py` 裁剪、缩放并合成背景，输出到 `preview/frames`；同一脚本生成 LVGL 所需的 RGB565 数据 `main/husky_frames.c`。重新生成需安装 Pillow，并传入原始帧目录。由于预览和固件分别实现，修改交互时需同步检查。
