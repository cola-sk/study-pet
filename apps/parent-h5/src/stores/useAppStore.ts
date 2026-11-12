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

// 预设二胎家庭示范数据：天天（大宝）与 果果（二宝）
const INITIAL_CHILDREN: Child[] = [
  {
    id: 'child-101',
    familyId: 'fam-101',
    nickname: '天天 (大宝)',
    coinsBalance: 25,
    avatarIcon: '👦',
  },
  {
    id: 'child-102',
    familyId: 'fam-101',
    nickname: '果果 (二宝)',
    coinsBalance: 15,
    avatarIcon: '👧',
  },
];

// 预设已关联的两台微雪 ESP32 硬件设备
const INITIAL_DEVICES: Device[] = [
  {
    id: 'dev-101',
    familyId: 'fam-101',
    childId: 'child-101',
    alias: '天天的书桌设备',
    deviceModel: '微雪 ESP32-S3-Touch-LCD-2.8',
    macAddress: 'DC:54:75:A8:B2:10',
    status: 'paired',
    firmwareVersion: 'v1.0.2',
    lastSeenAt: '2分钟前',
  },
  {
    id: 'dev-102',
    familyId: 'fam-101',
    childId: 'child-102',
    alias: '果果的小房间设备',
    deviceModel: '微雪 ESP32-S3-Touch-LCD-2.8',
    macAddress: 'DC:54:75:A8:C3:44',
    status: 'paired',
    firmwareVersion: 'v1.0.2',
    lastSeenAt: '5分钟前',
  },
];

// 每个孩子拥有的独立宠物小窝
const INITIAL_PETS: Record<string, PetState> = {
  'child-101': {
    id: 'pet-101',
    familyId: 'fam-101',
    childId: 'child-101',
    petAvatar: '🐶',
    petName: '天天的汪汪',
    currentClothesItem: DEFAULT_SHOP_ITEMS[4], // 水手服
    foodCount: 2,
    waterCount: 1,
    updatedAt: '2026-11-12T08:00:00Z',
  },
  'child-102': {
    id: 'pet-102',
    familyId: 'fam-101',
    childId: 'child-102',
    petAvatar: '🐱',
    petName: '果果的喵喵',
    currentClothesItem: DEFAULT_SHOP_ITEMS[5], // 恐龙服
    foodCount: 3,
    waterCount: 2,
    updatedAt: '2026-11-12T08:00:00Z',
  },
};

const INITIAL_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tpl-1',
    familyId: 'fam-101',
    title: '自主阅读课外书 15 分钟',
    description: '读完并在自己设备上打卡，家长确认后发金币',
    rewardCoins: 10,
    confirmType: 'parent_confirm',
    frequencyType: 'daily',
    frequencyConfig: {},
    targetScope: 'all', // 全员共同任务！
    targetChildIds: [],
    isActive: true,
    createdAt: '2026-11-10T10:00:00Z',
  },
  {
    id: 'tpl-2',
    familyId: 'fam-101',
    title: '大宝中考英语听力 20 分钟',
    description: '保持专注，完成两篇听力练习',
    rewardCoins: 15,
    confirmType: 'parent_confirm',
    frequencyType: 'weekly_days',
    frequencyConfig: { days: [1, 3, 5] },
    targetScope: 'specific', // 仅大宝天天专属任务
    targetChildIds: ['child-101'],
    isActive: true,
    createdAt: '2026-11-10T10:00:00Z',
  },
  {
    id: 'tpl-3',
    familyId: 'fam-101',
    title: '睡前自主整理书包与桌面',
    description: '收拾文具，免确认直接发金币',
    rewardCoins: 5,
    confirmType: 'auto_confirm',
    frequencyType: 'daily',
    frequencyConfig: {},
    targetScope: 'all', // 全员共同任务
    targetChildIds: [],
    isActive: true,
    createdAt: '2026-11-10T10:00:00Z',
  },
];

const getTodayStr = () => new Date().toISOString().split('T')[0];

