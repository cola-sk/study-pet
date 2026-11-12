# 家长端 H5 (React + Ant Design Mobile + PWA)

基于“学习任务养成宠物桌面设备”整体技术方案打造的**家长端移动 Web 应用（PWA）**。

## 核心特性

- 🚀 **极速体验与移动端质感**：基于 React 18 + Vite + TypeScript + Ant Design Mobile (v5)，支持 iPhone 灵动岛/刘海屏安全区、手势回弹与触控微震动。
- 📱 **支持“安装到手机主屏幕”（PWA & A2HS）**：
  - **Android / 现代浏览器**：拦截默认通知栏，提供高质感安装条，一键触发原生安装窗添加到手机桌面。
  - **iOS Safari**：针对 iOS 特殊机制，自动检测并在底部弹出手势引导卡片（*“点击分享 ⎋ → 添加到主屏幕 ⊞”*）。
  - **沉浸式体验**：从桌面图标启动时全屏（Standalone）运行，无浏览器地址栏和回退条。
- ⚡ **离线秒开与三级缓存**：通过 Service Worker (Workbox) 实现 App Shell 资源预缓存与只读 API 降级缓存，断网也能正常查看今日任务与金币账本。
- 🗄️ **Vercel + Supabase 原生适配**：
  - 生产数据库方案基于 Supabase (PostgreSQL)，配有完整建表语句与发币防重 RPC（见 `../../supabase/schema.sql`）。
  - 内置智能本地存储（LocalStorage / Zustand Persist）降级模式：未配置 Supabase 环境变量时自动使用本地状态，开箱即测即用！
  - 自带 `vercel.json`，一键部署到 Vercel。

---

## 页面模块概览

1. **审批大厅（Home）**：
   - 孩子与宠物实时状态预览、今日完成进度。
   - 置顶展示孩子在 ESP32 屏幕提交的待确认任务，一键【批准发币】（金币粒子微动效 + 触控震动）或【驳回说明】。
2. **任务规则管理（Tasks）**：
   - 任务模板卡片列表、一键【启用 / 暂停】。
   - 新建/编辑任务：支持每日、每周指定星期、每 N 天周期规则与金币步进设置。
3. **宠物与金币（Pet & Wallet）**：
   - 孩子当前宠物装扮（服饰、背包物资如食物和水）。
   - 金币资产看板（余额、今日赚取、累计消费）。
   - 不可篡改的金币流水明细与设备端商城字典。
4. **我的与设备（Settings）**：
   - 微雪 ESP32 硬件设备配对（输入开发板屏幕 6 位短期配对码）。
   - 孩子昵称与时区管理。
   - PWA 桌面安装指引与本地数据重置。

---

## 本地快速启动

```bash
# 进入工程目录
cd parent-h5

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本与 PWA Service Worker
pnpm build

# 预览生产构建 (支持测试 PWA 离线运行)
pnpm preview
```

---

## 环境变量与 Supabase 连接（可选）

如需连接真实的 Supabase 数据库：
1. 在 Supabase 后台 SQL Editor 中执行项目根目录下的 `supabase/schema.sql`；
2. 在 `parent-h5` 下创建 `.env.local`（或在 Vercel 控制台配置环境变量）：

```env
VITE_SUPABASE_URL=https://your-supabase-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> **提示**：未配置上述环境变量时，系统会自动启动内置的高仿真 LocalStorage 存储引擎，所有添加任务、发币与配对操作均正常运作并持久保存在手机浏览器中。

---

## 部署到 Vercel

### 方式一：Vercel CLI 命令行部署
```bash
npm i -g vercel
cd parent-h5
vercel
```

### 方式二：Git 仓库绑定部署
在 Vercel Dashboard 中导入本仓库，将 **Root Directory** 设置为 `parent-h5` 即可一键自动化构建与部署！
