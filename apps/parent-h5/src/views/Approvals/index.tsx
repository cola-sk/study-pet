'use client';

import React, { useState } from 'react';
import { Dialog, Toast, PullToRefresh } from 'antd-mobile';
import confetti from 'canvas-confetti';
import { useAppStore } from '../../stores/useAppStore';
import { TaskInstance } from '../../services/types';
import {
  IconCoin,
  IconDevice,
  IconCheck,
  IconClock,
  IconStar,
  IconSparkle,
  IconLock,
} from '../../components/Icons';

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

  // 根据当前筛选的孩子过滤任务
  const filteredInstances = selectedChildId === 'all'
    ? instances
    : instances.filter(i => i.childId === selectedChildId);

  // 待家长审批的任务（高优）
  const submittedTasks = filteredInstances.filter(i => i.status === 'submitted');

  const triggerRewardConfetti = () => {
    if (typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      confetti({
        particleCount: 55,
        spread: 65,
        origin: { y: 0.7 },
        colors: ['#EF4444', '#3B82F6', '#FACC15', '#22C55E'],
      });
    }
  };

  const handleApprove = async (task: TaskInstance) => {
    const res = await approveTask(task.id);
    if (res.success) {
      triggerRewardConfetti();
      Toast.show({
        icon: 'success',
        content: `太棒啦！${res.message}`,
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
        content: '已发送鼓励提示，让宝贝再试一次！',
      });
    }
  };

  const totalPendingCount = instances.filter(i => i.status === 'submitted').length;

  return (
    <PullToRefresh onRefresh={async () => { await new Promise(r => setTimeout(r, 600)); }}>
      <div className="px-4 py-6 space-y-8 pb-32">
        {/* KidLearn Filter Chips (Default: #F3F4F6, Selected: #3B82F6, 9999px pill) */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2" role="tablist" aria-label="选择孩子">
          <button
            type="button"
            role="tab"
            aria-selected={selectedChildId === 'all'}
            onClick={() => setSelectedChildId('all')}
            className={`kid-filter-chip ${selectedChildId === 'all' ? 'kid-filter-chip-selected' : ''}`}
          >
            <IconStar className="w-4 h-4" />
            <span>全部宝贝</span>
            {totalPendingCount > 0 && (
              <span className="bg-[#FACC15] text-[#1F2937] text-xs font-bold px-2 py-0.5 rounded-full">
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
                <span className="text-lg leading-none">{child.avatarIcon || '🧒'}</span>
                <span>{child.nickname}</span>
                {childPendingCount > 0 && (
                  <span className="bg-[#FACC15] text-[#1F2937] text-xs font-bold px-2 py-0.5 rounded-full">
                    {childPendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 宝贝与宠物闯关状态大卡片 (KidLearn Cards: #F9FAFB, 2px border, 20px corners, 24px padding, shadow-playful) */}
        <section className="space-y-6">
          {(selectedChildId === 'all' ? children : children.filter(c => c.id === selectedChildId)).map(child => {
            const pet = pets[child.id];
            const device = devices.find(d => d.childId === child.id);
            const childTasks = instances.filter(i => i.childId === child.id);
            const childCompleted = childTasks.filter(i => i.status === 'completed').length;
            const childTotal = childTasks.length;
            const progressPct = childTotal > 0 ? Math.round((childCompleted / childTotal) * 100) : 0;

            return (
              <div key={child.id} className="kid-card">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    {/* 50% Circle Avatar */}
                    <div className="w-16 h-16 rounded-full bg-[#FEF3C7] border-2 border-[#FACC15] flex items-center justify-center text-3xl shadow-kid-sm shrink-0">
                      {pet?.currentClothesItem?.icon || pet?.petAvatar || '🐶'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-h3 text-[#1F2937]">{child.nickname}</h2>
                        <span className="kid-status-chip kid-status-new">
                          <IconSparkle className="w-4 h-4 text-[#F59E0B]" />
                          <span>{pet?.petName || '伴学小宠'}</span>
                        </span>
                      </div>
                      <div className="text-caption text-[#6B7280] mt-1 flex items-center gap-1.5">
                        <IconDevice className="w-4 h-4 text-[#3B82F6]" />
                        <span>{device?.alias || '未连接桌面伙伴设备'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 设备状态 Status Chip */}
                  <div>
                    {device ? (
                      <span className="kid-status-chip kid-status-complete">
                        <IconCheck className="w-4 h-4" />
                        <span>设备在线</span>
                      </span>
                    ) : (
                      <span className="kid-status-chip kid-status-locked">
                        <IconLock className="w-4 h-4" />
                        <span>待配对</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 星星金币与闯关进度 */}
                <div className="mt-6 pt-4 border-t-2 border-[#E5E7EB] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-[#FEF3C7] border-2 border-[#FACC15] px-4 py-1.5 rounded-full">
                      <IconCoin className="w-5 h-5" />
                      <span className="font-headline font-bold text-[18px] text-[#92400E]">
                        {child.coinsBalance} 金币
                      </span>
                    </div>

                    <div className="text-caption text-[#1F2937] flex items-center gap-1.5">
                      <IconStar className="w-5 h-5 text-[#FACC15]" />
                      <span>今日闯关: <strong>{childCompleted} / {childTotal}</strong></span>
                    </div>
                  </div>

                  {/* Chunky Playful Progress Bar */}
                  <div
                    className="w-full bg-[#E5E7EB] h-4 rounded-full overflow-hidden p-0.5"
                    role="progressbar"
                    aria-valuenow={progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="bg-[#22C55E] h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(progressPct, childCompleted > 0 ? 12 : 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* 待发奖打卡任务 (Surface Highlight #FEF3C7 for active lessons/rewards) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-h3 text-[#1F2937]">待发奖打卡</h3>
              {submittedTasks.length > 0 && (
                <span className="kid-status-chip kid-status-new">
                  <IconSparkle className="w-4 h-4 text-[#F59E0B]" />
                  <span>{submittedTasks.length} 项待表扬</span>
                </span>
              )}
            </div>
          </div>

          {submittedTasks.length === 0 ? (
            <div className="kid-card text-center">
              <div className="w-14 h-14 rounded-full bg-[#DCFCE7] text-[#166534] flex items-center justify-center mx-auto mb-3">
                <IconCheck className="w-7 h-7" />
              </div>
              <div className="text-h3 text-[#1F2937]">所有打卡都表扬完啦！</div>
              <p className="text-body text-[#6B7280] mt-1">
                宝贝在桌面设备上完成任务后，会在这里等待你发放金币星星哦
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {submittedTasks.map(task => {
                const child = children.find(c => c.id === task.childId);
                return (
                  <div key={task.id} className="kid-card-highlight">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-2 flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="kid-status-chip kid-status-active">
                            <IconStar className="w-4 h-4 text-[#3B82F6]" />
                            <span>{child?.nickname || task.childNickname}</span>
                          </span>
                          {task.deviceAlias && (
                            <span className="text-caption text-[#92400E] flex items-center gap-1">
                              <IconDevice className="w-4 h-4" />
                              {task.deviceAlias}
                            </span>
                          )}
                        </div>

                        <h4 className="text-h3 text-[#1F2937]">{task.title}</h4>
                        <p className="text-body text-[#4B5563]">
                          {task.description || '宝贝在硬件屏幕上完成了这项任务！'}
                        </p>
                      </div>

                      {/* 奖励徽章 (#FACC15 Tertiary) */}
                      <div className="bg-[#FFFFFF] border-2 border-[#FACC15] rounded-[20px] px-4 py-2 text-center shadow-kid-sm shrink-0">
                        <div className="flex items-center justify-center gap-1 font-headline font-bold text-[22px] text-[#92400E]">
                          <IconCoin className="w-6 h-6" />
                          <span>+{task.rewardCoins}</span>
                        </div>
                        <div className="text-mono text-[#6B7280] flex items-center justify-center gap-1 mt-0.5">
                          <IconClock className="w-3.5 h-3.5" />
                          <span>{task.submittedAt || '刚刚'}</span>
                        </div>
                      </div>
                    </div>

                    {/* 按钮组 (>=48px 触控目标 + 3px 按压位移 + 鼓励式文案) */}
                    <div className="mt-6 pt-4 border-t-2 border-[#FDE047] flex items-center justify-end gap-4 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setRejectingTask(task)}
                        className="kid-btn kid-btn-ghost kid-btn-md bg-white"
                      >
                        <span>再试一次!</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(task)}
                        className="kid-btn kid-btn-primary kid-btn-md"
                      >
                        <IconCheck className="w-5 h-5" />
                        <span>太棒了！发 +{task.rewardCoins} 金币</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 今日任务闯关清单 (KidLearn Lists: 56px+ row height, 20px container corners, 24px left icon with 12px gap) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-h3 text-[#1F2937]">今日闯关地图</h3>
            <span className="text-caption text-[#6B7280]">共 {filteredInstances.length} 关</span>
          </div>

          <div className="kid-list">
            {filteredInstances.map(task => {
              const child = children.find(c => c.id === task.childId);
              return (
                <div key={task.id} className="kid-list-row">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* 24px icon placed left with 12px gap */}
                    <div className="w-11 h-11 rounded-full bg-[#FEF3C7] border-2 border-[#FACC15] flex items-center justify-center shrink-0">
                      <IconStar className="w-6 h-6 text-[#F59E0B]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-headline font-bold text-[16px] text-[#1F2937] truncate">
                          {task.title}
                        </span>
                        <span className="text-caption text-[#3B82F6] bg-[#DBEAFE] px-2.5 py-0.5 rounded-full">
                          {child?.nickname || task.childNickname}
                        </span>
                      </div>
                      <div className="text-caption text-[#6B7280] flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[#92400E] font-bold">
                          <IconCoin className="w-4 h-4" />
                          +{task.rewardCoins} 金币
                        </span>
                        {task.deviceAlias && <span>· {task.deviceAlias}</span>}
                        {task.rejectReason && (
                          <span className="text-[#F59E0B]">· 提示: {task.rejectReason}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* KidLearn Status Chips */}
                  <div className="shrink-0">
                    {task.status === 'completed' && (
                      <span className="kid-status-chip kid-status-complete">
                        <IconCheck className="w-4 h-4" />
                        <span>已完成</span>
                      </span>
                    )}
                    {task.status === 'submitted' && (
                      <span className="kid-status-chip kid-status-new">
                        <IconSparkle className="w-4 h-4 text-[#F59E0B]" />
                        <span>新提交</span>
                      </span>
                    )}
                    {task.status === 'pending' && (
                      <span className="kid-status-chip kid-status-locked">
                        <IconLock className="w-4 h-4" />
                        <span>闯关中</span>
                      </span>
                    )}
                    {task.status === 'rejected' && (
                      <span className="kid-status-chip kid-status-active">
                        <IconStar className="w-4 h-4" />
                        <span>再试一次!</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredInstances.length === 0 && (
              <div className="p-8 text-center text-body text-[#6B7280]">
                今天还没有安排闯关任务哦
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 鼓励式“再试一次”弹窗 (Do #9: Forgiving error states -- "Try again!" not "Wrong answer.") */}
      <Dialog
        visible={Boolean(rejectingTask)}
        title="鼓励宝贝再试一次！"
        content={
          <div className="space-y-4 pt-2">
            <p className="text-body text-[#4B5563]">
              给【{rejectingTask?.childNickname}】发送一条温暖的提示，让他/她在桌面设备上再试一次：
            </p>
            <div>
              <label htmlFor="try-again-input" className="text-caption text-[#1F2937] block mb-2">
                鼓励提示语：
              </label>
              <textarea
                id="try-again-input"
                className="kid-input"
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="例如：加油！把字写工整一点就能拿到奖励星星啦！"
              />
            </div>
          </div>
        }
        actions={[
          [
            {
              key: 'cancel',
              text: '返回',
              onClick: () => setRejectingTask(null),
            },
            {
              key: 'confirm',
              text: '发送鼓励提示',
              bold: true,
              onClick: handleConfirmReject,
            },
          ],
        ]}
      />
    </PullToRefresh>
  );
};
