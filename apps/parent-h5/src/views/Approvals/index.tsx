'use client';

import React, { useState } from 'react';
import { Dialog, Toast, PullToRefresh } from 'antd-mobile';
import confetti from 'canvas-confetti';
import { useAppStore } from '../../stores/useAppStore';
import { TaskInstance } from '../../services/types';
import { IconCoin, IconCheck } from '../../components/Icons';

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
  const [rejectReason, setRejectReason] = useState('加油！再检查一下就能拿到奖励啦！');

  const filteredInstances = selectedChildId === 'all'
    ? instances
    : instances.filter(i => i.childId === selectedChildId);

  const submittedTasks = filteredInstances.filter(i => i.status === 'submitted');

  const triggerRewardConfetti = () => {
    if (typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#EF4444', '#F59E0B', '#FACC15', '#10B981'],
      });
    }
  };

  const handleApprove = async (task: TaskInstance) => {
    const res = await approveTask(task.id);
    if (res.success) {
      triggerRewardConfetti();
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
        content: '已发送鼓励提示，让宝贝再试一次',
      });
    }
  };

  const totalPendingCount = instances.filter(i => i.status === 'submitted').length;

  return (
    <PullToRefresh onRefresh={async () => { await new Promise(r => setTimeout(r, 500)); }}>
      <div className="px-3 py-2.5 space-y-3 pb-20">
        {/* 顶部宝贝筛选 */}
        <div className="flex items-center gap-1.5 overflow-x-auto" role="tablist" aria-label="选择孩子">
          <button
            type="button"
            role="tab"
            aria-selected={selectedChildId === 'all'}
            onClick={() => setSelectedChildId('all')}
            className={`kid-filter-chip ${selectedChildId === 'all' ? 'kid-filter-chip-selected' : ''}`}
          >
            <span>全部宝贝</span>
            {totalPendingCount > 0 && (
              <span className="bg-[#FACC15] text-[#1F2937] text-[10px] font-bold px-1.5 rounded-full">
                {totalPendingCount}
              </span>
            )}
          </button>

          {children.map(child => {
            const childPendingCount = instances.filter(i => i.childId === child.id && i.status === 'submitted').length;
            const isSelected = selectedChildId === child.id;
            return (
              <button
                key={child.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedChildId(child.id)}
                className={`kid-filter-chip ${isSelected ? 'kid-filter-chip-selected' : ''}`}
              >
                <span>{child.avatarIcon || '🧒'}</span>
                <span>{child.nickname}</span>
                {childPendingCount > 0 && (
                  <span className="bg-[#FACC15] text-[#1F2937] text-[10px] font-bold px-1.5 rounded-full">
                    {childPendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 宝贝状态概览卡片（单层紧凑结构，无多余分割线） */}
        <section className="space-y-2">
          {(selectedChildId === 'all' ? children : children.filter(c => c.id === selectedChildId)).map(child => {
            const pet = pets[child.id];
            const device = devices.find(d => d.childId === child.id);
            const childTasks = instances.filter(i => i.childId === child.id);
            const childCompleted = childTasks.filter(i => i.status === 'completed').length;
            const childTotal = childTasks.length;
            const progressPct = childTotal > 0 ? Math.round((childCompleted / childTotal) * 100) : 0;

            return (
              <div key={child.id} className="kid-card">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center text-lg shrink-0">
                      {pet?.currentClothesItem?.icon || pet?.petAvatar || '🐶'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-h3 text-[#1F2937] truncate">{child.nickname}</h2>
                        <span className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">
                          {pet?.petName || '伴学小宠'}
                        </span>
                      </div>
                      <div className="text-caption text-[#4B5563] mt-0.5 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-bold text-[#B45309]">
                          <IconCoin className="w-3.5 h-3.5" />
                          {child.coinsBalance} 金币
                        </span>
                        <span className="text-[#D1D5DB]">|</span>
                        <span>完成 {childCompleted}/{childTotal}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {device ? (
                      <span className="kid-status-chip kid-status-complete">● 设备在线</span>
                    ) : (
                      <span className="kid-status-chip kid-status-locked">未配对</span>
                    )}
                    <div className="text-caption text-[#9CA3AF] mt-0.5 truncate max-w-[110px]">
                      {device?.alias || '暂无设备'}
                    </div>
                  </div>
                </div>

                {/* 纤细进度条 */}
                <div
                  className="w-full bg-[#F3F4F6] h-1.5 rounded-full overflow-hidden mt-2"
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="bg-[#22C55E] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(progressPct, childCompleted > 0 ? 10 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </section>

        {/* 待我确认 */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5">
              <h3 className="text-h2 text-[#1F2937]">待我确认</h3>
              {submittedTasks.length > 0 && (
                <span className="kid-status-chip kid-status-new">{submittedTasks.length} 项</span>
              )}
            </div>
            <span className="text-caption text-[#9CA3AF]">孩子在硬件屏幕提交后展示</span>
          </div>

          {submittedTasks.length === 0 ? (
            <div className="kid-card text-center py-4 text-body text-[#6B7280]">
              暂无待确认打卡，宝贝完成后会显示在这里
            </div>
          ) : (
            <div className="space-y-2">
              {submittedTasks.map(task => {
                const child = children.find(c => c.id === task.childId);
                return (
                  <div key={task.id} className="kid-card-highlight">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="kid-status-chip kid-status-active">
                            {child?.nickname || task.childNickname}
                          </span>
                          {task.deviceAlias && (
                            <span className="text-caption text-[#6B7280] truncate">
                              {task.deviceAlias}
                            </span>
                          )}
                        </div>
                        <h4 className="text-h3 text-[#1F2937] mt-1">{task.title}</h4>
                        {task.description && (
                          <p className="text-body text-[#6B7280] mt-0.5 line-clamp-1">
                            {task.description}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="inline-flex items-center gap-0.5 font-headline font-bold text-[14px] text-[#B45309]">
                          <IconCoin className="w-3.5 h-3.5" />
                          <span>+{task.rewardCoins}</span>
                        </div>
                        <div className="text-mono text-[#9CA3AF]">
                          {task.submittedAt || '刚刚'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRejectingTask(task)}
                        className="kid-btn kid-btn-ghost kid-btn-sm"
                      >
                        <span>再试一次</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(task)}
                        className="kid-btn kid-btn-success kid-btn-sm"
                      >
                        <IconCheck className="w-3 h-3" />
                        <span>批准发币</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 今日任务清单 */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <h3 className="text-h2 text-[#1F2937]">今日任务清单</h3>
            <span className="text-caption text-[#9CA3AF]">共 {filteredInstances.length} 项</span>
          </div>

          <div className="kid-list">
            {filteredInstances.map(task => {
              const child = children.find(c => c.id === task.childId);
              return (
                <div key={task.id} className="kid-list-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-[#3F3F46] bg-[#F4F4F5] px-1.5 py-0.5 rounded shrink-0">
                        {child?.nickname || task.childNickname}
                      </span>
                      <span className="font-semibold text-[13px] text-[#1F2937] truncate">
                        {task.title}
                      </span>
                    </div>
                    <div className="text-caption text-[#6B7280] mt-0.5 flex items-center gap-1.5">
                      <span className="text-[#B45309] font-semibold">+{task.rewardCoins} 金币</span>
                      {task.deviceAlias && <span>· {task.deviceAlias}</span>}
                      {task.rejectReason && (
                        <span className="text-[#F59E0B] truncate">· {task.rejectReason}</span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {task.status === 'completed' && (
                      <span className="kid-status-chip kid-status-complete">已完成</span>
                    )}
                    {task.status === 'submitted' && (
                      <span className="kid-status-chip kid-status-new">待确认</span>
                    )}
                    {task.status === 'pending' && (
                      <span className="kid-status-chip kid-status-locked">进行中</span>
                    )}
                    {task.status === 'rejected' && (
                      <span className="kid-status-chip kid-status-active">再试一次</span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredInstances.length === 0 && (
              <div className="p-4 text-center text-body text-[#9CA3AF]">
                今天还没有任务记录
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 鼓励式“再试一次”弹窗 */}
      <Dialog
        visible={Boolean(rejectingTask)}
        title="鼓励宝贝再试一次"
        content={
          <div className="space-y-2 pt-1">
            <p className="text-body text-[#6B7280]">
              给【{rejectingTask?.childNickname}】发送提示，让他/她在桌面设备上重新提交：
            </p>
            <textarea
              id="try-again-input"
              className="kid-input"
              rows={2}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="输入鼓励提示语"
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
              text: '发送提示',
              bold: true,
              onClick: handleConfirmReject,
            },
          ],
        ]}
      />
    </PullToRefresh>
  );
};
