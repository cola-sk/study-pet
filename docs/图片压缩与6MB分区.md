# 图片压缩与 6MB 分区

## 已应用的结果

适用硬件：微雪 ESP32-S3-Touch-LCD-2.8 V2。已读取实物 Flash 信息，确认有 16MiB Flash；启动日志确认有 8MiB PSRAM。

| 项目 | 优化前 | 优化后 |
| --- | ---: | ---: |
| 40 张预览 PNG | 939,208 字节 | 391,617 字节（减少 58.3%） |
| 固件内的动画数据 | RGB565，1,478,400 字节 | PNG，391,617 字节（减少 73.5%） |
| 固件二进制（压缩与分区调整时） | 约 2.94MiB | 2,009,936 字节，约 1.92MiB |
| 应用分区 | 3MiB | 6MiB，剩余约 68% |

40 张图片已实际调用 TinyPNG API，全部变小，尺寸仍为 140×132。代表动作的压缩前后拼图已目视对比，无明显差异；TinyPNG 属于有损优化，不代表原图与压缩图逐像素相同。

## 不变大规则

`apps/pet-device/tools/compress_tinypng.py` 仅在服务返回的 PNG **严格小于原始文件**时替换。更大或一样大则保持原图的完整字节与格式。成功处理的文件按 SHA256 缓存，重复运行会跳过，已验证再次运行的 API 调用次数为 0。

`tools/embed_frames.py` 在嵌入固件时另做一次比较：PNG 小于 RGB565 原始像素数据时使用 PNG，否则使用原有 RGB565。两次比较分别控制图片文件与固件资源的大小；只压缩 PNG、仍嵌入 RGB565，不能降低固件占用。

`assets/tinypng-manifest.json` 记录各帧的前后大小与哈希；`assets/frame-storage.json` 记录固件所选格式。清单不包含密钥或下载地址。

## 本机使用

在仓库根目录执行。Python 需要 Pillow；重新裁剪还需要 numpy、opencv-python。ESP-IDF 编译环境继续使用现有安装。

密钥保存在 `.env.tinypng.local` 的 `TINYPNG_API_KEY=` 后面，或通过同名环境变量提供。该文件及编辑器交换文件均已被 Git 忽略；不要把密钥提交到仓库。脚本不会输出密钥。

已有 `preview/frames` 时，直接压缩、嵌入和编译：

```bash
python3 apps/pet-device/tools/compress_tinypng.py
python3 apps/pet-device/tools/embed_frames.py --report apps/pet-device/assets/frame-storage.json
. ~/esp/esp-idf/export.sh
idf.py -C apps/pet-device build
```

如果修改了原始素材，先运行以下命令，再执行上面的三步：

```bash
python3 apps/pet-device/tools/prepare_frames.py /Users/liuzhe.x/Downloads/husky_animation_frames
```

该脚本沿用原有裁剪与去杂帧逻辑，新状态和 sleep 素材取自 `tools/source`，其他素材取自参数目录，合成当前页面背景后输出。重新裁剪会重建预览图，因此压缩应放在裁剪之后。

原图和压缩缓存保存于 `apps/pet-device/backups/tinypng-originals.local/`，该目录被 Git 忽略。固件启用了 LVGL PNG 解码、2 帧图片缓存和自定义 malloc 分配器，并允许使用 PSRAM，避免原来的固定 64KB LVGL 内存池不足。

## 分区与已连接设备迁移

当前 `apps/pet-device/partitions.csv`：

| 分区 | 起始地址 | 大小 |
| --- | --- | --- |
| nvs | 0x9000 | 24KiB |
| factory | 0x10000 | 6MiB |
| flash_test | 0x610000 | 528KiB |

已连接设备的旧 `flash_test` 位于 0x310000，扩大应用分区后与应用地址范围重叠，因此已先读取备份，再搬到 0x610000。烧录后读回，新位置内容与原数据逐字节一致。NVS 地址不变，配对信息及其他原记录保持不变；备份之间只有 Wi-Fi 驱动追加了 `sta.pwr_reset` 重启标记。

本机恢复备份位于 `apps/pet-device/backups/expand-6mb.local/`，包含旧应用、旧分区表、NVS、旧数据分区及校验清单。**备份包含设备凭据，应只保存在本地，不能提交或分享。**

其他旧设备首次升级也需要先读取实际旧分区表，备份 NVS 和数据分区，确认 Flash 容量，再烧录新布局并迁移数据。不要执行 `erase_flash`。当前设备已完成迁移，以后相同布局的版本可以正常使用 `idf.py flash`。

回滚时需要恢复备份的旧应用、旧分区表和旧地址的数据分区，且保持匹配；仅还原 CSV 或单独刷旧应用不等于完成回滚。

## 验证

离线回归，不读取真实密钥、不调用 TinyPNG：

```bash
python3 apps/pet-device/tools/test_image_pipeline.py
```

已通过更大保留、等大保留、更小替换、缓存跳过，以及 PNG / RGB565 自动选择测试。

使用项目同版本 LVGL 8.3 实际解码并软件渲染：

```bash
python3 apps/pet-device/tools/png_check/expected.py /tmp/study-pet-png-check/expected
cmake -S apps/pet-device/tools/png_check -B /tmp/study-pet-png-check/build
cmake --build /tmp/study-pet-png-check/build --target check_pet_png -j 8
/tmp/study-pet-png-check/build/check_pet_png /tmp/study-pet-png-check/expected
```

需要 CMake、本机 C 编译器及 ESP-IDF 已下载的 `managed_components/lvgl__lvgl`。40 帧共 739,200 个 RGB565 像素与压缩 PNG 的参考解码结果匹配。测试使用部分区域刷新，并逐帧打开/关闭菜单，共 160 次缩放与强制整屏重绘结果一致，验证没有旧图残影。设备重启后观察 25 秒，显示驱动与 PSRAM 初始化成功，Wi-Fi 连接成功，未观察到崩溃、PNG 解码或内存分配错误。实机触摸、动画流畅度仍以设备实际观察为准。
