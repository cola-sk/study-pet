# 桌面宠物设备原型

适配微雪 ESP32-S3-Touch-LCD-2.8 V2（16MB Flash、8MB PSRAM）。设备通过真实 API 获取余额和家庭商品目录，使用家长配对码绑定家庭，再由家长选择孩子。点击小狗展开一级放射菜单：Water、Food 及家庭自定义商品，加上免费的 Sleep、Pet。商品支持中文名称，购买由服务端确认扣币后播放对应动作。

余额每 5 秒同步，商品每 10 秒同步。点击首页右上角的余额/齿轮进入 Settings，使用 `Sync now` 手动同步，或扫描、输入并保存新的 Wi-Fi。设备身份、Wi-Fi 和待确认购买保存在 NVS，重启后继续使用。设置操作见 [设备设置与WiFi](../../docs/设备设置与WiFi.md)，业务规则与接口见 [设备商店与互动方案](../../docs/设备商店与互动方案.md)。

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

连接数据线并确认实际串口。在设备已经使用当前 6MB 分区布局后，例如：

```bash
idf.py -p /dev/cu.usbmodem1101 flash monitor
```

退出日志按 Ctrl+]。串口可能改变；设备显示和触摸需在真实硬件上验证。**旧 3MB 分区设备第一次升级需要先备份并迁移数据分区**，见 [图片压缩与6MB分区](../../docs/图片压缩与6MB分区.md)，不能直接套用普通烧录命令。微雪下载包 `Firmware` 有测试固件，但不保证与出厂固件完全相同。

## 第三方来源

`main/LCD_Driver`、`Touch_Driver`、`LVGL_Driver` 和 `I2C_Driver` 来自微雪 ESP32-S3-Touch-LCD-2.8 V2 示例；移植及分发前应核实这些代码的许可。LVGL 由 ESP-IDF 组件管理器获取，遵循其许可证。

## 图片素材

用户提供的透明 PNG 经 `tools/prepare_frames.py` 裁剪、缩放并合成背景，输出 40 张 `140×132` PNG 到 `preview/frames`。TinyPNG API 压缩后，只有结果严格更小时才替换，否则保留原始文件和格式。原图和缓存保存在 Git 忽略的本地备份目录。

`tools/embed_frames.py` 生成 `main/husky_frames.c`，逐帧比较 PNG 与 RGB565，选择较小者。固件已启用 LVGL PNG 解码与 PSRAM 内存分配。当前 40 帧均使用 PNG，合计约 392KB；相比原始 RGB565 资源减少 73.5%。完整流程、密钥配置与验证命令见 [图片压缩与6MB分区](../../docs/图片压缩与6MB分区.md)。由于预览和固件分别实现，修改交互时需同步检查。

## 需求状态演示

设备和网页每约 30 秒展示“有点饿、有点渴、想休息、想陪伴”等需求动作，供验证状态，不是真实生理数值。需求状态只循环对应表情，不会自动变开心；成功喂食、喝水或陪伴后才播放开心。睡觉保持安静的动作，Sleep/Wake 切换睡觉和待机。需求不会引发惩罚或自动扣币。

新增素材由用户提供的 1536×1024 透明图通过 `tools/extract_sheet.py` 分帧；`prepare_frames.py` 合并旧素材与拆分结果后生成预览和固件资源。画面第一组包含水碗，现阶段借作饿了的演示，后续可替换为食盆素材。

## 首页和互动菜单

首页左上显示英文鼓励语，右上显示 credits 和 Settings 入口。付费按钮来自家庭商品目录，最多 10 个（含默认 Water 1 credit、Food 2 credits，家长可调价）；Sleep 和 Pet 免费，不占商品名额。网页预览使用模拟数据，实际设备调用真实 API。
