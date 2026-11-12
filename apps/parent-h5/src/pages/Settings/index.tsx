import React, { useState } from 'react';
import { List, Button, Dialog, Toast, Tag } from 'antd-mobile';
import { AddOutline, DeleteOutline, EditSOutline } from 'antd-mobile-icons';
import { DevicePairModal } from './DevicePairModal';
import { useAppStore } from '../../stores/useAppStore';
import { isSupabaseConfigured } from '../../services/supabase';
import { PWAInstallState } from '../../hooks/usePWAInstall';

interface Props {
  installState: PWAInstallState;
}

export const SettingsPage: React.FC<Props> = ({ installState }) => {
  const { 
    children, 
    family, 
    devices, 
    unbindDevice, 
    addChild, 
    updateChildNickname, 
    resetAllData 
  } = useAppStore();

  const [pairModalVisible, setPairModalVisible] = useState(false);

  const handleUnbind = (deviceId: string, alias: string) => {
    Dialog.confirm({
      title: '解除设备绑定',
      content: `确定要解除设备「${alias}」的绑定吗？解除后该微雪屏幕需重新配对。`,
      confirmText: '确定解绑',
      cancelText: '取消',
      onConfirm: () => {
        unbindDevice(deviceId);
        Toast.show({ icon: 'success', content: '已解除该设备绑定' });
      },
    });
  };

  const handleEditNickname = (childId: string, currentName: string) => {
    Dialog.confirm({
      title: '修改孩子昵称',
      content: (
        <input
          id="nickname-input"
          defaultValue={currentName}
          placeholder="请输入孩子昵称"
          className="w-full border border-gray-300 rounded-lg p-2 text-sm mt-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      ),
      onConfirm: () => {
        const input = document.getElementById('nickname-input') as HTMLInputElement;
        if (input && input.value.trim()) {
          updateChildNickname(childId, input.value.trim());
          Toast.show({ icon: 'success', content: '昵称已更新' });
        }
      },
    });
  };

  const handleAddChild = () => {
    Dialog.confirm({
      title: '添加新孩子档案',
      content: (
        <div className="space-y-2 mt-2">
          <input
            id="new-child-input"
            placeholder="例如：小宝 / 豆豆"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      ),
      onConfirm: () => {
        const input = document.getElementById('new-child-input') as HTMLInputElement;
        if (input && input.value.trim()) {
          addChild(input.value.trim(), '👧');
          Toast.show({ icon: 'success', content: '已添加孩子档案' });
        }
      },
    });
  };

  const handleResetData = () => {
    Dialog.confirm({
      title: '恢复初始测试数据',
      content: '该操作将重置多设备、多孩子、今日任务与金币为演示初始数据，是否继续？',
      confirmText: '确定重置',
      onConfirm: () => {
        resetAllData();
        Toast.show({ icon: 'success', content: '已恢复初始演示数据' });
      },
    });
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* 微雪硬件设备列表（支持多设备） */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📺</span>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">已绑定微雪设备 ({devices.length} 台)</h3>
              <p className="text-[11px] text-gray-400">每台设备独立展示孩子专属宠物</p>
            </div>
          </div>
          <Button
            size="mini"
            color="primary"
            onClick={() => setPairModalVisible(true)}
            className="!rounded-lg !text-xs !px-2.5 shadow-sm"
          >
            <span className="flex items-center gap-0.5">
              <AddOutline /> 绑定新设备
            </span>
          </Button>
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400">
            暂未绑定任何微雪设备，点击右上角【绑定新设备】开始配对
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map(device => {
              const child = children.find(c => c.id === device.childId);
              return (
                <div key={device.id} className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-800 text-xs">{device.alias}</span>
                      <Tag color="success" className="!text-[9px]">● 在线 ({device.lastSeenAt || '刚刚'})</Tag>
                    </div>
                    <button
                      onClick={() => handleUnbind(device.id, device.alias)}
                      className="text-red-500 hover:text-red-700 text-xs flex items-center gap-0.5"
                    >
                      <DeleteOutline /> 解绑
                    </button>
                  </div>

                  <div className="text-[11px] text-gray-500 space-y-1">
                    <div className="flex justify-between">
                      <span>主人（孩子）：</span>
                      <strong className="text-blue-600">{child?.nickname || '未指定'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>硬件型号：</span>
                      <span>{device.deviceModel.replace('Waveshare ', '')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>MAC 地址：</span>
                      <span className="font-mono text-gray-400">{device.macAddress}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 孩子档案管理（支持多孩子） */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-xs text-gray-700">孩子档案与宠物账号 ({children.length} 位)</span>
          <button
            onClick={handleAddChild}
            className="text-blue-600 text-xs font-semibold flex items-center gap-0.5"
          >
            <AddOutline /> 添加孩子
          </button>
        </div>
        <List>
          {children.map(child => (
            <List.Item
              key={child.id}
              prefix={<span className="text-xl">{child.avatarIcon || '🧒'}</span>}
              extra={
                <span className="text-yellow-600 font-bold text-xs">
                  🪙 {child.coinsBalance} 金币
                </span>
              }
              clickable
              onClick={() => handleEditNickname(child.id, child.nickname)}
              arrow
            >
              <div className="flex items-center space-x-2">
                <span className="font-medium text-xs text-gray-800">{child.nickname}</span>
                <EditSOutline className="text-gray-400 text-xs" />
              </div>
            </List.Item>
          ))}
        </List>
      </div>

      {/* 家庭与系统时区 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 font-bold text-xs text-gray-700">
          家庭基础信息
        </div>
        <List>
          <List.Item extra={family.timezone}>
            任务结算时区
          </List.Item>
          <List.Item extra={family.name}>
            家庭档案
          </List.Item>
        </List>
      </div>

      {/* PWA 手机桌面安装与状态 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 font-bold text-xs text-gray-700">
          PWA 与手机主屏幕安装
        </div>
        <List>
          <List.Item
            extra={
              installState.isStandalone ? (
                <Tag color="success" className="!text-[10px]">独立 App 运行中</Tag>
              ) : (
                <Tag color="primary" className="!text-[10px]">浏览器标签模式</Tag>
              )
            }
          >
            运行模式
          </List.Item>
          {!installState.isStandalone && (
            <List.Item
              clickable
              onClick={async () => {
                if (installState.isInstallable) {
                  await installState.triggerInstall();
                } else {
                  Toast.show({
                    content: '请使用 Safari 或 Chrome，在菜单中选择「添加到主屏幕」',
                  });
                }
              }}
              arrow
            >
              添加到手机主屏幕
            </List.Item>
          )}
          <List.Item
            extra={
              isSupabaseConfigured ? (
                <span className="text-green-600 font-semibold text-xs">● 已连接 Supabase</span>
              ) : (
                <span className="text-gray-400 text-xs">本地离线存储模式</span>
              )
            }
          >
            后端数据库状态
          </List.Item>
        </List>
      </div>

      {/* 快捷开发者重置按钮 */}
      <div className="pt-2">
        <Button
          block
          fill="none"
          size="middle"
          onClick={handleResetData}
          className="!text-gray-400 !text-xs"
        >
          重置并加载初始演示数据
        </Button>
      </div>

      {/* 绑定弹窗 */}
      <DevicePairModal
        visible={pairModalVisible}
        onClose={() => setPairModalVisible(false)}
      />
    </div>
  );
};
