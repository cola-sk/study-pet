import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Family, Child, Device, TaskTemplate, TaskInstance, PetState } from '../services/types';
import { familyApi } from '../services/familyApi';
import { readUserCache, writeUserCache } from '../services/localCache';

export const isRemoteId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
type Draft = Omit<TaskTemplate, 'id' | 'createdAt'>;
type ReviewResult = { success: boolean; message: string; coins?: number };
const emptyFamily: Family = { id: '', name: '', timezone: 'Asia/Shanghai', createdAt: '' };
const TASKS_CACHE_KEY = 'tasks_state';
type CachedTasksState = {
  family: Family; children: Child[]; devices: Device[]; templates: TaskTemplate[];
  instances: TaskInstance[]; todayDate: string; selectedChildId: string;
};
const message = (e: unknown) => e instanceof Error ? e.message : '请求失败，请重试';
let epoch = 0;
let refreshing: Promise<void> | null = null;
function template(t: any): TaskTemplate {
  return { id: t.id, familyId: t.family_id, title: t.title, description: t.description || '', rewardCoins: t.reward_coins,
    confirmType: t.confirm_type, frequencyType: t.frequency_type, frequencyConfig: { ...t.frequency_config, baseDate: t.frequency_config?.base_date },
    targetScope: t.target_scope, targetChildIds: t.target_child_ids || [], isActive: t.is_active, startDate: t.start_date, endDate: t.end_date,
    createdAt: t.created_at, updatedAt: t.updated_at };
}
function persistTasksCache(userId: string, state: CachedTasksState) {
  if (!userId || !state.todayDate) return;
  writeUserCache<CachedTasksState>(userId, TASKS_CACHE_KEY, {
    family: state.family, children: state.children, devices: state.devices,
    templates: state.templates, instances: state.instances, todayDate: state.todayDate,
    selectedChildId: state.selectedChildId,
  });
}
interface AppState {
  activeUserId: string;
  family: Family; children: Child[]; devices: Device[]; templates: TaskTemplate[]; instances: TaskInstance[];
  pets: Record<string, PetState>; legacyTemplates: TaskTemplate[]; selectedChildId: string; todayDate: string;
  isSyncing: boolean; backgroundSyncCount: number; taskError: string;
  setSelectedChildId: (id: string) => void;
  beginBackgroundSync: () => () => void;
  hydrateForUser: (userId: string) => void;
  loadTaskData: (force?: boolean) => Promise<void>;
  resetRemoteState: () => void;
  addTemplate: (draft: Draft, requestId: string) => Promise<void>;
  updateTemplate: (id: string, updates: Partial<TaskTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  toggleTemplate: (id: string) => Promise<void>;
  discardLegacyTemplate: (id: string) => void;
  approveTask: (id: string) => Promise<ReviewResult>;
  rejectTask: (id: string, reason: string) => Promise<ReviewResult>;
  pairDevice: (code: string, alias: string, childId: string) => Promise<ReviewResult>;
}
export const useAppStore = create<AppState>()(persist((set, get) => ({
  activeUserId: '',
  family: emptyFamily, children: [], devices: [], templates: [], instances: [], pets: {}, legacyTemplates: [],
  selectedChildId: 'all', todayDate: '', isSyncing: false, backgroundSyncCount: 0, taskError: '',
  setSelectedChildId: selectedChildId => {
    set({ selectedChildId });
    persistTasksCache(get().activeUserId, get());
  },
  beginBackgroundSync: () => {
    let finished = false;
    set(state => ({ backgroundSyncCount: state.backgroundSyncCount + 1 }));
    return () => {
      if (finished) return;
      finished = true;
      set(state => ({ backgroundSyncCount: Math.max(0, state.backgroundSyncCount - 1) }));
    };
  },
  hydrateForUser: userId => {
    if (!userId) { get().resetRemoteState(); return; }
    if (get().activeUserId === userId) return;
    epoch++; refreshing = null;
    const cached = readUserCache<CachedTasksState>(userId, TASKS_CACHE_KEY);
    if (cached && Array.isArray(cached.children) && Array.isArray(cached.templates) && Array.isArray(cached.instances)) {
      set({
        activeUserId: userId,
        family: cached.family || emptyFamily,
        children: cached.children,
        devices: Array.isArray(cached.devices) ? cached.devices : [],
        templates: cached.templates,
        instances: cached.instances,
        todayDate: cached.todayDate || '',
        selectedChildId: cached.selectedChildId || 'all',
        taskError: '',
        isSyncing: false,
      });
      return;
    }
    set({ activeUserId: userId, family: emptyFamily, children: [], devices: [], templates: [], instances: [], selectedChildId: 'all', todayDate: '', taskError: '', isSyncing: false });
  },
  resetRemoteState: () => {
    epoch++; refreshing = null;
    set({ activeUserId: '', family: emptyFamily, children: [], devices: [], templates: [], instances: [], selectedChildId: 'all', todayDate: '', taskError: '', isSyncing: false });
  },
  loadTaskData: async (force = false) => {
    const currentEpoch = epoch;
    if (refreshing) {
      if (!force) return refreshing;
      await refreshing;
      if (currentEpoch !== epoch) return;
    }
    set({ isSyncing: true });
    const operation = (async () => {
      try {
        const data = await familyApi<any>('/api/v1/family/tasks');
        if (currentEpoch !== epoch) return;
        const children: Child[] = data.children.map((c: any) => ({ id: c.id, familyId: c.family_id, nickname: c.nickname, coinsBalance: c.coins_balance, avatarUrl: c.avatar_url }));
        const devices: Device[] = data.devices.map((d: any) => ({ id: d.id, familyId: d.family_id, childId: d.child_id, alias: d.alias || '哈小伴', status: d.status, deviceModel: d.device_model, firmwareVersion: d.firmware_version, lastSeenAt: d.last_seen_at }));
        set({ family: { id: data.family.id, name: data.family.name, timezone: data.family.timezone, createdAt: data.family.created_at }, children, devices,
          todayDate: data.date, templates: data.templates.map(template), taskError: '',
          selectedChildId: get().selectedChildId === 'all' || children.some(c => c.id === get().selectedChildId) ? get().selectedChildId : 'all',
          instances: data.instances.map((i: any) => ({ id: i.id, templateId: i.template_id, familyId: i.family_id, childId: i.child_id,
            childNickname: children.find(c => c.id === i.child_id)?.nickname, deviceId: i.device_id,
            deviceAlias: devices.find(d => d.id === i.device_id || d.childId === i.child_id)?.alias,
            targetDate: i.target_date, title: i.title, description: i.description, rewardCoins: i.reward_coins,
            confirmType: i.confirm_type, status: i.status, submittedAt: i.submitted_at, reviewedAt: i.reviewed_at,
            rejectReason: i.reject_reason, rewardGranted: i.reward_granted, createdAt: i.created_at })) });
        persistTasksCache(get().activeUserId, get());
      } catch (e) { if (currentEpoch === epoch) set({ taskError: message(e) }); }
      finally { if (currentEpoch === epoch) set({ isSyncing: false }); }
    })();
    refreshing = operation;
    await operation;
    if (refreshing === operation) refreshing = null;
  },
  addTemplate: async (draft, requestId) => {
    const startEpoch = epoch;
    const result = await familyApi<{ template: any }>('/api/v1/task-templates', { method: 'POST', body: JSON.stringify({ ...draft, requestId }) });
    if (epoch !== startEpoch) return;
    set(s => ({ templates: [template(result.template), ...s.templates.filter(t => t.id !== result.template.id)] }));
    await get().loadTaskData(true);
  },
  updateTemplate: async (id, updates) => {
    const startEpoch = epoch;
    const result = await familyApi<{ template: any }>(`/api/v1/task-templates/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    if (epoch !== startEpoch) return;
    set(s => ({ templates: s.templates.map(t => t.id === id ? template(result.template) : t) }));
    await get().loadTaskData(true);
  },
  deleteTemplate: async id => {
    const startEpoch = epoch;
    await familyApi(`/api/v1/task-templates/${id}`, { method: 'DELETE' });
    if (epoch !== startEpoch) return;
    set(s => ({ templates: s.templates.filter(t => t.id !== id) }));
    await get().loadTaskData(true);
  },
  toggleTemplate: async id => {
    const t = get().templates.find(t => t.id === id);
    if (t) await get().updateTemplate(id, { isActive: !t.isActive, updatedAt: t.updatedAt });
  },
  discardLegacyTemplate: id => set(s => ({ legacyTemplates: s.legacyTemplates.filter(t => t.id !== id) })),
  approveTask: async id => {
    try {
      const startEpoch = epoch;
      const r = await familyApi<{ coinsAwarded: number }>(`/api/v1/family/tasks/${id}/review`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) });
      if (epoch !== startEpoch) return { success: false, message: '账号已切换，请刷新' };
      await get().loadTaskData(true);
      return { success: true, message: r.coinsAwarded ? `已确认，奖励 +${r.coinsAwarded} 金币` : '此前已发放奖励', coins: r.coinsAwarded };
    } catch (e) { return { success: false, message: message(e) }; }
  },
  rejectTask: async (id, reason) => {
    try {
      const startEpoch = epoch;
      await familyApi(`/api/v1/family/tasks/${id}/review`, { method: 'POST', body: JSON.stringify({ action: 'reject', reason }) });
      if (epoch !== startEpoch) return { success: false, message: '账号已切换，请刷新' };
      await get().loadTaskData(true);
      return { success: true, message: '已发送鼓励提示，宝贝可重新打卡' };
    } catch (e) { return { success: false, message: message(e) }; }
  },
  pairDevice: async () => ({ success: false, message: '请从家庭设备页面点击添加设备，按步骤配对' }),
}), {
  name: 'study_pet_parent_storage_v2', version: 3,
  partialize: s => ({ pets: s.pets, legacyTemplates: s.legacyTemplates }),
  migrate: (persisted: any) => ({ pets: persisted?.pets || {}, legacyTemplates: persisted?.legacyTemplates || (persisted?.templates || []).filter((t: TaskTemplate) => !isRemoteId(t.id) && !['tpl-1','tpl-2','tpl-3'].includes(t.id)) }),
}));
