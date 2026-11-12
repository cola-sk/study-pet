'use client';

import React, { useState } from 'react';
import { Tag, Tabs } from 'antd-mobile';
import { useAppStore } from '../../stores/useAppStore';

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
    <div className="p-4 space-y-4 pb-24 text-[#2D2621]">
      {/* 孩子切换 Tab (日式原木温润分段控制器) */}
      <div className="segmented bg-[#EFECE6] rounded-full p-1 border border-[#E5DFD4]">
        <Tabs activeKey={currentChildId} onChange={setCurrentChildId}>
          {children.map(child => (
            <Tabs.Tab
              title={
                <span className="flex items-center gap-1 font-semibold text-xs">
                  <span>{child.nickname}</span>
                </span>
              }
              key={child.id}
            />
          ))}
        </Tabs>
      </div>

      {/* 宠物状态视窗 (素雅伴学小窝) */}
      <div className="bg-white rounded-3xl p-5 border border-[#EAE5DC] shadow-[0_2px_12px_rgba(60,48,36,0.04)] text-center relative overflow-hidden">
        <div className="absolute top-3.5 left-4 text-xs font-medium text-[#D96B43] bg-[#FDF3EE] border border-[#F8D8CB] px-3 py-0.5 rounded-full">
          {currentChild?.nickname}的小窝
        </div>
        <div className="absolute top-3.5 right-4 text-xs text-[#A89F95]">
          伴学宠物
        </div>

        {/* 宠物形象 */}
        <div className="py-6 flex flex-col items-center justify-center">
          <div className="relative">
            <div className="w-28 h-28 bg-[#FEF8ED] rounded-full flex items-center justify-center text-6xl border border-[#FCE7C2] shadow-xs">
              {pet?.petAvatar || '🐶'}
            </div>
            {pet?.currentClothesItem && (
              <div className="absolute -bottom-2 right-0 bg-white shadow-sm border border-[#EAE5DC] px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 text-[#2D2621]">
                <span>{pet.currentClothesItem.icon}</span>
                <span>{pet.currentClothesItem.name}</span>
              </div>
            )}
          </div>

          <div className="mt-3.5">
            <div className="font-bold text-[#2D2621] text-base">{pet?.petName || `${currentChild?.nickname}的小伙伴`}</div>
            <div className="text-xs text-[#7D7267] mt-1">开心健康，等待在桌面设备屏幕上互动</div>
          </div>

          {/* 背包物资 */}
          <div className="mt-4 flex items-center justify-center space-x-6 bg-[#F7F5F0] py-2 px-6 rounded-2xl border border-[#EAE5DC]">
            <div className="flex items-center space-x-1.5 text-xs text-[#2D2621]">
              <span className="text-xl">🍎</span>
              <span>食物库存: <strong className="text-[#D96B43] font-bold">{pet?.foodCount || 0}</strong></span>
            </div>
            <div className="w-px h-4 bg-[#EAE5DC]"></div>
            <div className="flex items-center space-x-1.5 text-xs text-[#2D2621]">
              <span className="text-xl">💧</span>
              <span>饮水库存: <strong className="text-[#5C829B] font-bold">{pet?.waterCount || 0}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 虚拟金币账户总览 */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white rounded-3xl p-3.5 shadow-[0_2px_8px_rgba(60,48,36,0.03)] border border-[#EAE5DC] text-center">
          <div className="text-xs text-[#7D7267] mb-1">可用金币</div>
          <div className="text-lg font-bold text-[#C88A2E]">🪙 {currentChild?.coinsBalance || 0}</div>
        </div>
        <div className="bg-white rounded-3xl p-3.5 shadow-[0_2px_8px_rgba(60,48,36,0.03)] border border-[#EAE5DC] text-center">
          <div className="text-xs text-[#7D7267] mb-1">今日赚取</div>
          <div className="text-lg font-bold text-[#4F7757]">+{totalEarnedToday}</div>
        </div>
        <div className="bg-white rounded-3xl p-3.5 shadow-[0_2px_8px_rgba(60,48,36,0.03)] border border-[#EAE5DC] text-center">
          <div className="text-xs text-[#7D7267] mb-1">历史消费</div>
          <div className="text-lg font-bold text-[#7D7267]">-{totalSpent}</div>
        </div>
      </div>

      {/* 设备端商店商品一览 */}
      <div>
        <div className="flex items-center justify-between mb-2 mt-3">
          <h3 className="text-base font-bold text-[#2D2621]">桌面商店</h3>
          <span className="text-xs text-[#A89F95]">孩子在桌面设备自主兑换</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {shopItems.map(item => (
            <div key={item.id} className="bg-white rounded-3xl p-3.5 border border-[#EAE5DC] shadow-[0_2px_8px_rgba(60,48,36,0.03)] text-center">
              <div className="text-3xl mb-1.5">{item.icon}</div>
              <div className="font-semibold text-xs text-[#2D2621] truncate">{item.name}</div>
              <div className="text-xs text-[#C88A2E] font-bold mt-1">🪙 {item.price} 金币</div>
              <span className="inline-block text-[10px] mt-1.5 bg-[#F7F5F0] text-[#7D7267] px-2 py-0.5 rounded-full border border-[#EAE5DC]">
                {item.category === 'clothes' ? '永久服饰' : '消耗品'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 该孩子的金币流水 */}
      <div>
        <div className="flex items-center justify-between mb-2 mt-5">
          <h3 className="text-base font-bold text-[#2D2621]">金币明细</h3>
          <span className="text-xs text-[#A89F95]">独立账本流水</span>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(60,48,36,0.04)] border border-[#EAE5DC] divide-y divide-[#F3EFEA] overflow-hidden">
          {childTransactions.map(tx => (
            <div key={tx.id} className="p-3.5 flex items-center justify-between text-xs">
              <div className="space-y-1">
                <div className="font-medium text-[#2D2621]">{tx.description}</div>
                <div className="text-xs text-[#A89F95]">
                  {tx.createdAt} · 变动后余额: {tx.balanceAfter} 金币
                </div>
              </div>
              <div
                className={`font-bold text-sm ${
                  tx.amount > 0 ? 'text-[#4F7757]' : 'text-[#C85A5A]'
                }`}
              >
                {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
              </div>
            </div>
          ))}

          {childTransactions.length === 0 && (
            <div className="p-6 text-center text-[#A89F95] text-xs">该孩子暂无交易记录</div>
          )}
        </div>
      </div>
    </div>
  );
};