const INITIAL_INSTANCES: TaskInstance[] = [
  // 天天提交的自主阅读
  {
    id: 'inst-1',
    templateId: 'tpl-1',
    familyId: 'fam-101',
    childId: 'child-101',
    childNickname: '天天 (大宝)',
    deviceId: 'dev-101',
    deviceAlias: '天天的书桌设备',
    targetDate: getTodayStr(),
    title: '自主阅读课外书 15 分钟',
    description: '在微雪屏幕上完成了打卡',
    rewardCoins: 10,
    confirmType: 'parent_confirm',
    status: 'submitted', // 待家长确认
    submittedAt: '10:25',
    rewardGranted: false,
    createdAt: '2026-11-12T00:00:00Z',
  },
  // 果果提交的自主阅读 (全员任务，果果也有独立一份！)
  {
    id: 'inst-2',
    templateId: 'tpl-1',
    familyId: 'fam-101',
    childId: 'child-102',
    childNickname: '果果 (二宝)',
    deviceId: 'dev-102',
    deviceAlias: '果果的小房间设备',
    targetDate: getTodayStr(),
    title: '自主阅读课外书 15 分钟',
    description: '果果读了绘本小恐龙故事',
    rewardCoins: 10,
    confirmType: 'parent_confirm',
    status: 'submitted', // 待家长确认
    submittedAt: '10:40',
    rewardGranted: false,
    createdAt: '2026-11-12T00:00:00Z',
  },
  // 天天的专属英语听力
  {
    id: 'inst-3',
    templateId: 'tpl-2',
    familyId: 'fam-101',
    childId: 'child-101',
    childNickname: '天天 (大宝)',
    deviceId: 'dev-101',
    deviceAlias: '天天的书桌设备',
    targetDate: getTodayStr(),
    title: '大宝中考英语听力 20 分钟',
    description: '今天周三，进行中',
    rewardCoins: 15,
    confirmType: 'parent_confirm',
    status: 'pending',
    rewardGranted: false,
    createdAt: '2026-11-12T00:00:00Z',
  },
  // 睡前整理书包 (已完成免确认)
  {
    id: 'inst-4',
    templateId: 'tpl-3',
    familyId: 'fam-101',
    childId: 'child-101',
    childNickname: '天天 (大宝)',
    deviceId: 'dev-101',
    deviceAlias: '天天的书桌设备',
    targetDate: getTodayStr(),
    title: '睡前自主整理书包与桌面',
    description: '免确认已自动发币',
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
    childNickname: '天天 (大宝)',
    amount: 5,
    balanceAfter: 25,
    type: 'task_reward',
    description: '天天 完成任务: 睡前整理书包',
    createdAt: '今天 08:15',
  },
  {
    id: 'tx-2',
    familyId: 'fam-101',
    childId: 'child-102',
    childNickname: '果果 (二宝)',
    amount: 15,
    balanceAfter: 15,
    type: 'task_reward',
    description: '果果 初始学习奖励金币',
    createdAt: '昨天 19:30',
  },
];

interface AppState {
  family: Family;
  children: Child[];
  devices: Device[];
  selectedChildId: string; // 'all' 或具体 childId
  templates: TaskTemplate[];
  instances: TaskInstance[];
  transactions: WalletTransaction[];
  pets: Record<string, PetState>;
  shopItems: ShopItem[];
  isSyncing: boolean;

