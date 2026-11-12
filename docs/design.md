---
name: StudyPet Natural Zen Design System
description: 学习任务养成宠物 (StudyPet) 日式原木温暖素雅亲子风设计规范 (MUJI / Balmuda 风格)
colors:
  # 画布与和纸质感底色
  background: '#F7F5F0'         # 亚麻暖米色
  surface: '#FFFFFF'            # 象牙暖白
  surface-subtle: '#EFECE6'     # 和纸浅灰褐
  surface-warm: '#FDFAF6'       # 柔润木香白
  
  # 沉稳温暖文字 (浓茶/炭褐)
  foreground: '#2D2621'         # 沉稳炭黑棕，告别冰冷死黑
  foreground-muted: '#7D7267'   # 陶土暖灰
  foreground-subtle: '#A89F95'  # 浅木灰
  
  # 边框与发丝线
  border: '#EAE5DC'             # 柔和木米细边框
  border-subtle: 'rgba(60, 48, 36, 0.05)'
  border-hover: '#DCD5C9'
  
  # 核心自然点缀色 (Natural Accents)
  terracotta: '#D96B43'         # 暖陶橙 (主交互/活力按钮/待确认)
  terracotta-light: '#FDF3EE'   # 暖陶浅底
  terracotta-border: '#F8D8CB'
  
  matcha: '#4F7757'             # 抹茶木绿 (设备在线/已发币完成)
  matcha-light: '#EEF4EF'       # 抹茶浅底
  matcha-border: '#D0E3D4'
  
  amber-honey: '#D49439'        # 蜂蜜琥珀金 (金币/奖励)
  amber-gold: '#C88A2E'         # 金币深文字
  amber-light: '#FEF8ED'        # 琥珀浅底
  amber-border: '#FCE7C2'
  
  mist-blue: '#5C829B'          # 浅雾蓝 (设备标签/辅助)
  mist-light: '#EFF5F8'
  mist-border: '#D5E5EE'
  
  clay-red: '#C85A5A'           # 柔陶红 (驳回/注意)
  clay-light: '#FDF2F2'

typography:
  display-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Hiragino Sans GB', sans-serif"
    fontSize: "20px"
    fontWeight: "700"
    lineHeight: "26px"
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Hiragino Sans GB', sans-serif"
    fontSize: "16px"
    fontWeight: "600"
    lineHeight: "22px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif"
    fontSize: "14px"
    fontWeight: "400"
    lineHeight: "20px"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif"
    fontSize: "12px"
    fontWeight: "500"
    lineHeight: "16px"

rounded:
  sm: "8px"
  md: "12px"
  card: "20px"
  panel: "24px"
  large: "32px"
  full: "9999px"

shadows:
  ambient: "0 1px 3px rgba(60, 48, 36, 0.04)"
  card: "0 2px 10px rgba(60, 48, 36, 0.04)"
  float: "0 8px 24px rgba(60, 48, 36, 0.08)"

spacing:
  margin-screen: "16px"
  card-padding: "16px"
  item-gap: "12px"
  section-gap: "20px"
---

# StudyPet 日式原木温暖素雅亲子风设计系统规范 (Natural Zen)

## 1. 核心设计哲学：Warm Sanctuary & Quiet Delight (温润居所·素雅治愈)

方案 C 融合 **MUJI (无印良品)** 的质朴自然美学与 **Balmuda (巴慕达)** 的现代生活电器质感：

1. **温润和纸底色，告别冷淡纯黑白**：
   - 彻底摒弃冰冷死板的冷灰（`zinc` 系列）与刺目的死黑，以暖亚麻色（`#F7F5F0`）为底，象牙白卡片为基座；
   - 文字使用浓茶炭褐（`#2D2621`），阅读体验温润柔和、不伤眼。
2. **大地与植物色系（Organic Earth Palettes）**：
   - **暖陶橙（`#D96B43`）**：主交互动作、待处理打卡标记，温暖有朝气；
   - **抹茶木绿（`#4F7757`）**：设备在线呼吸灯、任务完成审核，如嫩芽初生；
   - **蜂蜜琥珀金（`#C88A2E`）**：金币与成长激励，如蜂蜜般温甜；
   - **浅雾蓝（`#5C829B`）**：硬件设备标签，宁静舒缓。
3. **圆融柔和触感 (Curved Tactility)**：
   - 全面升级为 `rounded-3xl`（24px）大圆角与药丸胶囊，触感柔糯圆融，完美契合家庭亲子与桌面陪伴宠物的治愈属性。
