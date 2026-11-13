import { ApiError } from './api';
import { uuid } from './shop';
export const taskTemplateFields = 'id,family_id,title,description,reward_coins,confirm_type,frequency_type,frequency_config,target_scope,target_child_ids,is_active,start_date,end_date,created_at,updated_at';
export function taskInput(value: unknown) {
  const b = value as Record<string, any> | null;
  if (!b || typeof b.title !== 'string' || !b.title.trim() || [...b.title.trim()].length > 40 ||
      (b.description !== undefined && typeof b.description !== 'string') || [...(b.description || '')].length > 200 ||
      !Number.isInteger(b.rewardCoins) || b.rewardCoins < 1 || b.rewardCoins > 10000 ||
      !['auto_confirm', 'parent_confirm'].includes(b.confirmType) || !['daily', 'weekly_days', 'interval_days'].includes(b.frequencyType) ||
      !['all', 'specific'].includes(b.targetScope) || (b.isActive !== undefined && typeof b.isActive !== 'boolean')) {
    throw new ApiError(400, '名称限 1–40 字、说明限 200 字、奖励限 1–10000 整数；请选择频率和确认方式');
  }
  const config = b.frequencyConfig || {};
  let frequencyConfig: Record<string, unknown> = {};
  if (b.frequencyType === 'weekly_days') {
    if (!Array.isArray(config.days) || !config.days.length || config.days.some((d: unknown) => !Number.isInteger(d) || Number(d) < 1 || Number(d) > 7)) throw new ApiError(400, '请至少选择一个有效的星期');
    frequencyConfig = { days: [...new Set<number>(config.days)].sort() };
  } else if (b.frequencyType === 'interval_days') {
    if (!Number.isInteger(config.interval) || config.interval < 1 || config.interval > 365) throw new ApiError(400, '间隔应为 1–365 天');
    frequencyConfig = { interval: config.interval, ...(config.baseDate ? { base_date: validDate(config.baseDate) } : {}) };
  }
  const targets = b.targetScope === 'all' ? [] : b.targetChildIds;
  if (!Array.isArray(targets) || (b.targetScope === 'specific' && !targets.length) || targets.some(id => typeof id !== 'string' || !uuid.test(id))) throw new ApiError(400, '请选择本家庭的宝贝');
  const start = b.startDate ? validDate(b.startDate) : null, end = b.endDate ? validDate(b.endDate) : null;
  if (start && end && end < start) throw new ApiError(400, '结束日期不能早于开始日期');
  return { title: b.title.trim(), description: b.description || '', reward_coins: b.rewardCoins, confirm_type: b.confirmType,
    frequency_type: b.frequencyType, frequency_config: frequencyConfig, target_scope: b.targetScope,
    target_child_ids: [...new Set(targets)], is_active: b.isActive ?? true, start_date: start, end_date: end };
}
function validDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new ApiError(400, '日期格式应为有效的 YYYY-MM-DD');
  return value;
}
export function templateInput(t: Record<string, any>) {
  return { title: t.title, description: t.description || '', rewardCoins: t.reward_coins, confirmType: t.confirm_type,
    frequencyType: t.frequency_type, frequencyConfig: { ...t.frequency_config, baseDate: t.frequency_config?.base_date },
    targetScope: t.target_scope, targetChildIds: t.target_child_ids, isActive: t.is_active, startDate: t.start_date, endDate: t.end_date };
}
export function taskFailure(error: { code?: string } | null): never {
  if (error?.code === '40001') throw new ApiError(409, '任务已被修改，请刷新后再编辑');
  if (error?.code === 'P0002') throw new ApiError(404, '任务不存在或已移除');
  if (error?.code === '54000') throw new ApiError(409, '每个家庭最多保留 50 个任务模板，请先移除不用的模板');
  if (['23514', '22P02', '22007', '22008'].includes(error?.code || '')) throw new ApiError(400, '任务配置无效，请检查日期、频率和宝贝归属');
  if (error?.code === '23505') throw new ApiError(409, '保存请求已使用，请关闭后重新新建任务');
  throw new ApiError(503, '任务服务暂时不可用');
}
