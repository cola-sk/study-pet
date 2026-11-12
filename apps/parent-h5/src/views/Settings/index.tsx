'use client';

import React, { useState } from 'react';
import { List, Button, Dialog, Toast, Tag } from 'antd-mobile';
import { AddOutline, DeleteOutline, EditSOutline } from 'antd-mobile-icons';
import { DevicePairModal } from './DevicePairModal';
import { useAppStore } from '../../stores/useAppStore';
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
    updateChildNickname 
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
          className="w-full border border-[#EAE5DC] bg-[#F7F5F0] rounded-xl p-2.5 text-sm mt-2 text-[#2D2621] focus:ring-2 focus:ring-[#D96B43] focus:outline-none"
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
            className="w-full border border-[#EAE5DC] bg-[#F7F5F0] rounded-xl p-2.5 text-sm text-[#2D2621] focus:ring-2 focus:ring-[#D96B43] focus:outline-none"
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

  return (
    <div className="p-4 space-y-4 pb-24 text-[#2D2621]">
      {/* 桌面硬件设备列表（支持多设备） */}
      <div className="bg-white rounded-3xl p-4 shadow-[0_2px_10px_rgba(60,48,36,0.04)] border border-[#EAE5DC]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📺</span>
            <div>
              <h3 className="font-bold text-[#2D2621] text-sm">已绑定桌面设备 ({devices.length} 台)</h3>
              <p className="text-xs text-[#A89F95]">每台设备独立展示孩子专属宠物</p>
            </div>
          </div>
          <Button
            size="mini"
            onClick={() => setPairModalVisible(true)}
            className="!rounded-full !text-xs !px-3 !bg-[#D96B43] hover:!bg-[#C75B34] !text-white !border-0 font-medium shadow-xs"
          >
            <span className="flex items-center gap-0.5">
              <AddOutline /> 绑定新设备
            </span>
          </Button>
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#A89F95]">
            暂未绑定任何硬件设备，点击右上角【绑定新设备】开始配对
          </div>
        ) : (
          <div className="space-y-2.5">
            {devices.map(device => {
              const child = children.find(c => c.id === device.childId);
              return (
                <div key={device.id} className="bg-[#F7F5F0] rounded-2xl p-3 border border-[#EAE5DC] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-[#2D2621] text-xs">{device.alias}</span>
                      <span className="text-[10px] bg-[#EEF4EF] text-[#4F7757] border border-[#D0E3D4] px-2 py-0.5 rounded-full font-medium">
                        已在线
                      </span>
                    </div>
                    <button
                      onClick={() => handleUnbind(device.id, device.alias)}
                      className="text-[#C85A5A] hover:text-[#A83838] text-xs flex items-center gap-0.5"
                    >
                      <DeleteOutline /> 解绑
                    </button>
                  </div>

                  <div className="text-xs text-[#7D7267] space-y-1">
                    <div className="flex justify-between">
                      <span>主人（孩子）：</span>
                      <strong className="text-[#2D2621]">{child?.nickname || '未指定'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>硬件型号：</span>
                      <span>{device.deviceModel.replace('Waveshare ', '')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>MAC 地址：</span>
                      <span className="font-mono text-[#A89F95]">{device.macAddress}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 孩子档案管理（支持多孩子） */}
      <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(60,48,36,0.04)] border border-[#EAE5DC] overflow-hidden">
        <div className="px-4 py-3 bg-[#F7F5F0] border-b border-[#EAE5DC] flex items-center justify-between">
          <span className="font-bold text-xs text-[#2D2621]">孩子档案与伴学账号 ({children.length} 位)</span>
          <button
            onClick={handleAddChild}
            className="text-[#D96B43] hover:text-[#C75B34] text-xs font-semibold flex items-center gap-0.5"
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
                <span className="text-[#C88A2E] font-bold text-xs">
                  🪙 {child.coinsBalance} 金币
                </span>
              }
              clickable
              onClick={() => handleEditNickname(child.id, child.nickname)}
              arrow
            >
              <div className="flex items-center space-x-2">
                <span className="font-medium text-xs text-[#2D2621]">{child.nickname}</span>
                <EditSOutline className="text-[#A89F95] text-xs" />
              </div>
            </List.Item>
          ))}
        </List>
      </div>

      {/* 家庭与系统时区 */}
      <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(60,48,36,0.04)] border border-[#EAE5DC] overflow-hidden">
        <div className="px-4 py-3 bg-[#F7F5F0] border-b border-[#EAE5DC] font-bold text-xs text-[#2D2621]">
          家庭基础信息
        </div>
        <List>
          <List.Item extra={<span className="text-xs text-[#7D7267]">{family.timezone}</span>}>
            <span className="text-xs text-[#2D2621]">任务结算时区</span>
          </List.Item>
          <List.Item extra={<span className="text-xs text-[#7D7267]">{family.name}</span>}>
            <span className="text-xs text-[#2D2621]">家庭档案</span>
          </List.Item>
        </List>
      </div>

      {/* PWA 手机桌面安装与状态 */}
      <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(60,48,36,0.04)] border border-[#EAE5DC] overflow-hidden">
        <div className="px-4 py-3 bg-[#F7F5F0] border-b border-[#EAE5DC] font-bold text-xs text-[#2D2621]">
          PWA 与手机主屏幕安装
        </div>
        <List>
          <List.Item
            extra={
              installState.isStandalone ? (
                <span className="text-[10px] bg-[#EEF4EF] text-[#4F7757] border border-[#D0E3D4] px-2.5 py-0.5 rounded-full font-medium">
                  独立 App 模式
                </span>
              ) : (
                <span className="text-[10px] bg-[#FEF8ED] text-[#D49439] border border-[#FCE7C2] px-2.5 py-0.5 rounded-full font-medium">
                  浏览器标签模式
                </span>
              )
            }
          >
            <span className="text-xs text-[#2D2621]">运行模式</span>
          </List.Item>
          {!installState.isStandalone && (
            <List.Item
              clickable
              onClick={async () => {
                if (installState.isInstallable) {
                  await installState.triggerInstall();
                } else {
                  Toast.show({
                    content: '请使用 Safari 或 Chrome，在系统菜单中选择「添加到主屏幕」',
                  });
                }
              }}
              arrow
            >
              <span className="text-xs text-[#D96B43] font-medium">添加到手机主屏幕</span>
            </List.Item>
          )}
        </List>
      </div>

      {/* 绑定弹窗 */}
      <DevicePairModal
        visible={pairModalVisible}
        onClose={() => setPairModalVisible(false)}
      />
    </div>
  );
};
