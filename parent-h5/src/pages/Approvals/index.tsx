import React, { useState } from 'react';
import { Card, Button, Tag, Dialog, Toast, PullToRefresh } from 'antd-mobile';
import { CheckOutline, CloseOutline, ClockCircleOutline } from 'antd-mobile-icons';
import { useAppStore } from '../../stores/useAppStore';
import { TaskInstance } from '../../services/types';

export const ApprovalsPage: React.FC = () => {
  const { child, device, instances, pet, approveTask, rejectTask } = useAppStore();
  const [rejectingTask, setRejectingTask] = useState<TaskInstance | null>(null);
  const [rejectReason, setRejectReason] = useState('未达到任务要求，需重新做');

  // 待家长审批的任务（高优）
  const submittedTasks = instances.filter(i => i.status === 'submitted');
  // 今日所有任务
  const allTodayTasks = instances;

  const completedCount = instances.filter(i => i.status === 'completed').length;
  const totalCount = instances.length;

  const handleApprove = async (task: TaskInstance) => {
    const res = await approveTask(task.id);
    if (res.success) {
      Toast.show({
        icon: 'success',
        content: res.message,
      });
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingTask) return;
    const res = await rejectTask(rejectingTask.id, rejectReason);
    setRejectingTask(null);
    if (res.success) {
      Toast.show({
        icon: 'success',
        content: res.message,
      });
    }
  };

  return (
    <PullToRefresh onRefresh={async () => { await new Promise(r => setTimeout(r, 600)); }}>
      <div className="p-4 space-y-4 pb-24">
        {/* 顶部孩子与宠物概览卡片 */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-white/30">
                {pet.currentClothesItem?.icon || '🐶'}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold">{child.nickname}的学习宠物</h2>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/20">
                    {pet.currentClothesItem ? pet.currentClothesItem.name : '初始装扮'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-yellow-300 font-bold text-base flex items-center gap-1">
                    🪙 {child.coinsBalance} <span className="text-xs font-normal text-white/80">金币</span>
                  </span>
                  <span className="text-white/40">|</span>
                  <span className="text-xs text-blue-100">
                    今日完成 {completedCount}/{totalCount}
                  </span>
                </div>
              </div>
            </div>

            {/* 设备状态指示 */}
            <div className="text-right">
              <div className="inline-flex items-center space-x-1 bg-black/20 px-2 py-1 rounded-full text-[11px] backdrop-blur-sm">
                <span className={`w-2 h-2 rounded-full ${device.status === 'paired' ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></span>
                <span>{device.status === 'paired' ? '微雪设备在线' : '设备未绑定'}</span>
              </div>
              <div className="text-[10px] text-blue-200 mt-1">
                {device.status === 'paired' ? device.deviceModel.replace('Waveshare ', '') : '点击设置绑定'}
              </div>
            </div>
          </div>

          {/* 进度条 */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="flex justify-between text-xs text-blue-100 mb-1">
              <span>今日任务进度</span>
              <span>{totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
              <div
                className="bg-yellow-400 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* 置顶待确认任务列表 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
              <span className="text-orange-500">⚡</span> 待我确认
              {submittedTasks.length > 0 && (
                <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                  {submittedTasks.length}
                </span>
              )}
            </h3>
            <span className="text-xs text-gray-400">孩子在硬件屏幕提交后展示</span>
          </div>

          {submittedTasks.length === 0 ? (
            <Card className="!rounded-2xl !bg-slate-50 border border-slate-100 text-center py-6">
              <div className="text-3xl mb-1">✨</div>
              <div className="text-sm text-gray-600 font-medium">太棒了，暂无待确认的任务</div>
              <div className="text-xs text-gray-400 mt-1">孩子在桌面设备提交后，这里会立刻出现</div>
            </Card>
          ) : (
            <div className="space-y-3">
              {submittedTasks.map(task => (
                <div
                  key={task.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border-2 border-orange-200/80 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-gray-800 text-base">{task.title}</span>
                        <Tag color="warning" fill="outline" className="!text-[11px] !px-1.5">
                          待家长确认
                        </Tag>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{task.description || '孩子已提交完成'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold text-orange-600 flex items-center justify-end gap-0.5">
                        🪙 +{task.rewardCoins}
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <ClockCircleOutline /> {task.submittedAt || '刚刚'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end space-x-2">
                    <Button
                      size="small"
                      color="default"
                      onClick={() => setRejectingTask(task)}
                      className="!rounded-lg !text-xs !px-3"
                    >
                      <span className="flex items-center gap-1 text-gray-600">
                        <CloseOutline /> 驳回
                      </span>
                    </Button>
                    <Button
                      size="small"
                      color="primary"
                      onClick={() => handleApprove(task)}
                      className="!rounded-lg !text-xs !px-4 !bg-emerald-600 !border-emerald-600 font-medium shadow-sm hover:!bg-emerald-700"
                    >
                      <span className="flex items-center gap-1 text-white">
                        <CheckOutline /> 批准发币
                      </span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 今日全部任务列表 */}
        <div>
          <div className="flex items-center justify-between mb-2 mt-6">
            <h3 className="text-base font-bold text-gray-800">📋 今日任务清单</h3>
            <span className="text-xs text-gray-400">设备端按频率同步</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
            {allTodayTasks.map(task => (
              <div key={task.id} className="p-3.5 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-800">{task.title}</span>
                    {task.confirmType === 'auto_confirm' && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">免确认</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    奖励: <strong className="text-yellow-600 font-semibold">{task.rewardCoins} 金币</strong>
                    {task.rejectReason && (
                      <span className="text-red-500 ml-2">({task.rejectReason})</span>
                    )}
                  </div>
                </div>

                <div>
                  {task.status === 'completed' && (
                    <Tag color="success" className="!text-xs">
                      已发币 ✓
                    </Tag>
                  )}
                  {task.status === 'submitted' && (
                    <Tag color="warning" className="!text-xs">
                      待确认
                    </Tag>
                  )}
                  {task.status === 'pending' && (
                    <Tag color="default" className="!text-xs text-gray-400">
                      待提交
                    </Tag>
                  )}
                  {task.status === 'rejected' && (
                    <Tag color="danger" className="!text-xs">
                      已驳回
                    </Tag>
                  )}
                </div>
              </div>
            ))}

            {allTodayTasks.length === 0 && (
              <div className="p-6 text-center text-gray-400 text-xs">
                今日暂无任务，请在「任务管理」中创建模板
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 驳回确认弹窗 */}
      <Dialog
        visible={Boolean(rejectingTask)}
        title="驳回任务"
        content={
          <div className="space-y-3 pt-2">
            <p className="text-xs text-gray-500">
              驳回后，任务将退回为“待提交”状态，允许孩子在微雪设备上重新提交完成。
            </p>
            <div className="text-xs font-semibold text-gray-700">驳回说明：</div>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="请输入驳回原因或提示..."
            />
          </div>
        }
        actions={[
          [
            {
              key: 'cancel',
              text: '取消',
              onClick: () => setRejectingTask(null),
            },
            {
              key: 'confirm',
              text: '确定驳回',
              danger: true,
              onClick: handleConfirmReject,
            },
          ],
        ]}
      />
    </PullToRefresh>
  );
};
