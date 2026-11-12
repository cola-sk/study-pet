import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Family, 
  Child, 
  Device, 
  TaskTemplate, 
  TaskInstance, 
  WalletTransaction, 
  PetState, 
  ShopItem 
} from '../services/types';
import { triggerHaptic } from '../utils/haptic';
import { shootCoinsConfetti } from '../utils/confetti';
import { supabase, isSupabaseConfigured } from '../services/supabase';

// 初始默认商品字典
const DEFAULT_SHOP_ITEMS: ShopItem[] = [
  { id: 'item-1', name: '新鲜小苹果', category: 'food', price: 5, icon: '🍎', description: '脆甜多汁的小红富士' },
  { id: 'item-2', name: '美味小蛋糕', category: 'food', price: 12, icon: '🍰', description: '香甜草莓奶油蛋糕' },
  { id: 'item-3', name: '纯净矿泉水', category: 'water', price: 5, icon: '💧', description: '清凉解渴矿泉水' },
  { id: 'item-4', name: '清凉椰子汁', category: 'water', price: 10, icon: '🥥', description: '天然甘甜椰子水' },
  { id: 'item-5', name: '水手服套装', category: 'clothes', price: 40, icon: '👔', description: '帅气精神的水手校服' },
  { id: 'item-6', name: '恐龙连体衣', category: 'clothes', price: 60, icon: '🦖', description: '超萌绿色小恐龙' },
];

const INITIAL_FAMILY: Family = {
  id: 'fam-101',
  name: '快乐学习小家',
  timezone: 'Asia/Shanghai',
  createdAt: '2026-11-12T08:00:00Z',
};

const INITIAL_CHILD: Child = {
  id: 'child-101',
  familyId: 'fam-101',
  nickname: '天天',
  coinsBalance: 25,
  avatarUrl: '',
};

const INITIAL_DEVICE: Device = {
  id: 'dev-101',
  familyId: 'fam-101',
  deviceModel: '微雪 ESP32-S3-Touch-LCD-2.8',
  macAddress: 'DC:54:75:A8:B2:10',
  status: 'paired',
  firmwareVersion: 'v1.0.2',
  lastSeenAt: '2分钟前',
};

const INITIAL_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tpl-1',
    familyId: 'fam-101',
    title: '自主阅读课外书 15 分钟',
    description: '读完并在设备上提交，家长确认后发金币',
    rewardCoins: 10,
    confirmType: 'parent_confirm',
    frequencyType: 'daily',
    frequencyConfig: {},
    isActive: true,
    createdAt: '2026-11-10T10:00:00Z',
  },
  {
    id: 'tpl-2',
    familyId: 'fam-101',
    title: '练琴 / 练习乐器 20 分钟',
    description: '保持手型规范，认真弹奏',
    rewardCoins: 15,
    confirmType: 'parent_confirm',
    frequencyType: 'weekly_days',
    frequencyConfig: { days: [1, 3, 5] },
    isActive: true,
    createdAt: '2026-11-10T10:00:00Z',
  },
  {
    id: 'tpl-3',
    familyId: 'fam-101',
    title: '睡前自主整理书包与书桌',
    description: '整理好明天课程需要的课本与文具',
    rewardCoins: 5,
    confirmType: 'auto_confirm',
    frequencyType: 'daily',
    frequencyConfig: {},
    isActive: true,
    createdAt: '2026-11-10T10:00:00Z',
  },
];

const getTodayStr = () => new Date().toISOString().split('T')[0];

const INITIAL_INSTANCES: TaskInstance[] = [
  {
    id: 'inst-1',
    templateId: 'tpl-1',
    familyId: 'fam-101',
    childId: 'child-101',
    targetDate: getTodayStr(),
    title: '自主阅读课外书 15 分钟',
    description: '孩子在 ESP32 屏幕上点击了完成提交',
    rewardCoins: 10,
    confirmType: 'parent_confirm',
    status: 'submitted', // 待家长确认
    submittedAt: '10:25',
    rewardGranted: false,
    createdAt: '2026-11-12T00:00:00Z',
  },
  {
    id: 'inst-2',
    templateId: 'tpl-2',
    familyId: 'fam-101',
    childId: 'child-101',
    targetDate: getTodayStr(),
    title: '练琴 / 练习乐器 20 分钟',
    description: '今天周三，属于计划内日程',
    rewardCoins: 15,
    confirmType: 'parent_confirm',
    status: 'pending', // 待孩子在设备上提交
    rewardGranted: false,
    createdAt: '2026-11-12T00:00:00Z',
  },
  {
    id: 'inst-3',
    templateId: 'tpl-3',
    familyId: 'fam-101',
    childId: 'child-101',
    targetDate: getTodayStr(),
    title: '睡前自主整理书包与书桌',
    description: '免家长确认，孩子提交后金币已自动入账',
    rewardCoins: 5,
    confirmType: 'auto_confirm',
    status: 'completed',
    submittedAt: '08:15',
    reviewedAt: '08:15',
    rewardGranted: true,
    createdAt: '2026-11-12T00:00:00Z',
  },
];

