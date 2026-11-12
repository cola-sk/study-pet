// 数据实体与类型定义 (严格对齐 docs/产品方案.md 与 Supabase 结构)

export type ConfirmType = 'parent_confirm' | 'auto_confirm';

export type FrequencyType = 'daily' | 'weekly_days' | 'interval_days';

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
}

export interface Device {
  id: string;
  familyId?: string;
  deviceModel: string;
  macAddress?: string;
  pairCode?: string;
  pairCodeExpiresAt?: string;
  status: 'unpaired' | 'paired';
  firmwareVersion: string;
  lastSeenAt?: string;
}

export interface TaskTemplate {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  rewardCoins: number;
  confirmType: ConfirmType;
  frequencyType: FrequencyType;
  frequencyConfig: FrequencyConfig;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface TaskInstance {
  id: string;
  templateId: string;
  familyId: string;
  childId: string;
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
  icon: string;
  description?: string;
}

export interface PetState {
  id: string;
  familyId: string;
  childId: string;
  currentClothesItem?: ShopItem | null;
  foodCount: number;
  waterCount: number;
  updatedAt: string;
}
