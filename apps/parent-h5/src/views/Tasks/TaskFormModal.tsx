'use client';

import React, { useState, useRef } from 'react';
import { Popup, Stepper, Toast } from 'antd-mobile';
import { TaskTemplate, ConfirmType, FrequencyType, TargetScope } from '../../services/types';
import { isRemoteId, useAppStore } from '../../stores/useAppStore';
import { FamilyApiError } from '../../services/familyApi';
import { IconCheck, IconCoin } from '../../components/Icons';

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
  const { family, children, addTemplate, updateTemplate, discardLegacyTemplate } = useAppStore();

  const [title, setTitle] = useState(initialTemplate?.title || '');
  const [description, setDescription] = useState(initialTemplate?.description || '');
  const [rewardCoins, setRewardCoins] = useState<number>(initialTemplate?.rewardCoins || 10);
  const [confirmType, setConfirmType] = useState<ConfirmType>(initialTemplate?.confirmType || 'parent_confirm');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>(initialTemplate?.frequencyType || 'daily');
  const [selectedDays, setSelectedDays] = useState<number[]>(initialTemplate?.frequencyConfig.days || [1, 3, 5]);
  const [intervalDays, setIntervalDays] = useState<number>(initialTemplate?.frequencyConfig.interval || 2);
  const [targetScope, setTargetScope] = useState<TargetScope>(initialTemplate?.targetScope || 'all');
  const [targetChildIds, setTargetChildIds] = useState<string[]>(initialTemplate?.targetChildIds || (children[0] ? [children[0].id] : []));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const requestId = useRef('');
  const attemptedPayload = useRef<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  React.useEffect(() => {
    if (!visible) return;
    requestId.current = crypto.randomUUID(); attemptedPayload.current = ''; setSaveError('');
    setStartDate(initialTemplate?.startDate || ''); setEndDate(initialTemplate?.endDate || '');
    if (initialTemplate) {
      setTitle(initialTemplate.title);
      setDescription(initialTemplate.description || '');
      setRewardCoins(initialTemplate.rewardCoins);
      setConfirmType(initialTemplate.confirmType);
      setFrequencyType(initialTemplate.frequencyType);
      setSelectedDays(initialTemplate.frequencyConfig.days || [1, 3, 5]);
      setIntervalDays(initialTemplate.frequencyConfig.interval || 2);
      setTargetScope(initialTemplate.targetScope || 'all');
      setTargetChildIds((initialTemplate.targetChildIds || []).filter(id => children.some(c => c.id === id)));
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
  // Only opening the form initializes it; polling must not overwrite edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplate, visible]);

  const toggleChildSelection = (childId: string) => {
    setTargetChildIds(prev =>
      prev.includes(childId) ? prev.filter(id => id !== childId) : [...prev, childId]
    );
  };

  const toggleDaySelection = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!title.trim()) {
      Toast.show({ icon: 'fail', content: '请先给任务起个名字哦！' });
      return;
    }

    if (frequencyType === 'weekly_days' && selectedDays.length === 0) {
      Toast.show({ icon: 'fail', content: '请至少勾选一天哦！' });
      return;
    }

    if (targetScope === 'specific' && targetChildIds.length === 0) {
      Toast.show({ icon: 'fail', content: '请至少勾选一位宝贝哦！' });
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
        ...(frequencyType === 'interval_days' ? { interval: intervalDays, baseDate: initialTemplate?.frequencyConfig.baseDate } : {}),
      },
      targetScope,
      targetChildIds: targetScope === 'specific' ? targetChildIds : [],
      isActive: initialTemplate?.isActive ?? true, startDate: startDate || undefined, endDate: endDate || undefined, updatedAt: initialTemplate?.updatedAt,
    };

    const serialized = JSON.stringify(payload);
    if (attemptedPayload.current && attemptedPayload.current !== serialized && !isRemoteId(initialTemplate?.id || '')) {
      setSaveError('上次保存结果尚未确认，请先恢复原内容重试，或关闭后检查任务列表。'); return;
    }
    attemptedPayload.current = serialized;
    setSaving(true); setSaveError('');
    try {
      if (initialTemplate && isRemoteId(initialTemplate.id)) await updateTemplate(initialTemplate.id, payload);
      else {
        await addTemplate(payload, requestId.current);
        if (initialTemplate) discardLegacyTemplate(initialTemplate.id);
      }
      Toast.show({ icon: 'success', content: '任务已保存到家庭，下次同步即可在设备查看' });
      onClose();
    } catch (e) {
      if (e instanceof FamilyApiError && [400, 401, 403, 404].includes(e.status)) attemptedPayload.current = '';
      setSaveError(e instanceof Error ? e.message : '保存失败，请保持内容不变并重试');
    }
    finally { setSaving(false); }

  };

  return (
    <Popup
      visible={visible}
      onMaskClick={() => { if (!saving) onClose(); }}
      position="bottom"
      bodyStyle={{
        height: '84vh',
        borderTopLeftRadius: '22px',
        borderTopRightRadius: '22px',
        background: '#FFFFFF',
      }}
    >
      <div className="flex flex-col h-full text-[#1F2937]">
        {/* Header */}
        <div className="px-4 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-h2 text-[#1F2937]">
            {initialTemplate ? '修改闯关任务' : '创建新闯关任务'}
          </h3>
          <button
            type="button"
            disabled={saving} onClick={onClose}
            className="kid-btn kid-btn-ghost kid-btn-sm"
          >
            关闭
          </button>
        </div>

        {/* Content */}
        <fieldset disabled={saving} className="p-4 overflow-y-auto flex-1 min-h-0 space-y-3.5">
          {/* 1. 任务名称与说明 */}
          <div className="kid-card space-y-3">
            <div>
              <label htmlFor="task-title-input" className="text-caption text-[#1F2937] block mb-1.5">
                任务名称 *
              </label>
              <input
                id="task-title-input"
                type="text"
                maxLength={40}
                placeholder="例如：自主阅读绘本 15 分钟"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="kid-input"
              />
            </div>

            <div>
              <label htmlFor="task-desc-input" className="text-caption text-[#1F2937] block mb-1.5">
                小提示与规则（选填）
              </label>
              <textarea
                id="task-desc-input"
                placeholder="例如：读完后在桌面屏幕上点一下完成哦"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                maxLength={200}
                className="kid-input"
              />
            </div>
          </div>

          {/* 2. 派发对象 */}
          <div className="kid-card space-y-2.5">
            <div className="text-caption text-[#1F2937]">布置给哪位宝贝？</div>

            <div className="space-y-2" role="radiogroup" aria-label="布置范围">
              {[
                { label: '全部宝贝一起闯关（每位宝贝各自生成）', value: 'all' as TargetScope },
                { label: '指定宝贝专属任务', value: 'specific' as TargetScope },
              ].map(opt => {
                const selected = targetScope === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTargetScope(opt.value)}
                    className="w-full p-2.5 rounded-[14px] bg-white border border-[#E5E7EB] flex items-center gap-2.5 text-left hover:border-[#9CA3AF] transition-all"
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 ${
                        selected ? 'border-[#B96043] bg-white' : 'border-[#9CA3AF] bg-white'
                      }`}
                    >
                      {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#B96043]" />}
                    </span>
                    <span className="text-body font-semibold text-[#1F2937]">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {targetScope === 'specific' && (
              <div className="pt-2.5 border-t border-[#E5E7EB] space-y-2">
                <div className="text-caption text-[#6B7280]">勾选参与的宝贝（可多选）：</div>
                <div className="grid grid-cols-2 gap-2">
                  {children.map(child => {
                    const checked = targetChildIds.includes(child.id);
                    return (
                      <button
                        key={child.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggleChildSelection(child.id)}
                        className="p-2.5 rounded-[14px] bg-white border border-[#E5E7EB] flex items-center gap-2.5 text-left"
                      >
                        <span
                          className={`w-5 h-5 rounded-[6px] flex items-center justify-center border-2 shrink-0 transition-transform ${
                            checked
                              ? 'bg-[#18181B] border-[#18181B] text-white'
                              : 'bg-white border-[#9CA3AF]'
                          }`}
                        >
                          {checked && <IconCheck className="w-3.5 h-3.5" />}
                        </span>
                        <span className="text-body font-bold text-[#1F2937] truncate">
                          {child.nickname}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. 奖励金币与表扬方式 */}
          <div className="kid-card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <IconCoin className="w-5 h-5" />
                <div>
                  <div className="text-caption text-[#1F2937]">奖励金币数量</div>
                  <div className="text-[11px] text-[#6B7280]">每次完成可获得的金币</div>
                </div>
              </div>
              <Stepper
                value={rewardCoins}
                onChange={v => setRewardCoins(v)}
                min={1}
                max={10000}
                step={1}
              />
            </div>

            <div className="pt-2.5 border-t border-[#E5E7EB] space-y-2">
              <div className="text-caption text-[#1F2937]">发币方式：</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '家长表扬后发币', value: 'parent_confirm' as ConfirmType },
                  { label: '打卡立即发币', value: 'auto_confirm' as ConfirmType },
                ].map(opt => {
                  const selected = confirmType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setConfirmType(opt.value)}
                      className={`kid-filter-chip ${selected ? 'kid-filter-chip-selected' : ''}`}
                    >
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. 重复周期 */}
          <div className="kid-card space-y-3">
            <div className="text-caption text-[#1F2937]">闯关频率</div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: '每天一次', value: 'daily' as FrequencyType },
                { label: '每周指定日', value: 'weekly_days' as FrequencyType },
                { label: '每隔几天', value: 'interval_days' as FrequencyType },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFrequencyType(opt.value)}
                  className={`kid-filter-chip ${frequencyType === opt.value ? 'kid-filter-chip-selected' : ''}`}
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            {frequencyType === 'weekly_days' && (
              <div className="pt-2.5 border-t border-[#E5E7EB] flex flex-wrap gap-1.5">
                {WEEKDAY_OPTIONS.map(day => {
                  const checked = selectedDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDaySelection(day.value)}
                      className={`kid-filter-chip !px-3 ${checked ? 'kid-filter-chip-selected' : ''}`}
                    >
                      <span>{day.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {frequencyType === 'interval_days' && (
              <div className="pt-2.5 border-t border-[#E5E7EB] flex items-center justify-between">
                <span className="text-body text-[#1F2937]">每隔几天重复一次：</span>
                <Stepper
                  value={intervalDays}
                  onChange={v => setIntervalDays(v)}
                  min={1}
                  max={365}
                />
              </div>
            )}
          </div>
          <div className="kid-card space-y-2">
            <label className="block text-sm">开始日期（留空为今天）<input className="kid-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
            <label className="block text-sm">结束日期（可选）<input className="kid-input" type="date" min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
            <p className="text-xs text-gray-500">今日已生成的任务会保留原内容；修改和停用影响之后的任务。</p>
          </div>
        </fieldset>

        {/* Footer */}
        <div className="p-4 bg-[#F9FAFB] border-t border-[#E5E7EB] shrink-0">
          {saveError && <p className="text-sm text-red-700 mb-2" role="alert">{saveError}</p>}
          <button
            type="button" disabled={saving}
            onClick={handleSubmit}
            className="w-full kid-btn kid-btn-primary kid-btn-lg"
          >
            {saving ? '正在保存…' : initialTemplate ? '保存任务修改' : '发布闯关任务！'}
          </button>
        </div>
      </div>
    </Popup>
  );
};
