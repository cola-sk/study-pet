-- ==============================================================================
-- 学习任务养成宠物系统 - Supabase PostgreSQL 数据表设计 (支持多孩子、多设备)
-- ==============================================================================

-- 1. 家庭表 (families)
CREATE TABLE IF NOT EXISTS public.families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL DEFAULT '学习成长家庭',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Shanghai',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 家长/用户 Profile 表 (parents)
CREATE TABLE IF NOT EXISTS public.parents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
    phone VARCHAR(30),
    nickname VARCHAR(50) NOT NULL DEFAULT '小主人家长',
    role VARCHAR(20) NOT NULL DEFAULT 'parent',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 孩子档案表 (children) - 支持多孩子
CREATE TABLE IF NOT EXISTS public.children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    nickname VARCHAR(50) NOT NULL DEFAULT '天天',
    coins_balance INT NOT NULL DEFAULT 0 CHECK (coins_balance >= 0),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 硬件设备表 (devices) - 支持多台微雪 ESP32-S3-Touch-LCD-2.8
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
    child_id UUID REFERENCES public.children(id) ON DELETE SET NULL, -- 归属的具体孩子
    alias VARCHAR(50) NOT NULL DEFAULT '桌面微雪设备',             -- 设备别名 (如：天天桌面、果果书桌)
    device_model VARCHAR(100) NOT NULL DEFAULT 'Waveshare ESP32-S3-Touch-LCD-2.8',
    mac_address VARCHAR(50) UNIQUE,
    pair_code VARCHAR(10),
    pair_code_expires_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'unpaired', -- 'unpaired' | 'paired'
    firmware_version VARCHAR(30) DEFAULT '1.0.0',
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. 任务模板表 (task_templates) - 支持全员/指定设备布置
CREATE TABLE IF NOT EXISTS public.task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    reward_coins INT NOT NULL DEFAULT 10 CHECK (reward_coins > 0),
    confirm_type VARCHAR(20) NOT NULL DEFAULT 'parent_confirm', -- 'parent_confirm' | 'auto_confirm'
    frequency_type VARCHAR(20) NOT NULL DEFAULT 'daily',        -- 'daily' | 'weekly_days' | 'interval_days'
    frequency_config JSONB NOT NULL DEFAULT '{}'::jsonb,        -- {"days": [1,3,5]} 或 {"interval": 2, "base_date": "2026-11-12"}
    target_scope VARCHAR(20) NOT NULL DEFAULT 'all',            -- 'all' (全体设备/孩子) | 'specific' (指定孩子/设备)
    target_child_ids JSONB NOT NULL DEFAULT '[]'::jsonb,        -- 当 target_scope 为 specific 时的目标孩子 ID 列表
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. 每日任务实例表 (task_instances) - 每个设备/孩子拥有专属实例
CREATE TABLE IF NOT EXISTS public.task_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.task_templates(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    target_date DATE NOT NULL,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    reward_coins INT NOT NULL DEFAULT 10,
    confirm_type VARCHAR(20) NOT NULL DEFAULT 'parent_confirm',
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'submitted' | 'completed' | 'rejected'
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reject_reason TEXT,
    reward_granted BOOLEAN NOT NULL DEFAULT FALSE,
    client_request_id TEXT, -- 用于幂等防重
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_template_child_date UNIQUE (template_id, child_id, target_date)
);

-- 7. 金币账本流水表 (wallet_transactions)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    amount INT NOT NULL, -- 正数为入账，负数为支出
    balance_after INT NOT NULL,
    type VARCHAR(30) NOT NULL, -- 'task_reward' | 'shop_purchase'
    description TEXT NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. 商店物品字典表 (shop_items)
CREATE TABLE IF NOT EXISTS public.shop_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL,
    category VARCHAR(20) NOT NULL, -- 'food' | 'water' | 'clothes'
    price INT NOT NULL CHECK (price >= 0),
    icon TEXT NOT NULL DEFAULT '',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_items ALTER COLUMN icon SET DEFAULT '';

