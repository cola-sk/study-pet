'use client';

import React, { useState } from 'react';
import { Tabs } from 'antd-mobile';
import { useAppStore } from '../../stores/useAppStore';
import { IconCoin, IconDevice } from '../../components/Icons';

export const PetWalletPage: React.FC = () => {
  const { children, pets, transactions, shopItems } = useAppStore();
  const [currentChildId, setCurrentChildId] = useState<string>(children[0]?.id || 'child-101');

  const currentChild = children.find(c => c.id === currentChildId) || children[0];
  const pet = pets[currentChild?.id || ''] || pets['child-101'];

  const childTransactions = transactions.filter(t => t.childId === currentChild?.id);

  const totalEarnedToday = childTransactions
    .filter(t => t.type === 'task_reward' && t.createdAt.includes('今天'))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpent = childTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className="p-4 space-y-5 pb-24 text-slate-900">
      {/* 成员切换 Tab */}
      <div className="segmented select-none">
        <Tabs activeKey={currentChildId} onChange={setCurrentChildId}>
          {children.map(child => (
            <Tabs.Tab
              title={<span className="text-xs">{child.nickname}</span>}
              key={child.id}
            />
          ))}
        </Tabs>
      </div>

      {/* 宠物硬件屏幕状态面板 (结构化双栏仪表视窗) */}
      <div className="card-surface bg-white rounded-xl border border-slate-200/90 shadow-card overflow-hidden">
        {/* 模拟终端状态顶栏 */}
        <div className="px-3.5 py-2 bg-slate-900 text-white flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <IconDevice className="w-3.5 h-3.5 text-indigo-400" />
            <span>{currentChild?.nickname} · 桌面宠物状态监控</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">SYNC: LIVE</span>
        </div>

        {/* 主体：左侧形象与装扮，右侧物资指标 */}
        <div className="p-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-lg bg-slate-50 border border-slate-200/90 flex items-center justify-center text-4xl shrink-0">
            {pet?.petAvatar || '🐶'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-base">
                {pet?.petName || `${currentChild?.nickname}的伴学宠`}
              </h3>
              {pet?.currentClothesItem ? (
                <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200/70 px-1.5 py-0.5 rounded font-medium">
                  <span>{pet.currentClothesItem.icon}</span>
                  <span>已穿戴: {pet.currentClothesItem.name}</span>
                </span>
              ) : (
                <span className="text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                  未穿戴饰品
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              状态良好，可在关联的微雪硬件屏幕上投喂互动
            </p>
          </div>
        </div>

        {/* 底部物资储量条 */}
        <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/60 text-xs">
          <div className="px-3.5 py-2.5 flex items-center justify-between">
            <span className="text-slate-500 font-medium">🍎 食物库存</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{pet?.foodCount || 0} 份</span>
          </div>
          <div className="px-3.5 py-2.5 flex items-center justify-between">
            <span className="text-slate-500 font-medium">💧 饮水库存</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{pet?.waterCount || 0} 份</span>
          </div>
        </div>
      </div>

      {/* 账户资产三栏总览 (Unified KPI Panel) */}
      <div className="card-surface bg-white rounded-xl border border-slate-200/90 shadow-card grid grid-cols-3 divide-x divide-slate-100 overflow-hidden">
        <div className="p-3.5">
          <div className="text-[11px] text-slate-500 font-medium">可用金币</div>
          <div className="mt-1 flex items-center gap-1">
            <IconCoin className="w-4 h-4 shrink-0" />
            <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
              {currentChild?.coinsBalance || 0}
            </span>
          </div>
        </div>
        <div className="p-3.5">
          <div className="text-[11px] text-slate-500 font-medium">今日赚取</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-emerald-600">
            +{totalEarnedToday}
          </div>
        </div>
        <div className="p-3.5">
          <div className="text-[11px] text-slate-500 font-medium">累计兑换</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-600">
            -{totalSpent}
          </div>
        </div>
      </div>

      {/* 终端兑换商店目录 */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">硬件端商店价目表</h3>
          <span className="text-xs text-slate-400">孩子在硬件屏幕自主兑换</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {shopItems.map(item => (
            <div
              key={item.id}
              className="card-surface bg-white rounded-xl p-3 border border-slate-200/90 shadow-card flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <span className="text-2xl leading-none">{item.icon}</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200/80 px-1.5 py-0.5 rounded font-medium">
                  {item.category === 'clothes' ? '装扮' : '补给'}
                </span>
              </div>
              <div className="mt-2.5">
                <div className="font-semibold text-xs text-slate-900 truncate">{item.name}</div>
                <div className="text-xs text-amber-700 font-mono font-bold mt-0.5 flex items-center gap-0.5">
                  <IconCoin className="w-3 h-3" />
                  <span>{item.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 金币收支账本流水 */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">金币收支账本</h3>
          <span className="text-xs text-slate-400 font-mono">共 {childTransactions.length} 笔</span>
        </div>

        <div className="card-surface bg-white rounded-xl shadow-card border border-slate-200/90 divide-y divide-slate-100 overflow-hidden">
          {childTransactions.map(tx => (
            <div key={tx.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50/50 transition-colors">
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900 text-sm">{tx.description}</div>
                <div className="text-xs text-slate-400 font-mono">
                  {tx.createdAt} · 结余 {tx.balanceAfter}
                </div>
              </div>
              <div
                className={`font-bold font-mono text-sm tabular-nums px-2 py-0.5 rounded ${
                  tx.amount > 0
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60'
                    : 'text-slate-700 bg-slate-100 border border-slate-200'
                }`}
              >
                {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
              </div>
            </div>
          ))}

          {childTransactions.length === 0 && (
            <div className="p-6 text-center text-slate-400 text-xs">暂无收支记录</div>
          )}
        </div>
      </section>
    </div>
  );
};
