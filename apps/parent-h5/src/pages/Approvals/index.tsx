import React, { useState } from 'react';
import { Button, Tag, Dialog, Toast, PullToRefresh, Tabs } from 'antd-mobile';
import { CheckOutline, CloseOutline, ClockCircleOutline } from 'antd-mobile-icons';
import { useAppStore } from '../../stores/useAppStore';
import { TaskInstance } from '../../services/types';

export const ApprovalsPage: React.FC = () => {
  const { 
    children, 
    devices, 
    instances, 
    pets, 
    selectedChildId, 
    setSelectedChildId, 
    approveTask, 
    rejectTask 
  } = useAppStore();

  const [rejectingTask, setRejectingTask] = useState<TaskInstance | null>(null);
  const [rejectReason, setRejectReason] = useState('未达到任务要求，需重新做');

  // 根据当前筛选的孩子过滤任务
  const filteredInstances = selectedChildId === 'all'
    ? instances
    : instances.filter(i => i.childId === selectedChildId);

  // 待家长审批的任务（高优）
  const submittedTasks = filteredInstances.filter(i => i.status === 'submitted');

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
        {/* 多孩子/多设备切换筛选 Tabs */}
        <div className="bg-white rounded-2xl p-1 shadow-sm border border-slate-100">
          <Tabs activeKey={selectedChildId} onChange={setSelectedChildId}>
            <Tabs.Tab
              title={
                <span className="flex items-center gap-1 font-semibold text-xs">
                  <span>👥 全部孩子</span>
                  {instances.filter(i => i.status === 'submitted').length > 0 && (
                    <span className="bg-orange-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {instances.filter(i => i.status === 'submitted').length}
                    </span>
                  )}
                </span>
              }
              key="all"
            />
            {children.map(child => {
              const childPendingCount = instances.filter(i => i.childId === child.id && i.status === 'submitted').length;
              return (
                <Tabs.Tab
                  title={
                    <span className="flex items-center gap-1 font-semibold text-xs">
                      <span>{child.avatarIcon || '🧒'} {child.nickname}</span>
                      {childPendingCount > 0 && (
                        <span className="bg-orange-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                          {childPendingCount}
                        </span>
                      )}
                    </span>
                  }
                  key={child.id}
                />
              );
            })}
          </Tabs>
        </div>

        {/* 顶部孩子与设备状态卡片 (支持多设备多孩子网格概览) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(selectedChildId === 'all' ? children : children.filter(c => c.id === selectedChildId)).map(child => {
            const pet = pets[child.id];
            const device = devices.find(d => d.childId === child.id);
            const childTasks = instances.filter(i => i.childId === child.id);
            const childCompleted = childTasks.filter(i => i.status === 'completed').length;
            const childTotal = childTasks.length;

            return (
              <div
                key={child.id}
                className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 text-white shadow-md relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/30">
                      {pet?.currentClothesItem?.icon || pet?.petAvatar || '🐶'}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="text-base font-bold">{child.nickname}</h2>
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                          {pet?.petName || '小宠物'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-yellow-300 font-bold text-sm flex items-center gap-1">
                          🪙 {child.coinsBalance} <span className="text-[10px] font-normal text-white/80">金币</span>
                        </span>
                        <span className="text-white/40">|</span>
                        <span className="text-[11px] text-blue-100">
                          完成 {childCompleted}/{childTotal}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 关联设备状态 */}
                  <div className="text-right">
                    <div className="inline-flex items-center space-x-1 bg-black/20 px-2 py-0.5 rounded-full text-[10px] backdrop-blur-sm">
                      <span className={`w-1.5 h-1.5 rounded-full ${device ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></span>
                      <span>{device ? '设备在线' : '未绑设备'}</span>
                    </div>
                    <div className="text-[10px] text-blue-200 mt-1 max-w-[100px] truncate">
                      {device?.alias || '去设置绑定'}
                    </div>
                  </div>
                </div>

                {/* 进度条 */}
                <div className="mt-3 pt-2 border-t border-white/10">
                  <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-yellow-400 h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${childTotal > 0 ? (childCompleted / childTotal) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 置顶待确认任务列表 */}
        <div>
          <div className="flex items-center justify-between mb-2 mt-2">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
              <span className="text-orange-500">⚡</span> 待我确认
              {submittedTasks.length > 0 && (
                <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                  {submittedTasks.length} 项
                </span>
              )}
            </h3>
            <span className="text-xs text-gray-400">孩子在硬件屏幕提交后展示</span>
          </div>

          {submittedTasks.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-slate-100 shadow-sm">
              <div className="text-3xl mb-1">✨</div>
              <div className="text-sm text-gray-600 font-medium">暂无待确认的任务</div>
              <div className="text-xs text-gray-400 mt-1">孩子在各自微雪设备上打卡后，会即时呈现在这里</div>
            </div>
          ) : (
            <div className="space-y-3">
              {submittedTasks.map(task => {
                const child = children.find(c => c.id === task.childId);
                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border-2 border-orange-200/80 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        {/* 明确标识来源孩子与设备 */}
                        <div className="flex items-center space-x-1.5 mb-1">
                          <Tag color="primary" className="!text-[11px] !px-1.5 !rounded-md">
                            {child?.avatarIcon || '🧒'} {child?.nickname || task.childNickname}
                          </Tag>
                          {task.deviceAlias && (
                            <span className="text-[10px] text-gray-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {task.deviceAlias}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-gray-800 text-base">{task.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{task.description || '已提交完成'}</div>
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
                );
              })}
            </div>
          )}
        </div>

        {/* 今日全部任务列表 */}
        <div>
          <div className="flex items-center justify-between mb-2 mt-4">
            <h3 className="text-base font-bold text-gray-800">📋 今日任务清单</h3>
            <span className="text-xs text-gray-400">已按设备分发</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
            {filteredInstances.map(task => {
              const child = children.find(c => c.id === task.childId);
              return (
                <div key={task.id} className="p-3.5 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {child?.nickname || task.childNickname}
                      </span>
                      <span className="text-sm font-medium text-gray-800">{task.title}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      奖励: <strong className="text-yellow-600 font-semibold">{task.rewardCoins} 金币</strong>
                      {task.deviceAlias && <span className="ml-2">({task.deviceAlias})</span>}
                      {task.rejectReason && <span className="text-red-500 ml-2">({task.rejectReason})</span>}
                    </div>
                  </div>

                  <div>
                    {task.status === 'completed' && <Tag color="success" className="!text-xs">已发币 ✓</Tag>}
                    {task.status === 'submitted' && <Tag color="warning" className="!text-xs">待确认</Tag>}
                    {task.status === 'pending' && <Tag color="default" className="!text-xs text-gray-400">待提交</Tag>}
                    {task.status === 'rejected' && <Tag color="danger" className="!text-xs">已驳回</Tag>}
                  </div>
                </div>
              );
            })}

            {filteredInstances.length === 0 && (
              <div className="p-6 text-center text-gray-400 text-xs">
                暂无任务记录
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
              驳回后，任务将退回为【{rejectingTask?.childNickname}】桌面设备上的“待提交”状态。
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