  // Actions
  setSelectedChildId: (childId: string) => void;
  syncWithSupabase: () => Promise<void>;
  approveTask: (instanceId: string) => Promise<{ success: boolean; message: string; coins?: number }>;
  rejectTask: (instanceId: string, reason: string) => Promise<{ success: boolean; message: string }>;
  addTemplate: (tpl: Omit<TaskTemplate, 'id' | 'createdAt'>) => void;
  updateTemplate: (id: string, updates: Partial<TaskTemplate>) => void;
  deleteTemplate: (id: string) => void;
  toggleTemplate: (id: string) => void;
  pairDevice: (pairCode: string, alias: string, childId: string) => Promise<{ success: boolean; message: string }>;
  unbindDevice: (deviceId: string) => void;
  addChild: (nickname: string, avatarIcon?: string) => void;
  updateChildNickname: (childId: string, nickname: string) => void;
  setTimezone: (timezone: string) => void;
  resetAllData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      family: INITIAL_FAMILY,
      children: INITIAL_CHILDREN,
      devices: INITIAL_DEVICES,
      selectedChildId: 'all',
      templates: INITIAL_TEMPLATES,
      instances: INITIAL_INSTANCES,
      transactions: INITIAL_TRANSACTIONS,
      pets: INITIAL_PETS,
      shopItems: DEFAULT_SHOP_ITEMS,
      isSyncing: false,

      setSelectedChildId: (childId: string) => {
        set({ selectedChildId: childId });
      },

