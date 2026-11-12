'use client';

import React, { useState } from 'react';
import { Switch, Empty, Dialog, Toast } from 'antd-mobile';
import { EditSOutline, DeleteOutline } from 'antd-mobile-icons';
import { useAppStore } from '../../stores/useAppStore';
import { TaskTemplate } from '../../services/types';
import { TaskFormModal } from './TaskFormModal';
import { IconPlus, IconCoin, IconStar, IconCheck, IconSparkle } from '../../components/Icons';

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
      title: '移除这项任务？',
      content: `确定要移除任务「${tpl.title}」吗？今天已经生成的闯关记录仍会保留。`,
      confirmText: '确定移除',
      cancelText: '返回',
      onConfirm: () => {
        deleteTemplate(tpl.id);
        Toast.show({ icon: 'success', content: '已移除任务' });
      },
    });
  };

  const renderFrequencyText = (tpl: TaskTemplate) => {
    if (tpl.frequencyType === 'daily') return '每天闯关';
    if (tpl.frequencyType === 'weekly_days') {
      const dayMap: Record<number, string> = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' };
      const days = (tpl.frequencyConfig.days || []).map(d => dayMap[d]).join('、');
      return `每周${days}`;
    }
    if (tpl.frequencyType === 'interval_days') {
      return `每 ${tpl.frequencyConfig.interval || 2} 天`;
    }
    return '定期闯关';
  };

  const renderTargetBadge = (tpl: TaskTemplate) => {
    if (tpl.targetScope === 'all') {
      return (
        <span className="kid-status-chip kid-status-active">
          <IconStar className="w-3 h-3 text-[#3B82F6]" />
          <span>全部宝贝</span>
        </span>
      );
    }
    const targetNames = children
      .filter(c => tpl.targetChildIds?.includes(c.id))
      .map(c => c.nickname)
      .join('、');
    return (
      <span className="kid-status-chip kid-status-new">
        <IconSparkle className="w-3 h-3 text-[#F59E0B]" />
        <span>{targetNames || '指定宝贝'}</span>
      </span>
    );
  };

  return (
    <div className="px-3.5 py-3.5 space-y-4 pb-24">
      {/* 顶部标题与新建按钮 */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-h2 text-[#1F2937]">任务闯关库 ({templates.length})</h2>
          <p className="text-caption text-[#6B7280]">设置每日好习惯，让宝贝赢取金币星星</p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="kid-btn kid-btn-primary kid-btn-sm shrink-0"
        >
          <IconPlus className="w-3.5 h-3.5" />
          <span>添加新任务</span>
        </button>
      </div>

      {/* 模板列表 */}
      {templates.length === 0 ? (
        <div className="kid-card text-center py-8">
          <Empty description="还没有闯关任务，点击上方【添加新任务】开始吧！" />
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(tpl => (
            <div
              key={tpl.id}
              className={`kid-card ${!tpl.isActive ? 'opacity-65' : ''}`}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-h3 text-[#1F2937]">{tpl.title}</h3>
                    {renderTargetBadge(tpl)}
                  </div>
                  {tpl.description && (
                    <p className="text-body text-[#4B5563] line-clamp-1">{tpl.description}</p>
                  )}
                </div>

                <div className="flex items-center shrink-0">
                  <Switch
                    checked={tpl.isActive}
                    onChange={() => toggleTemplate(tpl.id)}
                    style={{
                      '--width': '42px',
                      '--height': '24px',
                      '--checked-color': '#22C55E',
                    }}
                  />
                </div>
              </div>

              {/* 底部状态胶囊与操作按钮 */}
              <div className="mt-3 pt-2.5 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="kid-status-chip kid-status-new">
                    <IconCoin className="w-3.5 h-3.5" />
                    <span>+{tpl.rewardCoins} 金币</span>
                  </span>
                  <span className="kid-status-chip kid-status-active">
                    <IconStar className="w-3 h-3" />
                    <span>{renderFrequencyText(tpl)}</span>
                  </span>
                  <span className="kid-status-chip kid-status-complete">
                    <IconCheck className="w-3 h-3" />
                    <span>{tpl.confirmType === 'parent_confirm' ? '家长表扬' : '完成即得'}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(tpl)}
                    className="kid-btn kid-btn-secondary kid-btn-sm !h-7 !min-h-[28px] !px-2.5 !text-[11px]"
                  >
                    <EditSOutline />
                    <span>修改</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(tpl)}
                    className="kid-btn kid-btn-ghost kid-btn-sm !h-7 !min-h-[28px] !px-2.5 !text-[11px]"
                  >
                    <DeleteOutline />
                    <span>移除</span>
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
