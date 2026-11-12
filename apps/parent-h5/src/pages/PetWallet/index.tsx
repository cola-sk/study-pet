import React from 'react';
import { Tag } from 'antd-mobile';
import { useAppStore } from '../../stores/useAppStore';

export const PetWalletPage: React.FC = () => {
  const { child, pet, transactions, shopItems } = useAppStore();

  const totalEarnedToday = transactions
    .filter(t => t.type === 'task_reward' && t.createdAt.includes('今天'))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSpent = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* 宠物状态视窗 */}
      <div className="bg-gradient-to-b from-indigo-50 to-white rounded-3xl p-5 border border-indigo-100 shadow-sm text-center relative overflow-hidden">
        <div className="absolute top-3 left-4 text-xs font-bold text-indigo-800 bg-indigo-100/70 px-2.5 py-1 rounded-full">
          🐾 {child.nickname}的宠物小窝
        </div>
        <div className="absolute top-3 right-4 text-[11px] text-gray-400">
          与微雪设备实时同步
        </div>

        {/* 宠物形象大图 */}
        <div className="py-6 flex flex-col items-center justify-center">
          <div className="relative">
            <div className="w-28 h-28 bg-gradient-to-br from-amber-100 to-orange-200 rounded-full flex items-center justify-center text-6xl shadow-inner border-4 border-white animate-bounce-slow">
              🐶
            </div>
            {/* 衣服贴纸 */}
            {pet.currentClothesItem && (
              <div className="absolute -bottom-2 right-0 bg-white shadow-md border border-gray-100 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                <span>{pet.currentClothesItem.icon}</span>
                <span>{pet.currentClothesItem.name}</span>
              </div>
            )}
          </div>

          <div className="mt-3">
            <div className="font-bold text-gray-800 text-base">{child.nickname}的小伙伴</div>
            <div className="text-xs text-gray-400 mt-0.5">开心健康，等待孩子在屏幕上互动</div>
          </div>

          {/* 背包物资 */}
          <div className="mt-4 flex items-center justify-center space-x-6 bg-white/80 py-2.5 px-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center space-x-1.5 text-xs text-gray-700">
              <span className="text-xl">🍎</span>
              <span>食物库存: <strong className="text-orange-600 font-bold">{pet.foodCount}</strong></span>
            </div>
            <div className="w-px h-4 bg-gray-200"></div>
            <div className="flex items-center space-x-1.5 text-xs text-gray-700">
              <span className="text-xl">💧</span>
              <span>饮水库存: <strong className="text-blue-600 font-bold">{pet.waterCount}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 虚拟金币账户总览 */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 text-center">
          <div className="text-[11px] text-gray-400 mb-1">当前可用金币</div>
          <div className="text-lg font-black text-yellow-600">🪙 {child.coinsBalance}</div>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 text-center">
          <div className="text-[11px] text-gray-400 mb-1">今日赚取</div>
          <div className="text-lg font-black text-green-600">+{totalEarnedToday}</div>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 text-center">
          <div className="text-[11px] text-gray-400 mb-1">历史累计消费</div>
          <div className="text-lg font-black text-gray-700">-{totalSpent}</div>
        </div>
      </div>

      {/* 设备端商店商品一览 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-gray-800">🛍️ 孩子设备端商店道具</h3>
          <span className="text-xs text-gray-400">孩子在硬件端自主兑换</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {shopItems.map(item => (
            <div key={item.id} className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm text-center">
              <div className="text-3xl mb-1">{item.icon}</div>
              <div className="font-semibold text-xs text-gray-800 truncate">{item.name}</div>
              <div className="text-[11px] text-yellow-600 font-bold mt-1">🪙 {item.price} 金币</div>
              <Tag color="default" className="!text-[9px] !mt-1">
                {item.category === 'clothes' ? '永久服饰' : '消耗品'}
              </Tag>
            </div>
          ))}
        </div>
      </div>

      {/* 金币收支明细 */}
      <div>
        <div className="flex items-center justify-between mb-2 mt-4">
          <h3 className="text-base font-bold text-gray-800">🧾 金币账本明细</h3>
          <span className="text-xs text-gray-400">不可篡改权威流水</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
          {transactions.map(tx => (
            <div key={tx.id} className="p-3.5 flex items-center justify-between text-xs">
              <div className="space-y-1">
                <div className="font-medium text-gray-800">{tx.description}</div>
                <div className="text-[11px] text-gray-400">
                  {tx.createdAt} · 变动后余额: {tx.balanceAfter} 金币
                </div>
              </div>
              <div
                className={`font-black text-sm ${
                  tx.amount > 0 ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
              </div>
            </div>
          ))}

          {transactions.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-xs">暂无交易流水记录</div>
          )}
        </div>
      </div>
    </div>
  );
};
