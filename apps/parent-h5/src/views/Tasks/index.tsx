'use client';

import React, { useState } from 'react';
import { Card, Button, Switch, Empty, Dialog, Toast } from 'antd-mobile';
import { AddOutline, EditSOutline, DeleteOutline } from 'antd-mobile-icons';
import { useAppStore } from '../../stores/useAppStore';
import { TaskTemplate } from '../../services/types';
import { TaskFormModal } from './TaskFormModal';

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

  const renderTargetText = (tpl: TaskTemplate) => {
    if (tpl.targetScope === 'all') {
      return (
        <span className="text-xs bg-[#EFECE6] text-[#7D7267] px-2 py-0.5 rounded-full font-medium">
          全部孩子
        </span>
      );
    }
    const targetNames = children
      .filter(c => tpl.targetChildIds?.includes(c.id))
      .map(c => c.nickname)
      .join('、');
    return (
      <span className="text-xs bg-[#FEF8ED] text-[#C88A2E] border border-[#FCE7C2] px-2 py-0.5 rounded-full font-medium">
        {targetNames || '指定孩子'}
      </span>
    );
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* 顶部标题与新建按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#2D2621]">任务管理</h2>
          <p className="text-xs text-[#7D7267]">为孩子安排日常养成任务与习惯</p>
        </div>
        <Button
          onClick={handleCreate}
          className="!bg-[#D96B43] hover:!bg-[#C75B34] !text-white !border-0 !rounded-full !px-4 !py-1 text-xs font-medium shadow-xs"
        >
          <span className="flex items-center gap-1">
            <AddOutline /> 新建任务
          </span>
        </Button>
      </div>

      {/* 模板列表 */}
      {templates.length === 0 ? (
        <div className="rounded-3xl bg-white border border-[#EAE5DC] py-12 text-center shadow-xs">
          <Empty description="暂无任务模板，点击右上角新建任务吧！" />
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(tpl => (
            <div
              key={tpl.id}
              className={`rounded-3xl p-4 transition-all border ${
                tpl.isActive 
                  ? 'bg-white border-[#EAE5DC] shadow-[0_2px_10px_rgba(60,48,36,0.04)] hover:shadow-[0_4px_16px_rgba(60,48,36,0.06)]' 
                  : 'bg-[#F9F7F2] border-[#E8E3DA] opacity-65'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-[#2D2621] text-base">{tpl.title}</span>
                    {renderTargetText(tpl)}
                  </div>
                  {tpl.description && (
                    <div className="text-xs text-[#7D7267] line-clamp-1">{tpl.description}</div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={tpl.isActive}
                    onChange={() => toggleTemplate(tpl.id)}
                    style={{
                      '--width': '42px',
                      '--height': '24px',
                      '--checked-color': '#D96B43',
                    }}
                  />
                </div>
              </div>

              {/* 标签属性区 */}
              <div className="mt-3.5 pt-3 border-t border-[#F3EFEA] flex flex-wrap items-center justify-between text-xs text-[#7D7267]">
                <div className="flex items-center space-x-2">
                  <span className="bg-[#EFECE6] text-[#7D7267] px-2 py-0.5 rounded-md text-xs font-medium">
                    {renderFrequencyText(tpl)}
                  </span>
                  <span className="bg-[#FEF8ED] text-[#C88A2E] border border-[#FCE7C2] px-2 py-0.5 rounded-md text-xs font-medium">
                    🪙 {tpl.rewardCoins} 金币
                  </span>
                  <span className="bg-[#EEF4EF] text-[#4F7757] border border-[#D0E3D4] px-2 py-0.5 rounded-md text-xs">
                    {tpl.confirmType === 'parent_confirm' ? '需审核' : '自动通过'}
                  </span>
                </div>

                <div className="flex items-center space-x-3 mt-1 sm:mt-0">
                  <button
                    onClick={() => handleEdit(tpl)}
                    className="text-[#7D7267] hover:text-[#2D2621] flex items-center gap-0.5 text-xs font-medium"
                  >
                    <EditSOutline /> 编辑
                  </button>
                  <button
                    onClick={() => handleDelete(tpl)}
                    className="text-[#A89F95] hover:text-[#C85A5A] flex items-center gap-0.5 text-xs"
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
