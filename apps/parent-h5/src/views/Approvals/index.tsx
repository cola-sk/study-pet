'use client';

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
        {/* 多孩子/多设备切换筛选 Tabs (日式原木温润分段控制器) */}
        <div className="segmented bg-[#EFECE6] rounded-full p-1 border border-[#E5DFD4]">
          <Tabs activeKey={selectedChildId} onChange={setSelectedChildId}>
            <Tabs.Tab
              title={
                <span className="flex items-center gap-1.5 font-medium text-xs">
                  <span>全部孩子</span>
                  {instances.filter(i => i.status === 'submitted').length > 0 && (
                    <span className="bg-[#D96B43] text-white text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center font-bold shadow-xs">
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
                    <span className="flex items-center gap-1.5 font-medium text-xs">
                      <span>{child.nickname}</span>
                      {childPendingCount > 0 && (
                        <span className="bg-[#D96B43] text-white text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center font-bold shadow-xs">
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

        {/* 顶部孩子与设备状态卡片 (原木素雅伴学小窝) */}
        <div className="grid grid-cols-1 gap-3">
          {(selectedChildId === 'all' ? children : children.filter(c => c.id === selectedChildId)).map(child => {
            const pet = pets[child.id];
            const device = devices.find(d => d.childId === child.id);
            const childTasks = instances.filter(i => i.childId === child.id);
            const childCompleted = childTasks.filter(i => i.status === 'completed').length;
            const childTotal = childTasks.length;

            return (
              <div
                key={child.id}
                className="bg-white rounded-3xl p-4 text-[#2D2621] border border-[#EAE5DC] shadow-[0_2px_10px_rgba(60,48,36,0.04)] relative overflow-hidden transition-all hover:shadow-[0_4px_16px_rgba(60,48,36,0.08)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {/* 宠物形象窝 */}
                    <div className="w-12 h-12 bg-[#FEF8ED] rounded-2xl flex items-center justify-center text-2xl border border-[#FCE7C2] shadow-xs">
                      {pet?.currentClothesItem?.icon || pet?.petAvatar || '🐶'}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="text-base font-bold text-[#2D2621]">{child.nickname}</h2>
                        <span className="text-xs bg-[#FDF3EE] text-[#D96B43] px-2.5 py-0.5 rounded-full border border-[#F8D8CB] font-medium">
                          {pet?.petName || '伴学宠物'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[#C88A2E] font-bold text-sm flex items-center gap-1">
                          🪙 {child.coinsBalance} <span className="text-xs font-normal text-[#7D7267]">金币</span>
                        </span>
                        <span className="text-[#D5CFC5]">|</span>
                        <span className="text-xs text-[#7D7267]">
                          完成 {childCompleted}/{childTotal}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 关联设备状态 (抹茶绿生态呼吸感) */}
                  <div className="text-right">
                    <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      device 
                        ? 'bg-[#EEF4EF] text-[#4F7757] border-[#D0E3D4]' 
                        : 'bg-[#EFECE6] text-[#A89F95] border-[#E5DFD4]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${device ? 'bg-[#4F7757] animate-pulse' : 'bg-[#C5BDB3]'}`}></span>
                      <span>{device ? '设备在线' : '未绑设备'}</span>
                    </div>
                    <div className="text-xs text-[#A89F95] mt-1 max-w-[110px] truncate">
                      {device?.alias || '去设置绑定'}
                    </div>
                  </div>
                </div>

                {/* 进度条 (焦糖暖橙渐变质感) */}
                <div className="mt-3.5 pt-2.5 border-t border-[#F3EFEA]">
                  <div className="w-full bg-[#EFECE6] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#E07A5F] to-[#D96B43] h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${childTotal > 0 ? (childCompleted / childTotal) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 置顶待确认任务列表 (手作温度任务清单) */}
        <div>
          <div className="flex items-center justify-between mb-2 mt-4">
            <h3 className="text-base font-bold text-[#2D2621] flex items-center gap-2">
              <span>待我确认</span>
              {submittedTasks.length > 0 && (
                <span className="bg-[#FDF3EE] text-[#D96B43] border border-[#F8D8CB] text-xs px-2 py-0.5 rounded-full font-bold">
                  {submittedTasks.length} 项
                </span>
              )}
            </h3>
            <span className="text-xs text-[#A89F95]">孩子在桌面设备提交后展示</span>
          </div>

          {submittedTasks.length === 0 ? (
            <div className="bg-white rounded-3xl p-6 text-center border border-[#EAE5DC] shadow-[0_2px_8px_rgba(60,48,36,0.03)]">
              <div className="text-2xl mb-1">🌿</div>
              <div className="text-sm text-[#2D2621] font-medium">暂无待确认的任务</div>
              <div className="text-xs text-[#A89F95] mt-1">孩子在微雪设备上打卡后，会即时呈现在这里</div>
            </div>
          ) : (
            <div className="space-y-3">
              {submittedTasks.map(task => {
                const child = children.find(c => c.id === task.childId);
                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-3xl p-4 border border-[#EAE5DC] shadow-[0_2px_10px_rgba(60,48,36,0.04)] transition-all hover:shadow-[0_4px_16px_rgba(60,48,36,0.06)]"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        {/* 明确标识来源孩子与设备 */}
                        <div className="flex items-center space-x-1.5 mb-1.5">
                          <span className="text-xs bg-[#FEF8ED] text-[#C88A2E] border border-[#FCE7C2] px-2 py-0.5 rounded-md font-medium">
                            {child?.nickname || task.childNickname}
                          </span>
                          {task.deviceAlias && (
                            <span className="text-xs text-[#5C829B] bg-[#EFF5F8] border border-[#D5E5EE] px-2 py-0.5 rounded-md">
                              {task.deviceAlias}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-[#2D2621] text-base">{task.title}</div>
                        <div className="text-xs text-[#7D7267] mt-1">{task.description || '已打卡完成'}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-[#C88A2E] flex items-center justify-end gap-1">
                          +{task.rewardCoins} 金币
                        </div>
                        <div className="text-xs text-[#A89F95] flex items-center gap-1 mt-1 justify-end">
                          <ClockCircleOutline /> {task.submittedAt || '刚刚'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-[#F3EFEA] flex items-center justify-end space-x-2.5">
                      <Button
                        size="small"
                        onClick={() => setRejectingTask(task)}
                        className="!rounded-full !text-xs !px-3.5 !bg-[#F3EFEA] hover:!bg-[#EAE5DC] !text-[#7D7267] !border-0 font-medium"
                      >
                        <span className="flex items-center gap-1">
                          <CloseOutline /> 驳回
                        </span>
                      </Button>
                      <Button
                        size="small"
                        onClick={() => handleApprove(task)}
                        className="!rounded-full !text-xs !px-4 !bg-[#D96B43] hover:!bg-[#C75B34] !text-white !border-0 font-medium shadow-xs"
                      >
                        <span className="flex items-center gap-1">
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
          <div className="flex items-center justify-between mb-2 mt-5">
            <h3 className="text-base font-bold text-[#2D2621]">今日任务清单</h3>
            <span className="text-xs text-[#A89F95]">已按设备自动分发</span>
          </div>

          <div className="bg-white rounded-3xl border border-[#EAE5DC] shadow-[0_2px_10px_rgba(60,48,36,0.04)] divide-y divide-[#F3EFEA] overflow-hidden">
            {filteredInstances.map(task => {
              const child = children.find(c => c.id === task.childId);
              return (
                <div key={task.id} className="p-3.5 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-[#7D7267] bg-[#EFECE6] px-2 py-0.5 rounded-md">
                        {child?.nickname || task.childNickname}
                      </span>
                      <span className="text-sm font-semibold text-[#2D2621]">{task.title}</span>
                    </div>
                    <div className="text-xs text-[#A89F95]">
                      奖励: <strong className="text-[#C88A2E] font-medium">{task.rewardCoins} 金币</strong>
                      {task.deviceAlias && <span className="ml-2">({task.deviceAlias})</span>}
                      {task.rejectReason && <span className="text-[#C85A5A] ml-2">({task.rejectReason})</span>}
                    </div>
                  </div>

                  <div>
                    {task.status === 'completed' && (
                      <span className="text-xs bg-[#EEF4EF] text-[#4F7757] border border-[#D0E3D4] px-2.5 py-1 rounded-full font-medium">
                        已发币 ✓
                      </span>
                    )}
                    {task.status === 'submitted' && (
                      <span className="text-xs bg-[#FEF8ED] text-[#D49439] border border-[#FCE7C2] px-2.5 py-1 rounded-full font-medium">
                        待确认
                      </span>
                    )}
                    {task.status === 'pending' && (
                      <span className="text-xs bg-[#EFECE6] text-[#A89F95] px-2.5 py-1 rounded-full font-medium">
                        待提交
                      </span>
                    )}
                    {task.status === 'rejected' && (
                      <span className="text-xs bg-[#FDF2F2] text-[#C85A5A] border border-[#FECACA] px-2.5 py-1 rounded-full font-medium">
                        已驳回
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredInstances.length === 0 && (
              <div className="p-6 text-center text-[#A89F95] text-xs">
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
            <p className="text-xs text-[#7D7267]">
              驳回后，任务将退回为【{rejectingTask?.childNickname}】桌面设备上的“待提交”状态。
            </p>
            <div className="text-xs font-semibold text-[#2D2621]">驳回说明：</div>
            <textarea
              className="w-full border border-[#EAE5DC] bg-[#F7F5F0] rounded-xl p-2.5 text-xs text-[#2D2621] focus:ring-2 focus:ring-[#D96B43] focus:outline-none"
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="请输入驳回原因或鼓励提示..."
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
