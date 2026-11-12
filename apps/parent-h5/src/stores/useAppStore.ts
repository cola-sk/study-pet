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

// 商品由用户自行录入。
const DEFAULT_SHOP_ITEMS: ShopItem[] = [];

// One-time cleanup for emoji that older demo data injected into persisted profiles.
const LEGACY_DEFAULT_CHILD_AVATARS = new Set(['👦', '👧', '🧒']);
const LEGACY_DEFAULT_PET_AVATARS = new Set(['🐶', '🐱', '🦊']);
const LEGACY_DEFAULT_SHOP_ICONS = new Set(['🍎', '🍰', '💧', '🥥', '👔', '🦖']);

const INITIAL_FAMILY: Family = {
  id: 'fam-101',
  name: '快乐学习小家',
  timezone: 'Asia/Shanghai',
  createdAt: '2026-11-12T08:00:00Z',
};

// 新安装不创建演示孩子、设备、任务或流水。
const INITIAL_CHILDREN: Child[] = [];
const INITIAL_DEVICES: Device[] = [];
const INITIAL_PETS: Record<string, PetState> = {};
const INITIAL_TEMPLATES: TaskTemplate[] = [];
const INITIAL_INSTANCES: TaskInstance[] = [];
const INITIAL_TRANSACTIONS: WalletTransaction[] = [];
const getTodayStr = () => new Date().toISOString().split('T')[0];

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
            const localChildren = get().children;
            set({
              children: childrenData.map(c => {
                const localChild = localChildren.find(child => child.id === c.id);
                return {
                  id: c.id,
                  familyId: c.family_id,
                  nickname: c.nickname,
                  coinsBalance: c.coins_balance,
                  avatarUrl: c.avatar_url || localChild?.avatarUrl,
                  avatarIcon: localChild?.avatarIcon,
                };
              }),
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

      pairDevice: async (pairCode: string) => {
        if (!/^\d{6}$/.test(pairCode)) {
          return { success: false, message: '请输入设备显示的 6 位配对码' };
        }
        // 配对服务尚未实现：绝不能把随机生成的本地设备当成真实设备。
        return { success: false, message: '真实设备配对服务尚未接入，请稍后重试' };
      },

      unbindDevice: (deviceId: string) => {
        set(state => ({
          devices: state.devices.filter(d => d.id !== deviceId),
        }));
        triggerHaptic(20);
      },

      addChild: (nickname: string, avatarIcon?: string) => {
        const id = `child-${Date.now()}`;
        const newChild: Child = {
          id,
          familyId: get().family.id,
          nickname,
          coinsBalance: 0,
          avatarIcon: avatarIcon || undefined,
        };

        const newPet: PetState = {
          id: `pet-${Date.now()}`,
          familyId: get().family.id,
          childId: id,
          petName: `${nickname}的小宠`,
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
      version: 2,
      migrate: (persistedState, _version) => {
        const state = persistedState as AppState;
        // 仅移除旧版本固定 ID 的演示记录；用户新建记录保留。
        const demoChildren = new Set(['child-101', 'child-102']);
        const demoDevices = new Set(['dev-101', 'dev-102']);
        const demoTemplates = new Set(['tpl-1', 'tpl-2', 'tpl-3']);
        const demoInstances = new Set(['inst-1', 'inst-2', 'inst-3', 'inst-4']);
        const demoTransactions = new Set(['tx-1', 'tx-2']);
        const demoShopItems = new Set(['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6']);
        return {
          ...state,
          devices: (state.devices || []).filter(device => !demoDevices.has(device.id)),
          templates: (state.templates || []).filter(template => !demoTemplates.has(template.id)),
          instances: (state.instances || []).filter(instance => !demoInstances.has(instance.id)),
          transactions: (state.transactions || []).filter(transaction => !demoTransactions.has(transaction.id)),
          selectedChildId: demoChildren.has(state.selectedChildId) ? 'all' : state.selectedChildId,
          children: (state.children || []).filter(child => !demoChildren.has(child.id)).map(child => ({
            ...child,
            avatarIcon: LEGACY_DEFAULT_CHILD_AVATARS.has(child.avatarIcon || '')
              ? undefined
              : child.avatarIcon,
          })),
          pets: Object.fromEntries(
            Object.entries(state.pets || {}).filter(([childId, pet]) => !(demoChildren.has(childId) && ['pet-101', 'pet-102'].includes(pet.id))).map(([childId, pet]) => [
              childId,
              {
                ...pet,
                petAvatar: LEGACY_DEFAULT_PET_AVATARS.has(pet.petAvatar || '')
                  ? undefined
                  : pet.petAvatar,
                currentClothesItem: pet.currentClothesItem && LEGACY_DEFAULT_SHOP_ICONS.has(pet.currentClothesItem.icon || '')
                  ? { ...pet.currentClothesItem, icon: undefined }
                  : pet.currentClothesItem,
              },
            ])
          ),
          shopItems: (state.shopItems || []).filter(item => !demoShopItems.has(item.id)).map(item => LEGACY_DEFAULT_SHOP_ICONS.has(item.icon || '')
            ? { ...item, icon: undefined }
            : item),
        };
      },
    }
  )
);
