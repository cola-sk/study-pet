---
name: StudyPet Precision Modern Design System
description: 学习任务养成宠物 (StudyPet) 精密结构化现代极简设计规范 (Linear / Stripe Dashboard 风格)
colors:
  background: '#F4F6F9'         # 通透浅冷灰画布
  surface: '#FFFFFF'            # 纯白高对比容器
  surface-subtle: '#F8FAFC'     # 卡片内嵌分栏底色
  
  foreground: '#0F172A'         # Slate-900 深邃墨色主文字
  foreground-muted: '#475569'   # Slate-600 次级信息
  foreground-subtle: '#94A3B8'  # Slate-400 辅助标注
  
  border: '#E2E8F0'             # 1px 精密结构分割线
  
  primary: '#4F46E5'            # Indigo-600 科技感靛蓝主色
  primary-surface: '#EEF2FF'
  primary-border: '#C7D2FE'
  
  success: '#059669'            # Emerald-600 终端在线/已发币
  success-surface: '#ECFDF5'
  
  warning: '#D97706'            # Amber-600 金币激励/待确认
  warning-surface: '#FFFBEB'
  
  danger: '#DC2626'             # Red-600 驳回/异常

rounded:
  badge: "4px"                  # rounded (紧凑标签)
  control: "6px"                # rounded-md (按钮/分段子项)
  input: "8px"                  # rounded-lg (输入框/内层块)
  card: "12px"                  # rounded-xl (外层主面板，严禁使用 24px+ 气泡圆角)

shadows:
  card: "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)"
---

# StudyPet 精密结构化设计系统规范 (design.md)

## 1. 核心设计原则：Architectural Precision (结构化精密感，告别简陋与气泡圆角)

1. **克制同心圆角体系 (Concentric & Crisp Radius)**：
   - 严禁使用 `rounded-3xl` (24px) 和泛滥的 `rounded-full` 胶囊按钮；
   - 外层面板统一采用 `rounded-xl` (12px)，内部按钮与选择器采用 `rounded-md` (6px) / `rounded-lg` (8px)，状态徽章采用 `rounded` (4px)，呈现利落、严谨的现代工业软件质感。
2. **Bento 矩阵与工单式信息架构 (Bento KPI & Ticket Architecture)**：
   - **成员状态卡**：上半部展示成员与硬件终端在线状态，下半部采用 `grid-cols-3 divide-x` 三栏数据矩阵（账户金币、今日完成进度条、待审批数），使用 `font-mono tabular-nums` 等宽数字对齐；
   - **待确认工单卡**：采用左侧 `3px` 靛蓝状态边条 + 顶栏设备/时间元数据 + 主体任务与右侧金币盒 + 底栏双按钮操作区，告别“白框堆文字”的简陋感。
3. **定制矢量图标体系 (Vector SVG System)**：
   - 使用统一的 `1.75px` 描边 SVG 矢量图标（金币、硬件终端、Wi-Fi 信号、闪电工单、盾牌审核）替代廉价的裸 Emoji。
