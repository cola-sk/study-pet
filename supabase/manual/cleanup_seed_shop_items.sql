-- 在确认连接的是正确的 Supabase 项目后手动执行。
-- 仅删除 schema.sql 曾插入、且名称/类别/价格仍与预制值一致的商品。
-- 正在被宠物穿戴的商品保留，避免外键 ON DELETE SET NULL 修改宠物数据。
-- 不删除孩子、任务、设备、余额或其他商品。
BEGIN;
WITH seed(id, name, category, price, description) AS (
  VALUES
    ('00000000-0000-0000-0000-000000000001'::uuid, '新鲜小苹果', 'food', 5, '脆甜多汁的小红富士'),
    ('00000000-0000-0000-0000-000000000002'::uuid, '美味小蛋糕', 'food', 12, '香甜草莓奶油蛋糕'),
    ('00000000-0000-0000-0000-000000000003'::uuid, '纯净矿泉水', 'water', 5, '清凉解渴矿泉水'),
    ('00000000-0000-0000-0000-000000000004'::uuid, '清凉椰子汁', 'water', 10, '天然甘甜椰子水')
)
DELETE FROM public.shop_items AS item
USING seed
WHERE item.id = seed.id AND item.name = seed.name
  AND item.category = seed.category AND item.price = seed.price
  AND item.description = seed.description AND item.icon = ''
  AND NOT EXISTS (SELECT 1 FROM public.pet_states p WHERE p.current_clothes_item_id = item.id)
RETURNING item.id, item.name;
COMMIT;
