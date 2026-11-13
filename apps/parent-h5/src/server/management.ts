import { ApiError } from './api';

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function profileName(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 50 || /[\u0000-\u001f\u007f]/.test(value)) throw new ApiError(400, `${label}需为 1–50 个字符`);
  return value.trim();
}
export function deviceVersion(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new ApiError(400, '设备信息已过期，请刷新后重试');
  return value;
}
export function managementFailure(error: { code?: string } | null): void {
  if (!error) return;
  if (error.code === 'P0002') throw new ApiError(404, '设备或宝贝不存在，请刷新列表');
  if (error.code === '40001') throw new ApiError(409, '设备信息已变化，请刷新后重试');
  if (error.code === '22023') throw new ApiError(400, '请检查输入内容');
  throw new ApiError(503, '暂时无法更新，请稍后重试');
}