const INITIAL_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'tx-1',
    familyId: 'fam-101',
    childId: 'child-101',
    amount: 5,
    balanceAfter: 25,
    type: 'task_reward',
    description: '完成任务: 睡前自主整理书包与书桌',
    createdAt: '今天 08:15',
  },
  {
    id: 'tx-2',
    familyId: 'fam-101',
    childId: 'child-101',
    amount: -10,
    balanceAfter: 20,
    type: 'shop_purchase',
    description: '商店消费: 购买清凉椰子汁 🥥',
    createdAt: '昨天 19:30',
  },
  {
    id: 'tx-3',
    familyId: 'fam-101',
    childId: 'child-101',
    amount: 10,
    balanceAfter: 30,
    type: 'task_reward',
    description: '完成任务: 自主阅读课外书 15 分钟 (家长确认)',
    createdAt: '昨天 18:20',
  },
];

const INITIAL_PET: PetState = {
  id: 'pet-101',
  familyId: 'fam-101',
  childId: 'child-101',
  currentClothesItem: DEFAULT_SHOP_ITEMS[4], // 水手服
  foodCount: 2,
  waterCount: 1,
  updatedAt: '2026-11-12T08:00:00Z',
};

interface AppState {
  family: Family;
  child: Child;
  device: Device;
  templates: TaskTemplate[];
  instances: TaskInstance[];
  transactions: WalletTransaction[];
  pet: PetState;
  shopItems: ShopItem[];
  isSyncing: boolean;

  // Actions
  approveTask: (instanceId: string) => Promise<{ success: boolean; message: string; coins?: number }>;
  rejectTask: (instanceId: string, reason: string) => Promise<{ success: boolean; message: string }>;
  addTemplate: (tpl: Omit<TaskTemplate, 'id' | 'createdAt'>) => void;
  updateTemplate: (id: string, updates: Partial<TaskTemplate>) => void;
  deleteTemplate: (id: string) => void;
  toggleTemplate: (id: string) => void;
  pairDevice: (pairCode: string) => Promise<{ success: boolean; message: string }>;
  unbindDevice: () => void;
  updateChildNickname: (nickname: string) => void;
  setTimezone: (timezone: string) => void;
  resetAllData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      family: INITIAL_FAMILY,
      child: INITIAL_CHILD,
      device: INITIAL_DEVICE,
      templates: INITIAL_TEMPLATES,
      instances: INITIAL_INSTANCES,
      transactions: INITIAL_TRANSACTIONS,
      pet: INITIAL_PET,
      shopItems: DEFAULT_SHOP_ITEMS,
      isSyncing: false,

