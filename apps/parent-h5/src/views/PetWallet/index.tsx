'use client';

import React, { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { IconCoin } from '../../components/Icons';

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
    <div className="px-3 py-2.5 space-y-3 pb-20 text-[#1F2937]">
      {/* 切换宝贝 */}
      <div className="flex items-center gap-1.5 overflow-x-auto" role="tablist" aria-label="选择孩子">
        {children.map(child => {
          const isSelected = currentChildId === child.id;
          return (
            <button
              key={child.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setCurrentChildId(child.id)}
              className={`kid-filter-chip ${isSelected ? 'kid-filter-chip-selected' : ''}`}
            >
              <span>{child.avatarIcon || '🧒'}</span>
              <span>{child.nickname}</span>
            </button>
          );
        })}
      </div>

      {/* 宠物与金币一体化紧凑卡片 */}
      <div className="kid-card space-y-2.5">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-full bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center text-2xl shrink-0">
              {pet?.petAvatar || '🐶'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-h2 text-[#1F2937] truncate">
                  {pet?.petName || `${currentChild?.nickname}的小宠`}
                </h2>
                {pet?.currentClothesItem && (
                  <span className="kid-status-chip kid-status-active">
                    {pet.currentClothesItem.icon} {pet.currentClothesItem.name}
                  </span>
                )}
              </div>
              <div className="text-caption text-[#6B7280] mt-0.5 flex items-center gap-3">
                <span>🍎 食物 {pet?.foodCount || 0}</span>
                <span>💧 饮水 {pet?.waterCount || 0}</span>
              </div>
            </div>
          </div>

          <span className="kid-status-chip kid-status-complete shrink-0">状态良好</span>
        </div>

        {/* 3栏金币数据 */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F3F4F6] text-center">
          <div className="bg-[#F9FAFB] rounded-lg py-1.5 px-2">
            <div className="text-caption text-[#6B7280]">当前金币</div>
            <div className="text-h3 text-[#B45309] mt-0.5 flex items-center justify-center gap-0.5">
              <IconCoin className="w-3.5 h-3.5" />
              <span>{currentChild?.coinsBalance || 0}</span>
            </div>
          </div>
          <div className="bg-[#F9FAFB] rounded-lg py-1.5 px-2">
            <div className="text-caption text-[#6B7280]">今日获得</div>
            <div className="text-h3 text-[#16A34A] mt-0.5">+{totalEarnedToday}</div>
          </div>
          <div className="bg-[#F9FAFB] rounded-lg py-1.5 px-2">
            <div className="text-caption text-[#6B7280]">累计消耗</div>
            <div className="text-h3 text-[#2563EB] mt-0.5">-{totalSpent}</div>
          </div>
        </div>
      </div>

      {/* 宠物商店 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="text-h2 text-[#1F2937]">小宠商店</h3>
          <span className="text-caption text-[#9CA3AF]">在桌面硬件屏幕兑换</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {shopItems.map(item => (
            <div key={item.id} className="kid-card !p-2 text-center flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-[#FEF3C7] flex items-center justify-center text-lg mb-1">
                {item.icon}
              </div>
              <div className="font-semibold text-[12px] text-[#1F2937] truncate w-full">{item.name}</div>
              <div className="mt-0.5 inline-flex items-center gap-0.5 text-[#B45309] font-bold text-[11px]">
                <IconCoin className="w-3 h-3" />
                <span>{item.price}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 金币明细 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="text-h2 text-[#1F2937]">金币明细</h3>
          <span className="text-caption text-[#9CA3AF]">共 {childTransactions.length} 条</span>
        </div>

        <div className="kid-list">
          {childTransactions.map(tx => (
            <div key={tx.id} className="kid-list-row">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[12px] text-[#1F2937] truncate">
                  {tx.description}
                </div>
                <div className="text-mono text-[#9CA3AF]">
                  {tx.createdAt} · 余额 {tx.balanceAfter}
                </div>
              </div>

              <span
                className={`font-headline font-bold text-[13px] shrink-0 ${
                  tx.amount > 0 ? 'text-[#16A34A]' : 'text-[#6B7280]'
                }`}
              >
                {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
              </span>
            </div>
          ))}

          {childTransactions.length === 0 && (
            <div className="p-4 text-center text-body text-[#9CA3AF]">暂无金币记录</div>
          )}
        </div>
      </section>
    </div>
  );
};
