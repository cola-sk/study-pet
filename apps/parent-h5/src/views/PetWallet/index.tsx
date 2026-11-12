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
    <div className="px-3.5 py-3.5 space-y-4 pb-24 text-[#1F2937]">
      {/* KidLearn Filter Chips 切换宝贝 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="选择孩子">
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
              <span className="text-sm leading-none">{child.avatarIcon || '🧒'}</span>
              <span>{child.nickname}的乐园</span>
            </button>
          );
        })}
      </div>

      {/* 宠物展示舞台 (紧凑横向+双栏布局) */}
      <div className="kid-card-highlight">
        <div className="flex items-center justify-between mb-3">
          <span className="kid-status-chip kid-status-active">
            <IconStar className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>{currentChild?.nickname}的伙伴</span>
          </span>
          <span className="kid-status-chip kid-status-complete">
            <IconCheck className="w-3.5 h-3.5" />
            <span>活力满满</span>
          </span>
        </div>

        <div className="flex items-center gap-3.5">
          <div className="w-16 h-16 rounded-full bg-[#FFFFFF] border-2 border-[#FACC15] flex items-center justify-center text-4xl shadow-kid-sm shrink-0">
            {pet?.petAvatar || '🐶'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-h2 text-[#1F2937]">
                {pet?.petName || `${currentChild?.nickname}的小伙伴`}
              </h2>
              {pet?.currentClothesItem && (
                <span className="inline-flex items-center gap-1 bg-[#FFFFFF] border border-[#3B82F6] px-2 py-0.5 rounded-full text-[11px] font-bold text-[#1E40AF]">
                  <span>{pet.currentClothesItem.icon}</span>
                  <span>{pet.currentClothesItem.name}</span>
                </span>
              )}
            </div>
            <p className="text-caption text-[#6B7280] mt-0.5">
              快在桌面设备上用金币给它买好吃的吧！
            </p>
          </div>
        </div>

        {/* 食物与饮水背包 */}
        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] p-2.5 flex items-center gap-2.5">
            <span className="text-xl">🍎</span>
            <div>
              <div className="text-[11px] text-[#6B7280] font-semibold">美味食物</div>
              <div className="text-h3 text-[#1F2937]">{pet?.foodCount || 0} 份</div>
            </div>
          </div>
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-[12px] p-2.5 flex items-center gap-2.5">
            <span className="text-xl">💧</span>
            <div>
              <div className="text-[11px] text-[#6B7280] font-semibold">甘甜饮水</div>
              <div className="text-h3 text-[#1F2937]">{pet?.waterCount || 0} 份</div>
            </div>
          </div>
        </div>
      </div>

      {/* 金币储蓄罐统计 */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="kid-card !p-3 text-center">
          <div className="text-caption text-[#6B7280]">现有金币</div>
          <div className="text-h3 text-[#92400E] mt-0.5 flex items-center justify-center gap-1">
            <IconCoin className="w-4 h-4" />
            <span>{currentChild?.coinsBalance || 0}</span>
          </div>
        </div>
        <div className="kid-card !p-3 text-center">
          <div className="text-caption text-[#6B7280]">今日收获</div>
          <div className="text-h3 text-[#22C55E] mt-0.5">+{totalEarnedToday}</div>
        </div>
        <div className="kid-card !p-3 text-center">
          <div className="text-caption text-[#6B7280]">礼物兑换</div>
          <div className="text-h3 text-[#3B82F6] mt-0.5">-{totalSpent}</div>
        </div>
      </div>

      {/* 宠物商店 */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-h2 text-[#1F2937]">礼物商店</h3>
          <span className="text-caption text-[#6B7280]">在桌面屏幕可兑换</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {shopItems.map(item => (
            <div key={item.id} className="kid-card !p-2.5 text-center flex flex-col items-center">
              <div className="w-11 h-11 rounded-full bg-[#FEF3C7] border border-[#FACC15] flex items-center justify-center text-2xl mb-1.5">
                {item.icon}
              </div>
              <div className="font-headline font-bold text-[13px] text-[#1F2937] truncate w-full">{item.name}</div>
              <div className="mt-1 inline-flex items-center gap-0.5 bg-[#FEF3C7] text-[#92400E] px-2 py-0.5 rounded-full font-headline font-bold text-[11px]">
                <IconCoin className="w-3 h-3" />
                <span>{item.price}</span>
              </div>
              <span className="mt-1 text-[10px] text-[#6B7280]">
                {item.category === 'clothes' ? '装扮' : '补给'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 金币奖励记录 */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-h2 text-[#1F2937]">星星金币账本</h3>
          <span className="text-caption text-[#6B7280]">共 {childTransactions.length} 条</span>
        </div>

        <div className="kid-list">
          {childTransactions.map(tx => (
            <div key={tx.id} className="kid-list-row">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full bg-[#FEF3C7] border border-[#FACC15] flex items-center justify-center shrink-0">
                  {tx.amount > 0 ? (
                    <IconSparkle className="w-4 h-4 text-[#F59E0B]" />
                  ) : (
                    <IconStar className="w-4 h-4 text-[#3B82F6]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-headline font-bold text-[13px] text-[#1F2937] truncate">
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
            <div className="p-6 text-center text-body text-[#6B7280]">还没有金币记录哦</div>
          )}
        </div>
      </section>
    </div>
  );
};