      approveTask: async (instanceId: string) => {
        const { instances, child, family } = get();
        const task = instances.find(i => i.id === instanceId);
        if (!task) {
          return { success: false, message: '找不到该任务' };
        }

        if (task.status === 'completed' && task.rewardGranted) {
          return { success: true, message: '该任务先前已发放奖励', coins: 0 };
        }

        triggerHaptic(20);
        shootCoinsConfetti();

        const awardedCoins = task.rewardCoins;
        const newBalance = child.coinsBalance + awardedCoins;
        const nowTimeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

        // 尝试如果配置了 Supabase，调用 RPC
        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.rpc('approve_task_and_reward', {
              p_instance_id: instanceId,
              p_request_id: crypto.randomUUID(),
            });
          } catch (err) {
            console.warn('Supabase RPC call fallback to local:', err);
          }
        }

        const newTx: WalletTransaction = {
          id: `tx-${Date.now()}`,
          familyId: family.id,
          childId: child.id,
          amount: awardedCoins,
          balanceAfter: newBalance,
          type: 'task_reward',
          description: `完成任务: ${task.title} (家长已批准)`,
          createdAt: `今天 ${nowTimeStr}`,
        };

        set({
          child: { ...child, coinsBalance: newBalance },
          instances: instances.map(item =>
            item.id === instanceId
              ? {
                  ...item,
                  status: 'completed',
                  rewardGranted: true,
                  reviewedAt: nowTimeStr,
                }
              : item
          ),
          transactions: [newTx, ...get().transactions],
        });

        return {
          success: true,
          message: `审批通过！已向${child.nickname}发放 +${awardedCoins} 金币`,
          coins: awardedCoins,
        };
      },

      rejectTask: async (instanceId: string, reason: string) => {
        const { instances } = get();
        const task = instances.find(i => i.id === instanceId);
        if (!task) return { success: false, message: '找不到该任务' };

        triggerHaptic(30);

        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.rpc('reject_task', {
              p_instance_id: instanceId,
              p_reason: reason,
            });
          } catch (err) {
            console.warn('Supabase reject fallback to local:', err);
          }
        }

        // 驳回后任务重置为 'pending'，并附带驳回原因，允许孩子在设备端重新提交
        set({
          instances: instances.map(item =>
            item.id === instanceId
              ? {
                  ...item,
                  status: 'pending',
                  rejectReason: reason,
                  submittedAt: undefined,
                }
              : item
          ),
        });

        return { success: true, message: '已驳回，任务已退回待完成状态' };
      },

      addTemplate: (tpl) => {
        const id = `tpl-${Date.now()}`;
        const newTemplate: TaskTemplate = {
          ...tpl,
          id,
          createdAt: new Date().toISOString(),
        };

        // 如果当天适宜执行，自动生成一条今天的任务实例
        const todayStr = getTodayStr();
        const newInstance: TaskInstance = {
          id: `inst-${Date.now()}`,
          templateId: id,
          familyId: tpl.familyId,
          childId: get().child.id,
          targetDate: todayStr,
          title: tpl.title,
          description: tpl.description,
          rewardCoins: tpl.rewardCoins,
          confirmType: tpl.confirmType,
          status: 'pending',
          rewardGranted: false,
          createdAt: new Date().toISOString(),
        };

        set(state => ({
          templates: [newTemplate, ...state.templates],
          instances: [newInstance, ...state.instances],
        }));
        triggerHaptic(15);
      },

      updateTemplate: (id, updates) => {
        set(state => ({
          templates: state.templates.map(t => (t.id === id ? { ...t, ...updates } : t)),
        }));
      },

      deleteTemplate: (id) => {
        set(state => ({
          templates: state.templates.filter(t => t.id !== id),
        }));
      },

      toggleTemplate: (id) => {
        set(state => ({
          templates: state.templates.map(t =>
            t.id === id ? { ...t, isActive: !t.isActive } : t
          ),
        }));
        triggerHaptic(10);
      },

      pairDevice: async (pairCode: string) => {
        triggerHaptic(20);
        // 模拟配对校验：6位数字
        if (!/^\d{6}$/.test(pairCode)) {
          return { success: false, message: '请输入微雪屏幕上显示的 6 位纯数字配对码' };
        }

        // 绑定成功
        set(state => ({
          device: {
            ...state.device,
            status: 'paired',
            pairCode,
            lastSeenAt: '刚刚',
          },
        }));

        return { success: true, message: '微雪 ESP32 设备绑定成功！' };
      },

      unbindDevice: () => {
        set(state => ({
          device: {
            ...state.device,
            status: 'unpaired',
            pairCode: undefined,
          },
        }));
        triggerHaptic(20);
      },

      updateChildNickname: (nickname: string) => {
        set(state => ({
          child: { ...state.child, nickname },
        }));
      },

      setTimezone: (timezone: string) => {
        set(state => ({
          family: { ...state.family, timezone },
        }));
      },

      resetAllData: () => {
        set({
          family: INITIAL_FAMILY,
          child: INITIAL_CHILD,
          device: INITIAL_DEVICE,
          templates: INITIAL_TEMPLATES,
          instances: INITIAL_INSTANCES,
          transactions: INITIAL_TRANSACTIONS,
          pet: INITIAL_PET,
        });
      },
    }),
    {
      name: 'study_pet_parent_storage_v1',
    }
  )
);
