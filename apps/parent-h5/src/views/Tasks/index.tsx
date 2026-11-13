'use client';

import React, { useState } from 'react';
import { Switch, Empty, Dialog, Toast } from 'antd-mobile';
import { EditSOutline, DeleteOutline } from 'antd-mobile-icons';
import { useAppStore } from '../../stores/useAppStore';
import { TaskTemplate } from '../../services/types';
import { TaskFormModal } from './TaskFormModal';
import { IconPlus, IconCoin } from '../../components/Icons';

export const TasksPage: React.FC = () => {
  const { templates, children, toggleTemplate, deleteTemplate, legacyTemplates, discardLegacyTemplate, isSyncing, taskError, todayDate } = useAppStore();
  const [busy, setBusy] = useState('');
  const mutate = async (id: string, action: () => Promise<void>) => {
    if (busy) return; setBusy(id);
    try { await action(); } catch (e) { Toast.show({ icon: 'fail', content: e instanceof Error ? e.message : '操作失败' }); } finally { setBusy(''); }
  };
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);

  const handleEdit = (tpl: TaskTemplate) => {
    setEditingTemplate(tpl);
    setModalVisible(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setModalVisible(true);
  };

  const handleDelete = (tpl: TaskTemplate) => {
    Dialog.confirm({
      title: '移除任务？',
      content: `确定要移除任务「${tpl.title}」吗？今日已生成的记录仍会保留。`,
      confirmText: '移除',
      cancelText: '取消',
      onConfirm: async () => { await mutate(tpl.id, () => deleteTemplate(tpl.id)); },
    });
  };

  const renderFrequencyText = (tpl: TaskTemplate) => {
    if (tpl.frequencyType === 'daily') return '每天';
    if (tpl.frequencyType === 'weekly_days') {
      const dayMap: Record<number, string> = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' };
      const days = (tpl.frequencyConfig.days || []).map(d => dayMap[d]).join('、');
      return `每周${days}`;
    }
    if (tpl.frequencyType === 'interval_days') {
      return `每 ${tpl.frequencyConfig.interval || 2} 天`;
    }
    return '定期';
  };

  const getTargetLabel = (tpl: TaskTemplate) => {
    if (tpl.targetScope === 'all') return '全部宝贝';
    const targetNames = children
      .filter(c => tpl.targetChildIds?.includes(c.id))
      .map(c => c.nickname)
      .join('、');
    return targetNames || '指定宝贝';
  };

  return (
    <div className="px-3 py-2.5 space-y-3 pb-20">
      {/* 顶部标题与新建按钮 */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div>
          <h2 className="text-h2 text-[#1F2937]">任务模板 ({templates.length})</h2>
          <p className="text-caption text-[#9CA3AF]">按家庭时区生成；每个家庭最多 50 个模板</p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="kid-btn kid-btn-primary kid-btn-sm shrink-0"
        >
          <IconPlus className="w-3 h-3" />
          <span>新建任务</span>
        </button>
      </div>

      {legacyTemplates.length > 0 && <div className="kid-card space-y-2">
        <h3>浏览器旧任务 · 待导入</h3><p className="text-xs text-gray-500">这些草稿尚未保存到家庭，请检查后逐个导入。</p>
        {legacyTemplates.map(t => <div className="flex justify-between gap-2" key={t.id}><span>{t.title}</span><button onClick={() => handleEdit(t)}>检查并导入</button><button onClick={() => discardLegacyTemplate(t.id)}>移除草稿</button></div>)}
      </div>}
      <p className="text-xs text-gray-500">今日已生成的任务会保留；修改、停用和移除影响之后的任务。</p>
      {/* 模板列表 */}
      {templates.length === 0 ? (
        <div className="kid-card text-center py-6">
          <Empty description={taskError ? "任务加载失败，请点击上方重试" : !todayDate || isSyncing ? "正在加载任务…" : "暂无任务，点击右上角新建"} />
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(tpl => (
            <div
              key={tpl.id}
              className={`kid-card ${!tpl.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-h3 text-[#1F2937] truncate">{tpl.title}</h3>
                    <span className="kid-status-chip kid-status-active shrink-0">
                      {getTargetLabel(tpl)}
                    </span>
                  </div>
                  {tpl.description && (
                    <p className="text-body text-[#6B7280] mt-0.5 line-clamp-1">{tpl.description}</p>
                  )}
                </div>

                <Switch
                  checked={tpl.isActive}
                  disabled={Boolean(busy)} onChange={() => mutate(tpl.id, () => toggleTemplate(tpl.id))}
                  style={{
                    '--width': '38px',
                    '--height': '22px',
                    '--checked-color': '#22C55E',
                  }}
                />
              </div>

              <div className="mt-2 pt-2 border-t border-[#F3F4F6] flex items-center justify-between gap-2">
                <div className="text-caption text-[#6B7280] flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-0.5 font-bold text-[#B45309]">
                    <IconCoin className="w-3.5 h-3.5" />
                    +{tpl.rewardCoins} 金币
                  </span>
                  <span>·</span>
                  <span>{renderFrequencyText(tpl)}</span>
                  <span>·</span>
                  <span>{tpl.confirmType === 'parent_confirm' ? '需家长确认' : '自动发币'}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={Boolean(busy)} onClick={() => handleEdit(tpl)}
                    className="kid-btn kid-btn-ghost kid-btn-sm !h-6 !min-h-[24px] !px-2 !text-[11px]"
                  >
                    <EditSOutline />
                    <span>编辑</span>
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy)} onClick={() => handleDelete(tpl)}
                    className="kid-btn kid-btn-danger-ghost kid-btn-sm !h-6 !min-h-[24px] !px-2 !text-[11px]"
                  >
                    <DeleteOutline />
                    <span>删除</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        initialTemplate={editingTemplate}
      />
    </div>
  );
};
