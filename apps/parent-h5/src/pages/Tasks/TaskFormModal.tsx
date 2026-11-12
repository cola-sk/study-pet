import React, { useState } from 'react';
import { Popup, Input, TextArea, Stepper, Selector, Button, Toast } from 'antd-mobile';
import { TaskTemplate, ConfirmType, FrequencyType } from '../../services/types';
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
  const { family, addTemplate, updateTemplate } = useAppStore();

  const [title, setTitle] = useState(initialTemplate?.title || '');
  const [description, setDescription] = useState(initialTemplate?.description || '');
  const [rewardCoins, setRewardCoins] = useState<number>(initialTemplate?.rewardCoins || 10);
  const [confirmType, setConfirmType] = useState<ConfirmType>(initialTemplate?.confirmType || 'parent_confirm');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>(initialTemplate?.frequencyType || 'daily');
  const [selectedDays, setSelectedDays] = useState<number[]>(initialTemplate?.frequencyConfig.days || [1, 3, 5]);
  const [intervalDays, setIntervalDays] = useState<number>(initialTemplate?.frequencyConfig.interval || 2);

  React.useEffect(() => {
    if (initialTemplate) {
      setTitle(initialTemplate.title);
      setDescription(initialTemplate.description || '');
      setRewardCoins(initialTemplate.rewardCoins);
      setConfirmType(initialTemplate.confirmType);
      setFrequencyType(initialTemplate.frequencyType);
      setSelectedDays(initialTemplate.frequencyConfig.days || [1, 3, 5]);
      setIntervalDays(initialTemplate.frequencyConfig.interval || 2);
    } else {
      setTitle('');
      setDescription('');
      setRewardCoins(10);
      setConfirmType('parent_confirm');
      setFrequencyType('daily');
      setSelectedDays([1, 3, 5]);
      setIntervalDays(2);
    }
  }, [initialTemplate, visible]);

  const handleSubmit = () => {
    if (!title.trim()) {
      Toast.show({ icon: 'fail', content: '请输入任务名称' });
      return;
    }

    if (frequencyType === 'weekly_days' && selectedDays.length === 0) {
      Toast.show({ icon: 'fail', content: '请至少选择一个星期周期' });
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
        days: frequencyType === 'weekly_days' ? selectedDays : undefined,
        interval: frequencyType === 'interval_days' ? intervalDays : undefined,
        baseDate: frequencyType === 'interval_days' ? new Date().toISOString().split('T')[0] : undefined,
      },
      isActive: true,
    };

    if (initialTemplate) {
      updateTemplate(initialTemplate.id, payload);
      Toast.show({ icon: 'success', content: '模板更新成功' });
    } else {
      addTemplate(payload);
      Toast.show({ icon: 'success', content: '新任务模板已创建' });
    }

    onClose();
  };

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="bottom"
      bodyStyle={{
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px',
        maxHeight: '90vh',
        background: '#f8fafc',
      }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-bold text-gray-800 text-base">
            {initialTemplate ? '编辑任务模板' : '创建新任务模板'}
          </h3>
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">
            取消
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-3">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">任务名称 *</label>
              <Input
                placeholder="例如：自主阅读课外书 15 分钟"
                value={title}
                onChange={setTitle}
                className="!text-sm border-b border-gray-100 pb-1"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">要求与说明（选填）</label>
              <TextArea
                placeholder="例如：阅读完成后在微雪桌面设备上点击完成"
                value={description}
                onChange={setDescription}
                rows={2}
                maxLength={100}
                showCount
                className="!text-xs bg-slate-50 p-2 rounded-lg"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-semibold text-gray-700 block">奖励金币数</label>
                <span className="text-[11px] text-gray-400">推荐范围：5~15 金币</span>
              </div>
              <Stepper
                value={rewardCoins}
                onChange={v => setRewardCoins(v)}
                min={1}
                max={100}
                step={5}
              />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="font-semibold text-gray-700 block mb-1.5">确认方式</label>
              <Selector
                options={[
                  { label: '家长确认后发币 (推荐学习类)', value: 'parent_confirm' },
                  { label: '孩子提交即发币 (适合自律习惯)', value: 'auto_confirm' },
                ]}
                value={[confirmType]}
                onChange={v => v.length && setConfirmType(v[0] as ConfirmType)}
                columns={1}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-3">
            <label className="font-semibold text-gray-700 block">重复频率</label>
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
                <div className="text-[11px] text-gray-500 mb-1.5">选择周内生效星期：</div>
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
                <span className="text-xs text-gray-600">间隔天数（每 N 天）：</span>
                <Stepper
                  value={intervalDays}
                  onChange={v => setIntervalDays(v)}
                  min={2}
                  max={30}
                />
              </div>
            )}
          </div>

          <div className="text-[11px] text-gray-400 px-1 leading-relaxed">
            ℹ️ 规则说明：按家庭时区（{family.timezone}）每日 00:00 自动生成今日任务实例。修改模板仅影响未来尚未生成的实例，今日任务保持原样。
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-gray-100">
          <Button block color="primary" size="large" onClick={handleSubmit} className="!rounded-xl font-bold">
            {initialTemplate ? '保存修改' : '确认创建任务模板'}
          </Button>
        </div>
      </div>
    </Popup>
  );
};
