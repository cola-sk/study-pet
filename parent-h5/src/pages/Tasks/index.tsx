import React, { useState } from 'react';
import { Card, Button, Switch, Tag, Dialog, Toast, Empty } from 'antd-mobile';
import { AddOutline, EditSOutline, DeleteOutline } from 'antd-mobile-icons';
import { useAppStore } from '../../stores/useAppStore';
import { TaskTemplate } from '../../services/types';
import { TaskFormModal } from './TaskFormModal';

export const TasksPage: React.FC = () => {
  const { templates, toggleTemplate, deleteTemplate } = useAppStore();
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
    if (tpl.frequencyType === 'daily') return '每天重复';
    if (tpl.frequencyType === 'weekly_days') {
      const dayMap: Record<number, string> = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' };
      const days = (tpl.frequencyConfig.days || []).map(d => dayMap[d]).join('、');
      return `每周${days}`;
    }
    if (tpl.frequencyType === 'interval_days') {
      return `每 ${tpl.frequencyConfig.interval || 2} 天一次`;
    }
    return '定期执行';
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* 顶部标题与新建按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">任务规则库</h2>
          <p className="text-xs text-gray-400">系统每日自动根据频率向设备派发任务</p>
        </div>
        <Button
          color="primary"
          size="small"
          onClick={handleCreate}
          className="!rounded-xl shadow-sm !px-3 font-medium"
        >
          <span className="flex items-center gap-1">
            <AddOutline /> 新建任务
          </span>
        </Button>
      </div>

      {/* 模板列表 */}
      {templates.length === 0 ? (
        <Card className="!rounded-2xl !bg-white border border-slate-100 py-12 text-center">
          <Empty description="暂无任务模板，点击右上角新建任务吧！" />
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map(tpl => (
            <div
              key={tpl.id}
              className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${
                tpl.isActive ? 'border-slate-100 hover:shadow-md' : 'border-slate-200/60 opacity-60 bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-800 text-sm">{tpl.title}</span>
                    <Tag color={tpl.isActive ? 'primary' : 'default'} fill="outline" className="!text-[10px]">
                      {tpl.isActive ? '运行中' : '已暂停'}
                    </Tag>
                  </div>
                  {tpl.description && (
                    <div className="text-xs text-gray-400 line-clamp-1">{tpl.description}</div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={tpl.isActive}
                    onChange={() => toggleTemplate(tpl.id)}
                    style={{ '--width': '42px', '--height': '24px' }}
                  />
                </div>
              </div>

              {/* 标签属性区 */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-gray-500">
                <div className="flex items-center space-x-2">
                  <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[11px] font-medium">
                    📅 {renderFrequencyText(tpl)}
                  </span>
                  <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded text-[11px] font-medium">
                    🪙 {tpl.rewardCoins} 金币
                  </span>
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px]">
                    {tpl.confirmType === 'parent_confirm' ? '家长确认' : '免确认'}
                  </span>
                </div>

                <div className="flex items-center space-x-3 mt-1 sm:mt-0">
                  <button
                    onClick={() => handleEdit(tpl)}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5 text-xs font-medium"
                  >
                    <EditSOutline /> 编辑
                  </button>
                  <button
                    onClick={() => handleDelete(tpl)}
                    className="text-gray-400 hover:text-red-500 flex items-center gap-0.5 text-xs"
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
