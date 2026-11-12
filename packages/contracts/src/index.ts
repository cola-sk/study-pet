/**
 * 学习任务养成宠物系统 - 统一通信协议与数据契约规范
 * 供家长端 H5 (TypeScript)、服务端 (Vercel/Supabase)、ESP32 固件 (C/C++) 共同参照
 */

// 1. 任务确认方式
export const CONFIRM_TYPES = {
  PARENT_CONFIRM: 'parent_confirm', // 家长确认后发币 (默认)
  AUTO_CONFIRM: 'auto_confirm',     // 孩子提交即发币
} as const;

// 2. 任务状态机定义
export const TASK_STATUS = {
  PENDING: 'pending',     // 待孩子在设备完成
  SUBMITTED: 'submitted', // 待家长确认
  COMPLETED: 'completed', // 已确认/已完成发币
  REJECTED: 'rejected',   // 已驳回 (允许孩子重新提交)
} as const;

// 3. 商店道具分类
export const SHOP_CATEGORY = {
  FOOD: 'food',       // 消耗品：食物
  WATER: 'water',     // 消耗品：饮水
  CLOTHES: 'clothes', // 永久穿戴服饰
} as const;

// 4. RESTful 核心接口契约路径定义
export const API_ENDPOINTS = {
  // 设备端接口
  DEVICE_PAIR: '/api/v1/device/pair',                         // POST: 设备配对 (pairCode: 6位)
  DEVICE_TODAY_TASKS: '/api/v1/device/tasks/today',           // GET: 获取今日任务清单
  DEVICE_TASK_SUBMIT: '/api/v1/task-instances/:id/submit',    // POST: 孩子在设备提交任务
  DEVICE_WALLET_BALANCE: '/api/v1/wallet',                    // GET: 查询金币余额与道具
  DEVICE_SHOP_BUY: '/api/v1/shop/purchases',                  // POST: 购买道具 (itemId, requestId)
  DEVICE_ITEM_USE: '/api/v1/inventory/:itemId/use',           // POST: 使用食物/水/更换衣服

  // 家长端接口
  PARENT_TASK_APPROVE: '/api/v1/task-instances/:id/approve',  // POST: 家长批准任务并原子发币
  PARENT_TASK_REJECT: '/api/v1/task-instances/:id/reject',    // POST: 家长驳回任务 (携带理由)
  PARENT_TEMPLATES: '/api/v1/task-templates',                 // GET/POST: 任务模板列表与新建
  PARENT_TEMPLATE_STATUS: '/api/v1/task-templates/:id/status',// PATCH: 模板启用/暂停
  PARENT_WALLET_LOGS: '/api/v1/wallet/transactions',          // GET: 金币收支明细
  PARENT_PET_SUMMARY: '/api/v1/family/pet-summary',           // GET: 宠物形象、装扮与库存
} as const;