-- 9. 宠物状态与背包装扮表 (pet_states) - 每个孩子拥有独立宠物
CREATE TABLE IF NOT EXISTS public.pet_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    current_clothes_item_id UUID REFERENCES public.shop_items(id) ON DELETE SET NULL,
    food_count INT NOT NULL DEFAULT 0,
    water_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_pet_child UNIQUE (child_id)
);

-- ==============================================================================
-- 核心业务存储过程 (RPC)：原子发币与防重保证
-- ==============================================================================

-- 1. 家长审批任务并发放金币 (原子事务，精确发放给该任务归属的孩子)
CREATE OR REPLACE FUNCTION public.approve_task_and_reward(
    p_instance_id UUID,
    p_request_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_task RECORD;
    v_new_balance INT;
BEGIN
    SELECT * INTO v_task 
    FROM public.task_instances 
    WHERE id = p_instance_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', '任务实例不存在');
    END IF;

    IF v_task.status = 'completed' AND v_task.reward_granted = TRUE THEN
        RETURN jsonb_build_object('success', true, 'message', '该任务先前已发币，无需重复发放', 'coins_awarded', 0);
    END IF;

    IF v_task.status != 'submitted' THEN
        RETURN jsonb_build_object('success', false, 'message', '当前任务状态不可审批: ' || v_task.status);
    END IF;

    UPDATE public.task_instances
    SET status = 'completed',
        reward_granted = TRUE,
        reviewed_at = now(),
        client_request_id = COALESCE(p_request_id, client_request_id),
        updated_at = now()
    WHERE id = p_instance_id;

    UPDATE public.children
    SET coins_balance = coins_balance + v_task.reward_coins,
        updated_at = now()
    WHERE id = v_task.child_id
    RETURNING coins_balance INTO v_new_balance;

    INSERT INTO public.wallet_transactions (
        family_id,
        child_id,
        amount,
        balance_after,
        type,
        description,
        reference_id
    ) VALUES (
        v_task.family_id,
        v_task.child_id,
        v_task.reward_coins,
        v_new_balance,
        'task_reward',
        '完成任务: ' || v_task.title || ' (家长已确认)',
        p_instance_id::text
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', '审批通过，已发币给对应孩子',
        'coins_awarded', v_task.reward_coins,
        'new_balance', v_new_balance
    );
END;
$$;

-- 2. 家长驳回任务
CREATE OR REPLACE FUNCTION public.reject_task(
    p_instance_id UUID,
    p_reason TEXT DEFAULT '未达到完成标准'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.task_instances
    SET status = 'rejected',
        reject_reason = p_reason,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_instance_id AND status = 'submitted';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', '任务不在待审批状态');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', '任务已驳回，允许重新提交');
END;
$$;

-- ==============================================================================
-- 初始字典与演示数据注入
-- ==============================================================================

-- 注入商城道具字典
INSERT INTO public.shop_items AS existing_items (id, name, category, price, icon, description) VALUES
('00000000-0000-0000-0000-000000000001', '新鲜小苹果', 'food', 5, '', '脆甜多汁的小红富士'),
('00000000-0000-0000-0000-000000000002', '美味小蛋糕', 'food', 12, '', '香甜草莓奶油蛋糕'),
('00000000-0000-0000-0000-000000000003', '纯净矿泉水', 'water', 5, '', '清凉解渴矿泉水'),
('00000000-0000-0000-0000-000000000004', '清凉椰子汁', 'water', 10, '', '天然甘甜椰子水'),
('00000000-0000-0000-0000-000000000005', '水手服套装', 'clothes', 40, '', '帅气精神的水手校服'),
('00000000-0000-0000-0000-000000000006', '恐龙连体衣', 'clothes', 60, '', '超萌绿色小恐龙')
-- 清除旧演示商品里的固定 emoji；其他已有图标（包括手动设置的图标）保持不变。
ON CONFLICT (id) DO UPDATE SET icon = EXCLUDED.icon
WHERE existing_items.icon IN ('🍎', '🍰', '💧', '🥥', '👔', '🦖');

-- 权限授予 (保证 anon 公开读写用于开发与设备同步)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