      syncWithSupabase: async () => {
        if (!isSupabaseConfigured || !supabase) return;
        set({ isSyncing: true });
        try {
          // 1. 同步孩子档案
          const { data: childrenData } = await supabase.from('children').select('*');
          if (childrenData && childrenData.length > 0) {
            set({
              children: childrenData.map(c => ({
                id: c.id,
                familyId: c.family_id,
                nickname: c.nickname,
                coinsBalance: c.coins_balance,
                avatarIcon: c.nickname.includes('果') ? '👧' : '👦',
              })),
            });
          }

          // 2. 同步设备列表
          const { data: devicesData } = await supabase.from('devices').select('*');
          if (devicesData && devicesData.length > 0) {
            set({
              devices: devicesData.map(d => ({
                id: d.id,
                familyId: d.family_id,
                childId: d.child_id,
                alias: d.alias || '桌面微雪设备',
                deviceModel: d.device_model || '微雪 ESP32-S3-Touch-LCD-2.8',
                macAddress: d.mac_address,
                status: d.status || 'paired',
                firmwareVersion: d.firmware_version || 'v1.0.0',
                lastSeenAt: '刚刚同步',
              })),
            });
          }

          // 3. 同步今日任务实例
          const todayStr = new Date().toISOString().split('T')[0];
          const { data: instancesData } = await supabase
            .from('task_instances')
            .select('*')
            .eq('target_date', todayStr);

          if (instancesData && instancesData.length > 0) {
            const { children, devices } = get();
            set({
              instances: instancesData.map(i => {
                const child = children.find(c => c.id === i.child_id);
                const device = devices.find(d => d.childId === i.child_id);
                return {
                  id: i.id,
                  templateId: i.template_id,
                  familyId: i.family_id,
                  childId: i.child_id,
                  childNickname: child?.nickname,
                  deviceId: i.device_id,
                  deviceAlias: device?.alias,
                  targetDate: i.target_date,
                  title: i.title,
                  description: i.description,
                  rewardCoins: i.reward_coins,
                  confirmType: i.confirm_type,
                  status: i.status,
                  submittedAt: i.submitted_at ? new Date(i.submitted_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : undefined,
                  reviewedAt: i.reviewed_at ? new Date(i.reviewed_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : undefined,
                  rejectReason: i.reject_reason,
                  rewardGranted: i.reward_granted,
                  createdAt: i.created_at,
                };
              }),
            });
          }
        } catch (err) {
          console.warn('Sync with Supabase failed:', err);
        } finally {
          set({ isSyncing: false });
        }
      },

      approveTask: async (instanceId: string) => {
        const { instances, children, family } = get();
        const task = instances.find(i => i.id === instanceId);
        if (!task) return { success: false, message: '找不到该任务' };

        if (task.status === 'completed' && task.rewardGranted) {
          return { success: true, message: '该任务先前已发放奖励', coins: 0 };
        }

        const targetChild = children.find(c => c.id === task.childId);
        if (!targetChild) return { success: false, message: '找不到该任务归属的孩子' };

        triggerHaptic(20);
        shootCoinsConfetti();

        const awardedCoins = task.rewardCoins;
        const newBalance = targetChild.coinsBalance + awardedCoins;
        const nowTimeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

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
          childId: targetChild.id,
          childNickname: targetChild.nickname,
          amount: awardedCoins,
          balanceAfter: newBalance,
          type: 'task_reward',
          description: `${targetChild.nickname} 完成任务: ${task.title} (家长批准)`,
          createdAt: `今天 ${nowTimeStr}`,
        };

        set({
          children: children.map(c => (c.id === targetChild.id ? { ...c, coinsBalance: newBalance } : c)),
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
          message: `审批通过！已向【${targetChild.nickname}】发放 +${awardedCoins} 金币`,
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

        const { children, devices } = get();
        const todayStr = getTodayStr();

        // 决定为哪些孩子生成今日任务实例
        const targetChildren = tpl.targetScope === 'all'
          ? children
          : children.filter(c => tpl.targetChildIds.includes(c.id));

        const newInstances: TaskInstance[] = targetChildren.map((child, idx) => {
          const device = devices.find(d => d.childId === child.id);
          return {
            id: `inst-${Date.now()}-${idx}`,
            templateId: id,
            familyId: tpl.familyId,
            childId: child.id,
            childNickname: child.nickname,
            deviceId: device?.id,
            deviceAlias: device?.alias,
            targetDate: todayStr,
            title: tpl.title,
            description: tpl.description,
            rewardCoins: tpl.rewardCoins,
            confirmType: tpl.confirmType,
            status: 'pending',
            rewardGranted: false,
            createdAt: new Date().toISOString(),
          };
        });

        set(state => ({
          templates: [newTemplate, ...state.templates],
          instances: [...newInstances, ...state.instances],
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

      pairDevice: async (pairCode: string, alias: string, childId: string) => {
        triggerHaptic(20);
        if (!/^\d{6}$/.test(pairCode)) {
          return { success: false, message: '请输入微雪屏幕上显示的 6 位纯数字配对码' };
        }

        const newDevice: Device = {
          id: `dev-${Date.now()}`,
          familyId: get().family.id,
          childId,
          alias: alias || '微雪 ESP32 桌面设备',
          deviceModel: '微雪 ESP32-S3-Touch-LCD-2.8',
          macAddress: `DC:54:75:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}`,
          status: 'paired',
          firmwareVersion: 'v1.0.2',
          lastSeenAt: '刚刚',
        };

        set(state => ({
          devices: [...state.devices, newDevice],
        }));

        return { success: true, message: `微雪设备【${newDevice.alias}】绑定成功！` };
      },

      unbindDevice: (deviceId: string) => {
        set(state => ({
          devices: state.devices.filter(d => d.id !== deviceId),
        }));
        triggerHaptic(20);
      },

      addChild: (nickname: string, avatarIcon = '🧒') => {
        const id = `child-${Date.now()}`;
        const newChild: Child = {
          id,
          familyId: get().family.id,
          nickname,
          coinsBalance: 0,
          avatarIcon,
        };

        const newPet: PetState = {
          id: `pet-${Date.now()}`,
          familyId: get().family.id,
          childId: id,
          petAvatar: '🦊',
          petName: `${nickname}的小狐狸`,
          foodCount: 1,
          waterCount: 1,
          updatedAt: new Date().toISOString(),
        };

        set(state => ({
          children: [...state.children, newChild],
          pets: { ...state.pets, [id]: newPet },
        }));
      },

      updateChildNickname: (childId: string, nickname: string) => {
        set(state => ({
          children: state.children.map(c => (c.id === childId ? { ...c, nickname } : c)),
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
          children: INITIAL_CHILDREN,
          devices: INITIAL_DEVICES,
          templates: INITIAL_TEMPLATES,
          instances: INITIAL_INSTANCES,
          transactions: INITIAL_TRANSACTIONS,
          pets: INITIAL_PETS,
          selectedChildId: 'all',
        });
      },
    }),
    {
      name: 'study_pet_parent_storage_v2', // v2 with multi-device support
    }
  )
);
