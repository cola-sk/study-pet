// 数据实体与类型定义 (支持多设备、多孩子)

export type ConfirmType = 'parent_confirm' | 'auto_confirm';

export type FrequencyType = 'daily' | 'weekly_days' | 'interval_days';

export type TargetScope = 'all' | 'specific';

export interface FrequencyConfig {
  days?: number[]; // [1, 2, 3, 4, 5] 周一到周五
  interval?: number; // 每 N 天
  baseDate?: string; // 起算日期 YYYY-MM-DD
}

export type TaskInstanceStatus = 'pending' | 'submitted' | 'completed' | 'rejected';

export interface Family {
  id: string;
  name: string;
  timezone: string;
  createdAt: string;
}

export interface Child {
  id: string;
  familyId: string;
  nickname: string;
  coinsBalance: number;
  avatarUrl?: string;
  avatarIcon?: string; // 用户录入时选择的头像图标
}

export interface Device {
  id: string;
  familyId?: string;
  childId?: string; // 归属的具体孩子 ID
  alias: string; // 设备别名，如“天天的哈小伴”、“果果的学习机”
  deviceModel: string;
  macAddress?: string;
  pairCode?: string;
  pairCodeExpiresAt?: string;
  status: 'unpaired' | 'paired';
  firmwareVersion: string;
  lastSeenAt?: string;
}

export interface TaskTemplate {
  updatedAt?: string;
  id: string;
  familyId: string;
  title: string;
  description?: string;
  rewardCoins: number;
  confirmType: ConfirmType;
  frequencyType: FrequencyType;
  frequencyConfig: FrequencyConfig;
  targetScope: TargetScope; // 'all' (全体设备/孩子) | 'specific' (指定孩子/设备)
  targetChildIds: string[]; // 当 targetScope 为 specific 时的目标孩子 ID 列表
  isActive: boolean;
  startDate?: string;
  endDate?: string | null;
  createdAt: string;
}

export interface TaskInstance {
  id: string;
  templateId: string;
  familyId: string;
  childId: string;
  childNickname?: string; // 孩子昵称快照
  deviceId?: string;
  deviceAlias?: string;   // 设备名称快照
  targetDate: string;
  title: string;
  description?: string;
  rewardCoins: number;
  confirmType: ConfirmType;
  status: TaskInstanceStatus;
  submittedAt?: string;
  reviewedAt?: string;
  rejectReason?: string;
  rewardGranted: boolean;
  clientRequestId?: string;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  familyId: string;
  childId: string;
  childNickname?: string;
  amount: number;
  balanceAfter: number;
  type: 'task_reward' | 'shop_purchase';
  description: string;
  referenceId?: string;
  createdAt: string;
}

export interface ShopItem {
  id: string;
  name: string;
  category: 'food' | 'water' | 'clothes';
  price: number;
  icon?: string | null; // 用户上传或选择的商品图标
  description?: string;
}

export interface PetState {
  id: string;
  familyId: string;
  childId: string;
  petAvatar?: string | null; // 用户上传或选择的宠物图标
  petName: string;
  currentClothesItem?: ShopItem | null;
  foodCount: number;
  waterCount: number;
  updatedAt: string;
}
