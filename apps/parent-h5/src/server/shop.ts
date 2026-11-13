import { ApiError } from './api';
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function shopInput(body: unknown): { name: string; price: number; action: string } {
  const item = body as Record<string, unknown> | null;
  if (typeof item?.name !== 'string' || !/^[A-Za-z0-9\u4e00-\u9fff _.-]{1,12}$/u.test(item.name.trim()) ||
      !Number.isInteger(item.price) || Number(item.price) < 1 || Number(item.price) > 10000 ||
      !['eat', 'drink', 'pet', 'happy'].includes(String(item.action))) {
    throw new ApiError(400, '名称限 1–12 个汉字、英文、数字或空格；价格限 1–10000 整数金币；请选择互动动画');
  }
  return { name: item.name.trim(), price: Number(item.price), action: String(item.action) };
}
export const shopFields = 'id,name,price,action,builtin_key,updated_at';
export function shopFailure(error: { code?: string } | null): never {
  if (error?.code === '23505') throw new ApiError(409, '已经有同名商品，请换个名字或编辑已有商品');
  if (error?.code === '54000') throw new ApiError(409, '最多保留 10 个商品，包含 Water 和 Food，请先删除其他商品');
  if (error?.code === '23514') throw new ApiError(400, '内置商品保留名称和动作，可调整价格');
  throw new ApiError(503, '商品暂时无法保存，请稍后重试');
}
