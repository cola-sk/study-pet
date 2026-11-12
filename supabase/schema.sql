-- ==============================================================================
-- 学习任务养成宠物系统 - Supabase PostgreSQL 数据表设计方案
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

-- 3. 孩子档案表 (children)
CREATE TABLE IF NOT EXISTS public.children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    nickname VARCHAR(50) NOT NULL DEFAULT '天天',
    coins_balance INT NOT NULL DEFAULT 0 CHECK (coins_balance >= 0),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 硬件设备表 (devices) - 对应微雪 ESP32-S3-Touch-LCD-2.8
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
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

-- 5. 任务模板表 (task_templates)
CREATE TABLE IF NOT EXISTS public.task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    reward_coins INT NOT NULL DEFAULT 10 CHECK (reward_coins > 0),
    confirm_type VARCHAR(20) NOT NULL DEFAULT 'parent_confirm', -- 'parent_confirm' | 'auto_confirm'
    frequency_type VARCHAR(20) NOT NULL DEFAULT 'daily',        -- 'daily' | 'weekly_days' | 'interval_days'
    frequency_config JSONB NOT NULL DEFAULT '{}'::jsonb,        -- {"days": [1,3,5]} 或 {"interval": 2, "base_date": "2026-11-12"}
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. 每日任务实例表 (task_instances)
CREATE TABLE IF NOT EXISTS public.task_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.task_templates(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    reward_coins INT NOT NULL DEFAULT 10,
    confirm_type VARCHAR(20) NOT NULL DEFAULT 'parent_confirm',
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' (待完成) | 'submitted' (待家长确认) | 'completed' (已完成发币) | 'rejected' (已驳回待重做)
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reject_reason TEXT,
    reward_granted BOOLEAN NOT NULL DEFAULT FALSE,
    client_request_id TEXT, -- 用于幂等防重
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_template_date UNIQUE (template_id, target_date)
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
    icon TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. 宠物状态与背包装扮表 (pet_states)
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

-- 1. 家长审批任务并发放金币 (原子事务)
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
    -- 查询并加锁任务实例
    SELECT * INTO v_task 
    FROM public.task_instances 
    WHERE id = p_instance_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', '任务实例不存在');
    END IF;

    -- 如果已经发放过奖励，直接幂等返回成功
    IF v_task.status = 'completed' AND v_task.reward_granted = TRUE THEN
        RETURN jsonb_build_object('success', true, 'message', '任务先前已审批发币，无需重复发放', 'coins_awarded', 0);
    END IF;

    -- 仅允许处于 submitted 状态的任务被批准
    IF v_task.status != 'submitted' THEN
        RETURN jsonb_build_object('success', false, 'message', '当前任务状态不可审批: ' || v_task.status);
    END IF;

    -- 更新任务状态为已完成
    UPDATE public.task_instances
    SET status = 'completed',
        reward_granted = TRUE,
        reviewed_at = now(),
        client_request_id = COALESCE(p_request_id, client_request_id),
        updated_at = now()
    WHERE id = p_instance_id;

    -- 增加孩子金币余额
    UPDATE public.children
    SET coins_balance = coins_balance + v_task.reward_coins,
        updated_at = now()
    WHERE id = v_task.child_id
    RETURNING coins_balance INTO v_new_balance;

    -- 记录金币流水
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
        'message', '审批通过，已成功发币',
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

-- 3. 初始演示数据注入 (开发与测试便捷)
INSERT INTO public.shop_items (name, category, price, icon, description) VALUES
('新鲜小苹果', 'food', 5, '🍎', '宠物喜欢的脆甜红富士苹果'),
('美味小蛋糕', 'food', 12, '🍰', '香甜草莓奶油蛋糕'),
('纯净矿泉水', 'water', 5, '💧', '解渴纯净水'),
('清凉椰子汁', 'water', 10, '🥥', '天然香甜椰汁'),
('水手服套装', 'clothes', 40, '👔', '清爽帅气的水手服'),
('恐龙连体衣', 'clothes', 60, '🦖', '软萌可爱的绿色恐龙睡衣')
ON CONFLICT DO NOTHING;
