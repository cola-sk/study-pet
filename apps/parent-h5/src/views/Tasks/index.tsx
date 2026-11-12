'use client';

import React, { useState } from 'react';
import { Switch, Empty, Dialog, Toast } from 'antd-mobile';
import { EditSOutline, DeleteOutline } from 'antd-mobile-icons';
import { useAppStore } from '../../stores/useAppStore';
import { TaskTemplate } from '../../services/types';
import { TaskFormModal } from './TaskFormModal';
import { IconPlus, IconCoin, IconRepeat, IconShieldCheck, IconUser } from '../../components/Icons';

export const TasksPage: React.FC = () => {
  const { templates, children, toggleTemplate, deleteTemplate } = useAppStore();
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
      title: '删除任务模板',
      content: `确定要删除任务模板「${tpl.title}」吗？已生成的今日历史任务仍会保留。`,
      confirmText: '确定删除',
      cancelText: '取消',
      onConfirm: () => {
        deleteTemplate(tpl.id);
        Toast.show({ icon: 'success', content: '已删除模板' });
      },
    });
  };

  const renderFrequencyText = (tpl: TaskTemplate) => {
    if (tpl.frequencyType === 'daily') return '每日重复';
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

  const renderTargetBadge = (tpl: TaskTemplate) => {
    if (tpl.targetScope === 'all') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 border border-slate-200/80 px-1.5 py-0.5 rounded font-medium">
          <IconUser className="w-3 h-3 text-slate-500" />
          全员分发
        </span>
      );
    }
    const targetNames = children
      .filter(c => tpl.targetChildIds?.includes(c.id))
      .map(c => c.nickname)
      .join('、');
    return (
      <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-1.5 py-0.5 rounded font-medium">
        <IconUser className="w-3 h-3 text-indigo-500" />
        {targetNames || '指定成员'}
      </span>
    );
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* 顶部标题与新建按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">任务模板库</h2>
          <p className="text-xs text-slate-500 mt-0.5">配置周期性任务并自动下发至关联硬件终端</p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-lg px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-all select-none"
        >
          <IconPlus className="w-3.5 h-3.5" />
          <span>新建模板</span>
        </button>
      </div>

      {/* 模板列表 */}
      {templates.length === 0 ? (
        <div className="card-surface rounded-xl bg-white border border-slate-200/90 py-12 text-center shadow-card">
          <Empty description="暂无任务模板，点击右上角新建模板" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {templates.map(tpl => (
            <div
              key={tpl.id}
              className={`card-surface rounded-xl border transition-all overflow-hidden ${
                tpl.isActive
                  ? 'bg-white border-slate-200/90 shadow-card'
                  : 'bg-slate-50/80 border-slate-200/60 opacity-65'
              }`}
            >
              <div className="p-3.5 flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{tpl.title}</span>
                    {renderTargetBadge(tpl)}
                  </div>
                  {tpl.description && (
                    <div className="text-xs text-slate-500 line-clamp-1">{tpl.description}</div>
                  )}
                </div>

                <div className="flex items-center shrink-0">
                  <Switch
                    checked={tpl.isActive}
                    onChange={() => toggleTemplate(tpl.id)}
                    style={{
                      '--width': '40px',
                      '--height': '22px',
                      '--checked-color': '#4F46E5',
                    }}
                  />
                </div>
              </div>

              {/* 底部结构化属性与操作栏 */}
              <div className="px-3.5 py-2.5 bg-slate-50/60 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-white border border-slate-200/90 text-slate-700 px-2 py-0.5 rounded font-medium">
                    <IconRepeat className="w-3 h-3 text-slate-400" />
                    {renderFrequencyText(tpl)}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200/80 text-amber-700 px-2 py-0.5 rounded font-mono font-semibold">
                    <IconCoin className="w-3 h-3" />
                    +{tpl.rewardCoins}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white border border-slate-200/90 text-slate-600 px-2 py-0.5 rounded">
                    <IconShieldCheck className="w-3 h-3 text-slate-400" />
                    {tpl.confirmType === 'parent_confirm' ? '需家长审批' : '自动发币'}
                  </span>
                </div>

                <div className="flex items-center gap-3 select-none">
                  <button
                    type="button"
                    onClick={() => handleEdit(tpl)}
                    className="text-slate-600 hover:text-indigo-600 flex items-center gap-1 text-xs font-medium transition-colors"
                  >
                    <EditSOutline /> 编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(tpl)}
                    className="text-slate-400 hover:text-red-600 flex items-center gap-1 text-xs transition-colors"
                  >
                    <DeleteOutline /> 删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      <TaskFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        initialTemplate={editingTemplate}
      />
    </div>
  );
};
