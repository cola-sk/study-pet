'use client';

import React, { useState } from 'react';
import { Dialog, Toast, PullToRefresh } from 'antd-mobile';
import confetti from 'canvas-confetti';
import { useAppStore } from '../../stores/useAppStore';
import { TaskInstance } from '../../services/types';
import { IconCoin, IconCheck } from '../../components/Icons';
import { UserProvidedVisual } from '../../components/UserProvidedVisual';

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
        colors: ['#B96043', '#D7AF59', '#6F927B', '#F4E7D3'],
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
      <div className="approval-dashboard px-4 pt-3 space-y-4 pb-24">
        {/* 顶部宝贝筛选 */}
        <div className="flex items-center gap-2 overflow-x-auto" role="tablist" aria-label="选择孩子">
          <button
            type="button"
            role="tab"
            aria-selected={selectedChildId === 'all'}
            onClick={() => setSelectedChildId('all')}
            className={`approval-filter-chip ${selectedChildId === 'all' ? 'is-selected' : ''}`}
          >
            <span>全部宝贝</span>
            {totalPendingCount > 0 && (
              <span className="approval-filter-count">
                {totalPendingCount}
              </span>
            )}
          </button>

          {children.map(child => {
            const childPendingCount = instances.filter(i => i.childId === child.id && i.status === 'submitted').length;
            const isSelected = selectedChildId === child.id;
            const childAvatar = child.avatarUrl || child.avatarIcon;
            return (
              <button
                key={child.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedChildId(child.id)}
                className={`approval-filter-chip ${isSelected ? 'is-selected' : ''}`}
              >
                {childAvatar && (
                  <UserProvidedVisual
                    value={childAvatar}
                    alt={`${child.nickname}头像`}
                    className="inline-flex w-4 h-4 items-center justify-center rounded-full object-cover text-[15px] leading-none"
                  />
                )}
                <span>{child.nickname}</span>
                {childPendingCount > 0 && (
                  <span className="approval-filter-count">
                    {childPendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 宝贝与设备状态概览 */}
        <section className="space-y-2.5">
          {(selectedChildId === 'all' ? children : children.filter(c => c.id === selectedChildId)).map(child => {
            const pet = pets[child.id];
            const device = devices.find(d => d.childId === child.id);
            const childTasks = instances.filter(i => i.childId === child.id);
            const childCompleted = childTasks.filter(i => i.status === 'completed').length;
            const childTotal = childTasks.length;
            const progressPct = childTotal > 0 ? Math.round((childCompleted / childTotal) * 100) : 0;
            const profileVisual = pet?.currentClothesItem?.icon || pet?.petAvatar || child.avatarUrl || child.avatarIcon;

            return (
              <div key={child.id} className="family-overview-card">
                <div className="flex items-center justify-between gap-2">
                  <div className={`flex items-center ${profileVisual ? 'gap-2.5' : ''} min-w-0`}>
                    {profileVisual && (
                      <div className="family-pet-avatar flex items-center justify-center shrink-0 overflow-hidden">
                        <UserProvidedVisual
                          value={profileVisual}
                          alt={pet?.currentClothesItem?.name || pet?.petName || child.nickname}
                          className="flex h-full w-full items-center justify-center object-cover text-xl"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-[15px] font-bold text-[#292B25] truncate">{child.nickname}</h2>
                        <span className="family-pet-name">
                          {pet?.petName || '伴学小宠'}
                        </span>
                      </div>
                      <div className="family-account-meta mt-1 flex items-center gap-2">
                        <span className="family-coin-balance inline-flex items-center gap-1">
                          <IconCoin className="w-3.5 h-3.5" />
                          {child.coinsBalance} 金币
                        </span>
                        <span className="text-[#D9D6CE]">·</span>
                        <span>完成 {childCompleted}/{childTotal}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {device ? (
                      <span className="family-device-status is-online">设备在线</span>
                    ) : (
                      <span className="family-device-status is-offline">未配对</span>
                    )}
                    <div className="family-device-name truncate max-w-[110px]">
                      {device?.alias || '暂无设备'}
                    </div>
                  </div>
                </div>

                {/* 纤细进度条 */}
                <div
                  className="family-progress-track"
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="family-progress-value"
                    style={{ width: `${Math.max(progressPct, childCompleted > 0 ? 10 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </section>

        {/* 待我确认 */}
        <section className="approval-section space-y-2.5">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <div className="flex items-center gap-2">
              <h3 className="approval-section-title">待我确认</h3>
              {submittedTasks.length > 0 && (
                <span className="approval-count-pill">{submittedTasks.length} 项</span>
              )}
            </div>
            <span className="text-[10px] text-[#929187]">设备提交后显示</span>
          </div>

          {submittedTasks.length === 0 ? (
            <div className="family-overview-card text-center py-5 text-[12px] text-[#85847B]">
              暂无待确认打卡，宝贝完成后会显示在这里
            </div>
          ) : (
            <div className="space-y-2.5">
              {submittedTasks.map(task => {
                const child = children.find(c => c.id === task.childId);
                return (
                  <div key={task.id} className="approval-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="approval-card-header">
                          <span className="approval-child-tag">
                            {child?.nickname || task.childNickname}
                          </span>
                          {task.deviceAlias && (
                            <span className="approval-device-label truncate">
                              {task.deviceAlias}
                            </span>
                          )}
                        </div>
                        <h4 className="approval-task-title">{task.title}</h4>
                        {task.description && (
                          <p className="approval-task-description line-clamp-1">
                            {task.description}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="approval-reward">
                          <IconCoin className="w-3.5 h-3.5" />
                          <span>+{task.rewardCoins}</span>
                        </div>
                        <div className="approval-time">
                          {task.submittedAt || '刚刚'}
                        </div>
                      </div>
                    </div>

                    <div className="approval-card-actions">
                      <button
                        type="button"
                        onClick={() => setRejectingTask(task)}
                        className="approval-action approval-action-secondary"
                      >
                        <span>再试一次</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(task)}
                        className="approval-action approval-action-primary inline-flex items-center gap-1.5"
                      >
                        <IconCheck className="w-3.5 h-3.5" />
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
        <section className="approval-section space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h3 className="approval-section-title">今日任务清单</h3>
            <span className="text-[11px] text-[#929187]">共 {filteredInstances.length} 项</span>
          </div>

          <div className="today-task-list">
            {filteredInstances.map(task => {
              const child = children.find(c => c.id === task.childId);
              return (
                <div key={task.id} className="today-task-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="today-task-child shrink-0">
                        {child?.nickname || task.childNickname}
                      </span>
                      <span className="today-task-name truncate">
                        {task.title}
                      </span>
                    </div>
                    <div className="today-task-meta">
                      <span className="today-task-reward">+{task.rewardCoins} 金币</span>
                      {task.deviceAlias && <span>· {task.deviceAlias}</span>}
                      {task.rejectReason && (
                        <span className="text-[#9B742F] truncate">· {task.rejectReason}</span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {task.status === 'completed' && (
                      <span className="approval-status is-done">已完成</span>
                    )}
                    {task.status === 'submitted' && (
                      <span className="approval-status is-pending">待确认</span>
                    )}
                    {task.status === 'pending' && (
                      <span className="approval-status is-progress">进行中</span>
                    )}
                    {task.status === 'rejected' && (
                      <span className="approval-status is-retry">再试一次</span>
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
