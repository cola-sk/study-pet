# Study Pet：学习任务养成宠物

家长在手机上设置学习或生活任务，孩子在桌面设备上提交完成，获得金币并与宠物互动。产品规划支持一个家庭管理多个孩子和设备，任务可以分配给全家或指定孩子。详细规则见 [产品方案](docs/产品方案.md)。

## 项目当前状态

项目仍处于原型开发阶段，家长端与真实设备之间的完整业务流程尚未打通：

- `apps/parent-h5`：家长端 Web 原型，使用 Next.js、React、TypeScript 和 pnpm；未配置 Supabase 时可使用本地数据体验页面。
- `apps/pet-device`：适配微雪 V2 开发板的宠物固件原型，包含喂食交互和浏览器预览。金币为模拟数据，尚未接入联网或家长端。
- `apps/firmware/hello_world`：乐鑫官方示例，用于检查 ESP32-S3 编译和串口。
- `packages/contracts`：共享类型；`supabase/schema.sql`：数据库设计；`docs`：产品和技术文档。

已确认开发板是 **微雪 ESP32-S3-Touch-LCD-2.8 V2**：2.8 英寸、240 × 320 触摸屏，16 MB Flash、8 MB PSRAM，触摸芯片为 CST3530。Wi-Fi 需要 2.4 GHz 网络；开发板名称没有 B 或 C 后缀。[微雪产品资料](https://docs.waveshare.net/ESP32-S3-Touch-LCD-2.8/) / [V2 示例及资料](https://docs.waveshare.net/ESP32-S3-Touch-LCD-2.8/Resources-And-Documents/)。

## 从零安装开发环境（macOS）

以下以 macOS 和 VS Code 为例。安装需要联网，ESP-IDF 工具链会占用数 GB 空间。

### 1. 安装基础工具和 VS Code 插件

1. 安装 [VS Code](https://code.visualstudio.com/)，通过「文件 → 打开文件夹」打开项目根目录。
2. 在 VS Code 的扩展中安装发布者为 **Espressif Systems** 的 **Espressif IDF**。可选安装 Microsoft 的 **C/C++** 插件用于补全和跳转。插件方便操作编译和烧录，仍需要安装下面的 ESP-IDF 工具链。
3. 打开 VS Code 终端，检查基础工具：

   ```bash
   xcode-select -p
   git --version
   python3 --version
   brew --version
   ```

如果 `xcode-select -p` 报错，运行 `xcode-select --install` 并完成安装。没有 Homebrew 时按 [Homebrew 官方说明](https://brew.sh/)安装。再安装构建常用工具：

```bash
brew install cmake ninja ccache dfu-util
```

### 2. 安装 ESP-IDF

ESP-IDF 提供 ESP32 的开发框架和编译工具；VS Code 是编写代码和调用这些工具的地方。下面安装到 `~/esp/esp-idf`（用户目录下的 `esp/esp-idf`），项目代码仍保存在本仓库。若该目录已有内容，请检查已有版本或选择其他路径，不要覆盖。

项目曾用 ESP-IDF `v5.4.2` 成功编译通用 `hello_world`。设备原型声明支持 IDF `>=5.0,<6.0`，但不能仅凭声明保证所有版本和硬件都已验证。微雪 V2 独立示例请按示例自身要求选择 ESP-IDF 版本。

```bash
mkdir -p ~/esp
git clone -b v5.4.2 --recursive https://github.com/espressif/esp-idf.git ~/esp/esp-idf
cd ~/esp/esp-idf
./install.sh esp32s3
```

每次打开新的终端，运行以下命令加载环境，然后检查版本：

```bash
. ~/esp/esp-idf/export.sh
idf.py --version
```

前面的 `. ` 必须保留；`export.sh` 使当前终端能找到 ESP-IDF 工具，不会烧录设备。VS Code 的 ESP-IDF 插件也可以配置并使用已安装的环境。其他安装方式参考[乐鑫官方 macOS 指南](https://docs.espressif.com/projects/esp-idf/en/v5.4.2/esp32s3/get-started/index.html)。

### 3. 安装家长端工具

安装 Node.js 和 pnpm；当前开发环境使用 Node.js 22、pnpm 10。可通过 Homebrew 安装 Node.js 22，并通过 Corepack 启用 pnpm：

```bash
brew install node@22
brew link node@22
corepack enable
corepack prepare pnpm@10.19.0 --activate
node --version
pnpm --version
```

如果系统已有 Node.js 或其他项目依赖其版本，请先检查 `node --version`，按需要使用版本管理器切换，避免覆盖既有环境。不同 Node 安装方式可能不包含 Corepack，可参考 [Corepack 官方安装说明](https://github.com/nodejs/corepack#installation)。

## 编译固件和连接开发板

### 编译通用示例

在已加载 ESP-IDF 的终端，从项目根目录执行：

```bash
cd apps/firmware/hello_world
idf.py set-target esp32s3
idf.py build
```

首次设置目标后，后续通常只需 `idf.py build`；`set-target` 会重置项目配置。看到 `Project build complete` 表示编译成功，不需要连接设备。该示例只验证编译及串口，不包含本板屏幕和触摸驱动。

### 编译宠物设备原型

在已加载 ESP-IDF 的终端，从项目根目录执行：

```bash
cd apps/pet-device
idf.py set-target esp32s3
idf.py build
```

首次构建需要联网下载 LVGL 依赖；已有工程不要反复执行 `set-target`。具体代码及浏览器预览见 [设备原型说明](apps/pet-device/README.md)。浏览器预览是独立模拟页面，不能代替设备实测。

### 连接、烧录和查看日志

烧录是通过 USB 数据线把编译好的程序写入开发板；它会覆盖设备对应位置的现有固件。通用 `hello_world` 烧录后不会显示宠物或板载测试界面；需要保留当前程序时，先按厂商资料处理备份或恢复。

1. 用支持数据传输的 USB-C 线连接电脑和板子。
2. 在连接前后分别运行 `ls /dev/cu.*`，比较新增的串口，通常类似 `/dev/cu.usbmodem...`。
3. 在**已经编译的固件项目目录**中运行下面命令，把端口替换为实际值：

   ```bash
   idf.py -p /dev/cu.实际端口 flash monitor
   ```

4. 查看输出日志，退出监视器按 `Ctrl+]`。如果找不到端口，检查数据线和 USB 连接；烧录失败时按微雪说明使用 BOOT/RESET 进入下载模式。

若要单独验证屏幕、触摸和其他外设，请从[微雪资料页](https://docs.waveshare.net/ESP32-S3-Touch-LCD-2.8/Resources-And-Documents/)选择 **V2** 示例包，阅读其中版本和构建说明。V1 使用不同的触摸芯片，不要混用例程。

## 启动家长端

从项目根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm dev:h5
```

浏览器打开 [http://localhost:5188](http://localhost:5188)。停止服务按 `Ctrl+C`。构建家长端可运行 `pnpm build:h5`。

默认体验可以不配置 Supabase；浏览器中的本地数据只保存在当前浏览器，不会与设备或其他浏览器同步。真实数据库是可选的，项目提供 `supabase/schema.sql` 和 `apps/parent-h5/.env.example` 作为配置参考；接入前需自行检查权限与安全配置，数据库连接不代表真实设备已接通。

## 进一步阅读

- [产品方案](docs/产品方案.md)：任务、金币、设备和整体规划。
- [ESP32-S3 开发环境安装](docs/开发环境安装.md)：安装及板级示例补充说明。
- [家长端方案](docs/家长端H5方案.md)：家长端功能设计。
- [设备原型说明](apps/pet-device/README.md)：原型功能和第三方代码来源。
