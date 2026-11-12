'use client';

import React, { useState } from 'react';
import { Popup, Input, TextArea, Stepper, Selector, Button, Toast } from 'antd-mobile';
import { TaskTemplate, ConfirmType, FrequencyType, TargetScope } from '../../services/types';
import { useAppStore } from '../../stores/useAppStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialTemplate?: TaskTemplate | null;
}

const WEEKDAY_OPTIONS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
];

export const TaskFormModal: React.FC<Props> = ({ visible, onClose, initialTemplate }) => {
  const { family, children, addTemplate, updateTemplate } = useAppStore();

  const [title, setTitle] = useState(initialTemplate?.title || '');
  const [description, setDescription] = useState(initialTemplate?.description || '');
  const [rewardCoins, setRewardCoins] = useState<number>(initialTemplate?.rewardCoins || 10);
  const [confirmType, setConfirmType] = useState<ConfirmType>(initialTemplate?.confirmType || 'parent_confirm');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>(initialTemplate?.frequencyType || 'daily');
  const [selectedDays, setSelectedDays] = useState<number[]>(initialTemplate?.frequencyConfig.days || [1, 3, 5]);
  const [intervalDays, setIntervalDays] = useState<number>(initialTemplate?.frequencyConfig.interval || 2);
  const [targetScope, setTargetScope] = useState<TargetScope>(initialTemplate?.targetScope || 'all');
  const [targetChildIds, setTargetChildIds] = useState<string[]>(initialTemplate?.targetChildIds || (children[0] ? [children[0].id] : []));

  React.useEffect(() => {
    if (initialTemplate) {
      setTitle(initialTemplate.title);
      setDescription(initialTemplate.description || '');
      setRewardCoins(initialTemplate.rewardCoins);
      setConfirmType(initialTemplate.confirmType);
      setFrequencyType(initialTemplate.frequencyType);
      setSelectedDays(initialTemplate.frequencyConfig.days || [1, 3, 5]);
      setIntervalDays(initialTemplate.frequencyConfig.interval || 2);
      setTargetScope(initialTemplate.targetScope || 'all');
      setTargetChildIds(initialTemplate.targetChildIds || []);
    } else {
      setTitle('');
      setDescription('');
      setRewardCoins(10);
      setConfirmType('parent_confirm');
      setFrequencyType('daily');
      setSelectedDays([1, 3, 5]);
      setIntervalDays(2);
      setTargetScope('all');
      setTargetChildIds(children.length > 0 ? [children[0].id] : []);
    }
  }, [initialTemplate, visible, children]);

  const handleSubmit = () => {
    if (!title.trim()) {
      Toast.show({ icon: 'fail', content: '请输入任务名称' });
      return;
    }

    if (frequencyType === 'weekly_days' && selectedDays.length === 0) {
      Toast.show({ icon: 'fail', content: '请至少选择一个星期周期' });
      return;
    }

    if (targetScope === 'specific' && targetChildIds.length === 0) {
      Toast.show({ icon: 'fail', content: '请至少选择一个指派的孩子/设备' });
      return;
    }

    const payload = {
      familyId: family.id,
      title: title.trim(),
      description: description.trim(),
      rewardCoins,
      confirmType,
      frequencyType,
      frequencyConfig: {
        ...(frequencyType === 'weekly_days' ? { days: selectedDays } : {}),
        ...(frequencyType === 'interval_days' ? { interval: intervalDays } : {}),
      },
      targetScope,
      targetChildIds: targetScope === 'specific' ? targetChildIds : [],
      isActive: true,
    };

    if (initialTemplate) {
      updateTemplate(initialTemplate.id, payload);
      Toast.show({ icon: 'success', content: '任务模板已更新' });
    } else {
      addTemplate(payload);
      Toast.show({ icon: 'success', content: '已新建任务并分发至各设备' });
    }

    onClose();
  };

  const childOptions = children.map(c => ({
    label: `${c.avatarIcon || '🧒'} ${c.nickname}`,
    value: c.id,
  }));

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="bottom"
      bodyStyle={{
        height: '82vh',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        background: '#F7F5F0',
      }}
    >
      <div className="flex flex-col h-full text-[#2D2621]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-white border-b border-[#EAE5DC] flex items-center justify-between rounded-t-3xl">
          <h3 className="font-bold text-[#2D2621] text-base">
            {initialTemplate ? '编辑任务模板' : '创建新任务模板'}
          </h3>
          <button onClick={onClose} className="text-sm text-[#7D7267] hover:text-[#2D2621] px-2 py-1">
            取消
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-3.5 text-sm">
          {/* 布置目标范围（核心多设备支持） */}
          <div className="bg-white rounded-3xl p-4 border border-[#EAE5DC] shadow-[0_2px_8px_rgba(60,48,36,0.03)] space-y-2.5">
            <label className="font-bold text-[#2D2621] block text-xs">布置给谁（设备与孩子）</label>
            <Selector
              options={[
                { label: '全员共同任务 (每台设备独立生成)', value: 'all' },
                { label: '指定孩子 (单独设备专属)', value: 'specific' },
              ]}
              value={[targetScope]}
              onChange={v => v.length && setTargetScope(v[0] as TargetScope)}
              columns={1}
            />

            {targetScope === 'specific' && (
              <div className="pt-2 border-t border-[#F3EFEA]">
                <div className="text-xs text-[#7D7267] mb-1.5">选择指定孩子：</div>
                <Selector
                  options={childOptions}
                  multiple
                  value={targetChildIds}
                  onChange={setTargetChildIds}
                  columns={2}
                />
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-4 border border-[#EAE5DC] shadow-[0_2px_8px_rgba(60,48,36,0.03)] space-y-3">
            <div>
              <label className="font-semibold text-[#2D2621] block mb-1">任务名称 *</label>
              <Input
                placeholder="例如：自主阅读课外书 15 分钟"
                value={title}
                onChange={setTitle}
                className="!text-sm border-b border-[#EAE5DC] pb-1 text-[#2D2621]"
              />
            </div>

            <div>
              <label className="font-semibold text-[#2D2621] block mb-1">要求与说明（选填）</label>
              <TextArea
                placeholder="例如：在各自桌面设备屏幕上点击提交"
                value={description}
                onChange={setDescription}
                rows={2}
                maxLength={100}
                showCount
                className="!text-xs bg-[#F7F5F0] p-2.5 rounded-xl border border-[#EAE5DC]"
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-[#EAE5DC] shadow-[0_2px_8px_rgba(60,48,36,0.03)] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-semibold text-[#2D2621] block">奖励金币数</label>
                <span className="text-xs text-[#A89F95]">各设备提交后各得该金额</span>
              </div>
              <Stepper
                value={rewardCoins}
                onChange={v => setRewardCoins(v)}
                min={1}
                max={100}
                step={5}
              />
            </div>

            <div className="pt-2 border-t border-[#F3EFEA]">
              <label className="font-semibold text-[#2D2621] block mb-1.5">确认方式</label>
              <Selector
                options={[
                  { label: '家长确认后发币 (推荐学习类)', value: 'parent_confirm' },
                  { label: '孩子提交即发币 (适合日常习惯)', value: 'auto_confirm' },
                ]}
                value={[confirmType]}
                onChange={v => v.length && setConfirmType(v[0] as ConfirmType)}
                columns={1}
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 border border-[#EAE5DC] shadow-[0_2px_8px_rgba(60,48,36,0.03)] space-y-3">
            <label className="font-semibold text-[#2D2621] block">重复频率</label>
            <Selector
              options={[
                { label: '每天重复', value: 'daily' },
                { label: '每周指定星期', value: 'weekly_days' },
                { label: '每 N 天一次', value: 'interval_days' },
              ]}
              value={[frequencyType]}
              onChange={v => v.length && setFrequencyType(v[0] as FrequencyType)}
              columns={3}
            />

            {frequencyType === 'weekly_days' && (
              <div className="pt-2">
                <div className="text-xs text-[#7D7267] mb-1.5">选择周内生效星期：</div>
                <Selector
                  options={WEEKDAY_OPTIONS}
                  multiple
                  value={selectedDays}
                  onChange={setSelectedDays}
                  columns={4}
                />
              </div>
            )}

            {frequencyType === 'interval_days' && (
              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-[#7D7267]">间隔天数（每 N 天）：</span>
                <Stepper
                  value={intervalDays}
                  onChange={v => setIntervalDays(v)}
                  min={2}
                  max={30}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#EAE5DC] shrink-0">
          <Button
            block
            size="large"
            onClick={handleSubmit}
            className="!rounded-full font-bold !bg-[#D96B43] hover:!bg-[#C75B34] !text-white !border-0 shadow-sm"
          >
            {initialTemplate ? '保存修改' : '确认创建并分发任务'}
          </Button>
        </div>
      </div>
    </Popup>
  );
};
