'use client';

import React, { useState } from 'react';
import { Popup, Input, TextArea, Stepper, Selector, Toast } from 'antd-mobile';
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
      Toast.show({ icon: 'fail', content: '请至少选择一个指派的成员/设备' });
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
    label: c.nickname,
    value: c.id,
  }));

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="bottom"
      bodyStyle={{
        height: '82vh',
        borderTopLeftRadius: '14px',
        borderTopRightRadius: '14px',
        background: '#F4F6F9',
      }}
    >
      <div className="flex flex-col h-full text-slate-900">
        {/* Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-200/90 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">
            {initialTemplate ? '编辑任务模板' : '新建任务模板'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded"
          >
            关闭
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-3 text-sm">
          {/* 布置目标范围（核心多设备支持） */}
          <div className="card-surface bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-card space-y-2.5">
            <label className="font-bold text-slate-800 block text-xs">分发范围（终端与成员）</label>
            <Selector
              options={[
                { label: '全员共同任务 (每台设备独立生成)', value: 'all' },
                { label: '指定成员 (单独设备专属)', value: 'specific' },
              ]}
              value={[targetScope]}
              onChange={v => v.length && setTargetScope(v[0] as TargetScope)}
              columns={1}
            />

            {targetScope === 'specific' && (
              <div className="pt-2.5 border-t border-slate-100">
                <div className="text-xs text-slate-500 mb-1.5">选择目标成员：</div>
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

          <div className="card-surface bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-card space-y-3">
            <div>
              <label className="font-bold text-slate-800 block text-xs mb-1">任务名称 *</label>
              <Input
                placeholder="例如：自主阅读课外书 15 分钟"
                value={title}
                onChange={setTitle}
                className="!text-sm border border-slate-200 bg-slate-50 px-2.5 py-1.5 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block text-xs mb-1">打卡标准与说明（选填）</label>
              <TextArea
                placeholder="例如：完成后在桌面硬件屏幕上点击提交"
                value={description}
                onChange={setDescription}
                rows={2}
                maxLength={100}
                showCount
                className="!text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div className="card-surface bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-bold text-slate-800 text-xs block">奖励金币数</label>
                <span className="text-[11px] text-slate-400">单次达标发放的金币额度</span>
              </div>
              <Stepper
                value={rewardCoins}
                onChange={v => setRewardCoins(v)}
                min={1}
                max={100}
                step={5}
              />
            </div>

            <div className="pt-2.5 border-t border-slate-100">
              <label className="font-bold text-slate-800 text-xs block mb-1.5">审核机制</label>
              <Selector
                options={[
                  { label: '需家长审批后发币 (学习类推荐)', value: 'parent_confirm' },
                  { label: '终端提交立即发币 (日常习惯类)', value: 'auto_confirm' },
                ]}
                value={[confirmType]}
                onChange={v => v.length && setConfirmType(v[0] as ConfirmType)}
                columns={1}
              />
            </div>
          </div>

          <div className="card-surface bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-card space-y-3">
            <label className="font-bold text-slate-800 text-xs block">重复周期</label>
            <Selector
              options={[
                { label: '每日重复', value: 'daily' },
                { label: '指定星期', value: 'weekly_days' },
                { label: '间隔天数', value: 'interval_days' },
              ]}
              value={[frequencyType]}
              onChange={v => v.length && setFrequencyType(v[0] as FrequencyType)}
              columns={3}
            />

            {frequencyType === 'weekly_days' && (
              <div className="pt-2">
                <div className="text-xs text-slate-500 mb-1.5">选择生效星期：</div>
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
                <span className="text-xs text-slate-600">间隔天数（每 N 天）：</span>
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
        <div className="p-3.5 bg-white border-t border-slate-200/90 shrink-0">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full py-2.5 rounded-lg font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white shadow-xs transition-all select-none"
          >
            {initialTemplate ? '保存模板配置' : '创建并下发至终端'}
          </button>
        </div>
      </div>
    </Popup>
  );
};
