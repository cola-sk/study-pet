'use client';

import React, { useState } from 'react';
import { Dialog, Toast, PullToRefresh, Tabs } from 'antd-mobile';
import { useAppStore } from '../../stores/useAppStore';
import { TaskInstance } from '../../services/types';
import {
  IconCoin,
  IconDevice,
  IconCheck,
  IconClose,
  IconClock,
  IconBolt,
  IconClipboard,
  IconWifi,
  IconShieldCheck,
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

  const totalPendingCount = instances.filter(i => i.status === 'submitted').length;

  return (
    <PullToRefresh onRefresh={async () => { await new Promise(r => setTimeout(r, 600)); }}>
      <div className="p-4 space-y-5 pb-24">
        {/* 多孩子/多设备切换筛选 Tabs (8px/6px 紧凑同心结构) */}
        <div className="segmented select-none">
          <Tabs activeKey={selectedChildId} onChange={setSelectedChildId}>
            <Tabs.Tab
              title={
                <span className="flex items-center gap-1.5 text-xs">
                  <span>全部成员</span>
                  {totalPendingCount > 0 && (
                    <span className="bg-indigo-600 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded flex items-center justify-center font-mono font-bold">
                      {totalPendingCount}
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
                    <span className="flex items-center gap-1.5 text-xs">
                      <span>{child.nickname}</span>
                      {childPendingCount > 0 && (
                        <span className="bg-indigo-600 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded flex items-center justify-center font-mono font-bold">
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

        {/* 顶部成员与硬件终端概览面板 (Bento 结构化数据卡) */}
        <div className="grid grid-cols-1 gap-3">
          {(selectedChildId === 'all' ? children : children.filter(c => c.id === selectedChildId)).map(child => {
            const pet = pets[child.id];
            const device = devices.find(d => d.childId === child.id);
            const childTasks = instances.filter(i => i.childId === child.id);
            const childCompleted = childTasks.filter(i => i.status === 'completed').length;
            const childPending = childTasks.filter(i => i.status === 'submitted').length;
            const childTotal = childTasks.length;
            const progressPct = childTotal > 0 ? Math.round((childCompleted / childTotal) * 100) : 0;

            return (
              <div
                key={child.id}
                className="card-surface bg-white rounded-xl border border-slate-200/90 shadow-card overflow-hidden"
              >
                {/* 卡片上半部：成员信息与关联硬件终端状态 */}
                <div className="p-3.5 flex items-center justify-between border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xl border border-slate-200/80 shrink-0">
                      {pet?.currentClothesItem?.icon || pet?.petAvatar || '🐶'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900">{child.nickname}</h2>
                        <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-1.5 py-0.5 rounded font-medium">
                          宠物: {pet?.petName || '伴学宠'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <IconDevice className="w-3.5 h-3.5 text-slate-400" />
                        <span>{device?.alias || '暂未绑定桌面硬件'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 硬件连接状态标签 */}
                  <div className="text-right shrink-0">
                    <div
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${
                        device
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      <IconWifi className="w-3 h-3" />
                      <span>{device ? '终端在线' : '未连接'}</span>
                    </div>
                  </div>
                </div>

                {/* 卡片下半部：三栏精密指标矩阵 (KPI Strip) */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/50">
                  <div className="px-3.5 py-2.5">
                    <div className="text-[11px] text-slate-500 font-medium">账户金币</div>
                    <div className="mt-0.5 flex items-center gap-1">
                      <IconCoin className="w-4 h-4 shrink-0" />
                      <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                        {child.coinsBalance}
                      </span>
                    </div>
                  </div>

                  <div className="px-3.5 py-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>今日完成</span>
                      <span className="font-mono font-semibold text-slate-700">{childCompleted}/{childTotal}</span>
                    </div>
                    <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-sm overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
                      <div
                        className="bg-indigo-600 h-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="px-3.5 py-2.5">
                    <div className="text-[11px] text-slate-500 font-medium">待我确认</div>
                    <div className="mt-0.5 flex items-baseline gap-1">
                      <span
                        className={`text-base font-bold font-mono tabular-nums ${
                          childPending > 0 ? 'text-amber-600' : 'text-slate-400'
                        }`}
                      >
                        {childPending}
                      </span>
                      <span className="text-[11px] text-slate-400">项</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 待确认审批工单列表 (Structured Approval Tickets) */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <IconBolt className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">待审批打卡工单</h3>
              {submittedTasks.length > 0 && (
                <span className="bg-amber-100 text-amber-800 border border-amber-200/80 text-xs px-1.5 py-0.5 rounded font-mono font-bold">
                  {submittedTasks.length}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">硬件端提交后实时同步</span>
          </div>

          {submittedTasks.length === 0 ? (
            <div className="card-surface bg-white rounded-xl p-6 text-center border border-slate-200/90 shadow-card">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200/70 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <IconShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-sm text-slate-800 font-semibold">所有打卡工单已处理完毕</div>
              <div className="text-xs text-slate-400 mt-1">孩子在微雪桌面屏幕上打卡后，工单将在此处呈现</div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {submittedTasks.map(task => {
                const child = children.find(c => c.id === task.childId);
                return (
                  <div
                    key={task.id}
                    className="card-surface bg-white rounded-xl border border-slate-200/90 border-l-[3px] border-l-indigo-600 shadow-card overflow-hidden"
                  >
                    {/* 工单顶栏元数据 */}
                    <div className="px-3.5 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 bg-white border border-slate-200/90 px-1.5 py-0.5 rounded">
                          {child?.nickname || task.childNickname}
                        </span>
                        {task.deviceAlias && (
                          <span className="text-slate-500 flex items-center gap-1">
                            <IconDevice className="w-3.5 h-3.5 text-slate-400" />
                            {task.deviceAlias}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 font-mono flex items-center gap-1">
                        <IconClock className="w-3.5 h-3.5" />
                        <span>{task.submittedAt || '刚刚'}</span>
                      </div>
                    </div>

                    {/* 工单主体内容 */}
                    <div className="p-3.5 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-[15px] leading-snug">{task.title}</div>
                        <div className="text-xs text-slate-500 mt-1">{task.description || '已在硬件终端完成打卡提交'}</div>
                      </div>

                      <div className="shrink-0 bg-amber-50/90 border border-amber-200/80 rounded-lg px-2.5 py-1.5 text-right">
                        <div className="text-sm font-bold font-mono text-amber-700 flex items-center gap-1">
                          <IconCoin className="w-3.5 h-3.5" />
                          <span>+{task.rewardCoins}</span>
                        </div>
                        <div className="text-[10px] text-amber-600/90 font-medium text-center">奖励金币</div>
                      </div>
                    </div>

                    {/* 工单操作底栏 */}
                    <div className="px-3.5 py-2.5 bg-slate-50/40 border-t border-slate-100 flex items-center justify-end gap-2 select-none">
                      <button
                        type="button"
                        onClick={() => setRejectingTask(task)}
                        className="px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-medium inline-flex items-center gap-1 transition-all"
                      >
                        <IconClose className="w-3.5 h-3.5 text-slate-500" />
                        <span>驳回重做</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(task)}
                        className="px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold inline-flex items-center gap-1 shadow-xs transition-all"
                      >
                        <IconCheck className="w-3.5 h-3.5" />
                        <span>批准并发币</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 今日全部任务执行矩阵 */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <IconClipboard className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">今日任务执行明细</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">共 {filteredInstances.length} 项</span>
          </div>

          <div className="card-surface bg-white rounded-xl border border-slate-200/90 shadow-card divide-y divide-slate-100 overflow-hidden">
            {filteredInstances.map(task => {
              const child = children.find(c => c.id === task.childId);
              return (
                <div key={task.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded shrink-0">
                        {child?.nickname || task.childNickname}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 truncate">{task.title}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 font-mono font-medium text-amber-700">
                        <IconCoin className="w-3.5 h-3.5" />
                        +{task.rewardCoins}
                      </span>
                      {task.deviceAlias && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-400">{task.deviceAlias}</span>
                        </>
                      )}
                      {task.rejectReason && (
                        <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-[11px]">
                          原因: {task.rejectReason}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {task.status === 'completed' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded font-medium">
                        <IconCheck className="w-3 h-3" />
                        已发币
                      </span>
                    )}
                    {task.status === 'submitted' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200/80 px-2 py-0.5 rounded font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        待确认
                      </span>
                    )}
                    {task.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        待提交
                      </span>
                    )}
                    {task.status === 'rejected' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200/80 px-2 py-0.5 rounded font-medium">
                        <IconClose className="w-3 h-3" />
                        已驳回
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredInstances.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-xs">
                当前筛选下暂无任务记录
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 驳回确认弹窗 */}
      <Dialog
        visible={Boolean(rejectingTask)}
        title="驳回打卡任务"
        content={
          <div className="space-y-3 pt-2">
            <p className="text-xs text-slate-500">
              驳回后，任务将退回至【{rejectingTask?.childNickname}】桌面终端的“待提交”列表。
            </p>
            <label htmlFor="reject-reason-textarea" className="text-xs font-semibold text-slate-800 block">
              驳回说明：
            </label>
            <textarea
              id="reject-reason-textarea"
              className="w-full border border-slate-300 bg-slate-50 rounded-lg p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="请输入驳回原因或改进建议..."
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
              text: '确认驳回',
              danger: true,
              onClick: handleConfirmReject,
            },
          ],
        ]}
      />
    </PullToRefresh>
  );
};
