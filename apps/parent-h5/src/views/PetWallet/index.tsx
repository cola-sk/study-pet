'use client';

import React, { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { IconCoin, IconStar, IconSparkle, IconCheck } from '../../components/Icons';

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
    <div className="px-4 py-6 space-y-8 pb-32 text-[#1F2937]">
      {/* KidLearn Filter Chips 切换宝贝 */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2" role="tablist" aria-label="选择孩子">
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
              <span className="text-lg leading-none">{child.avatarIcon || '🧒'}</span>
              <span>{child.nickname}的乐园</span>
            </button>
          );
        })}
      </div>

      {/* 宠物展示大舞台 (Surface Highlight #FEF3C7) */}
      <div className="kid-card-highlight text-center relative">
        <div className="flex items-center justify-between mb-4">
          <span className="kid-status-chip kid-status-active">
            <IconStar className="w-4 h-4 text-[#3B82F6]" />
            <span>{currentChild?.nickname}的伙伴</span>
          </span>
          <span className="kid-status-chip kid-status-complete">
            <IconCheck className="w-4 h-4" />
            <span>活力满满</span>
          </span>
        </div>

        {/* 50% Circle Avatar */}
        <div className="py-2 flex flex-col items-center justify-center">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-[#FFFFFF] border-4 border-[#FACC15] flex items-center justify-center text-6xl shadow-kid-md">
              {pet?.petAvatar || '🐶'}
            </div>
            {pet?.currentClothesItem && (
              <div className="mt-2 inline-flex items-center gap-1.5 bg-[#FFFFFF] border-2 border-[#3B82F6] px-3 py-1 rounded-full text-caption text-[#1E40AF] shadow-kid-sm">
                <span>{pet.currentClothesItem.icon}</span>
                <span>穿戴: {pet.currentClothesItem.name}</span>
              </div>
            )}
          </div>

          <h2 className="text-h2 text-[#1F2937] mt-4">
            {pet?.petName || `${currentChild?.nickname}的小伙伴`}
          </h2>
          <p className="text-body text-[#6B7280] mt-1">
            快在桌面设备上用金币给它买好吃的吧！
          </p>

          {/* 食物与饮水背包 */}
          <div className="mt-6 w-full grid grid-cols-2 gap-4">
            <div className="bg-[#FFFFFF] border-2 border-[#E5E7EB] rounded-[20px] p-4 flex items-center justify-center gap-3 shadow-kid-sm">
              <span className="text-3xl">🍎</span>
              <div className="text-left">
                <div className="text-caption text-[#6B7280]">美味食物</div>
                <div className="text-h3 text-[#1F2937]">{pet?.foodCount || 0} 份</div>
              </div>
            </div>
            <div className="bg-[#FFFFFF] border-2 border-[#E5E7EB] rounded-[20px] p-4 flex items-center justify-center gap-3 shadow-kid-sm">
              <span className="text-3xl">💧</span>
              <div className="text-left">
                <div className="text-caption text-[#6B7280]">甘甜饮水</div>
                <div className="text-h3 text-[#1F2937]">{pet?.waterCount || 0} 份</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 金币储蓄罐统计 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="kid-card !p-4 text-center">
          <div className="text-caption text-[#6B7280]">现有金币</div>
          <div className="text-h3 text-[#92400E] mt-1 flex items-center justify-center gap-1">
            <IconCoin className="w-5 h-5" />
            <span>{currentChild?.coinsBalance || 0}</span>
          </div>
        </div>
        <div className="kid-card !p-4 text-center">
          <div className="text-caption text-[#6B7280]">今日收获</div>
          <div className="text-h3 text-[#22C55E] mt-1">+{totalEarnedToday}</div>
        </div>
        <div className="kid-card !p-4 text-center">
          <div className="text-caption text-[#6B7280]">礼物兑换</div>
          <div className="text-h3 text-[#3B82F6] mt-1">-{totalSpent}</div>
        </div>
      </div>

      {/* 宠物商店 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-h3 text-[#1F2937]">礼物商店</h3>
          <span className="text-caption text-[#6B7280]">在桌面屏幕可兑换</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {shopItems.map(item => (
            <div key={item.id} className="kid-card !p-4 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#FEF3C7] border-2 border-[#FACC15] flex items-center justify-center text-4xl mb-3">
                {item.icon}
              </div>
              <div className="font-headline font-bold text-[18px] text-[#1F2937]">{item.name}</div>
              <div className="mt-2 inline-flex items-center gap-1 bg-[#FEF3C7] text-[#92400E] px-3 py-1 rounded-full font-headline font-bold text-caption">
                <IconCoin className="w-4 h-4" />
                <span>{item.price} 金币</span>
              </div>
              <span className="mt-2 text-caption text-[#6B7280]">
                {item.category === 'clothes' ? '帅气装扮' : '能量补给'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 金币奖励记录 (KidLearn Lists) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-h3 text-[#1F2937]">星星金币账本</h3>
          <span className="text-caption text-[#6B7280]">共 {childTransactions.length} 条</span>
        </div>

        <div className="kid-list">
          {childTransactions.map(tx => (
            <div key={tx.id} className="kid-list-row">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-full bg-[#FEF3C7] border-2 border-[#FACC15] flex items-center justify-center shrink-0">
                  {tx.amount > 0 ? (
                    <IconSparkle className="w-5 h-5 text-[#F59E0B]" />
                  ) : (
                    <IconStar className="w-5 h-5 text-[#3B82F6]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-headline font-bold text-[16px] text-[#1F2937] truncate">
                    {tx.description}
                  </div>
                  <div className="text-mono text-[#6B7280]">
                    {tx.createdAt} · 余额 {tx.balanceAfter}
                  </div>
                </div>
              </div>

              <span
                className={`kid-status-chip ${
                  tx.amount > 0 ? 'kid-status-complete' : 'kid-status-active'
                }`}
              >
                {tx.amount > 0 ? `+${tx.amount}` : tx.amount} 金币
              </span>
            </div>
          ))}

          {childTransactions.length === 0 && (
            <div className="p-8 text-center text-body text-[#6B7280]">还没有金币记录哦</div>
          )}
        </div>
      </section>
    </div>
  );
};
