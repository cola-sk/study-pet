import React, { useState } from 'react';
import { List, Button, Dialog, Toast, Tag } from 'antd-mobile';
import { DevicePairModal } from './DevicePairModal';
import { useAppStore } from '../../stores/useAppStore';
import { isSupabaseConfigured } from '../../services/supabase';
import { PWAInstallState } from '../../hooks/usePWAInstall';

interface Props {
  installState: PWAInstallState;
}

export const SettingsPage: React.FC<Props> = ({ installState }) => {
  const { child, family, device, unbindDevice, updateChildNickname, resetAllData } = useAppStore();
  const [pairModalVisible, setPairModalVisible] = useState(false);

  const handleUnbind = () => {
    Dialog.confirm({
      title: '解除设备绑定',
      content: '解除绑定后，微雪 ESP32 屏幕需重新输入配对码绑定，确定要解绑吗？',
      confirmText: '确定解绑',
      cancelText: '取消',
      onConfirm: () => {
        unbindDevice();
        Toast.show({ icon: 'success', content: '已解除设备绑定' });
      },
    });
  };

  const handleEditNickname = () => {
    Dialog.confirm({
      title: '修改孩子昵称',
      content: (
        <input
          id="nickname-input"
          defaultValue={child.nickname}
          placeholder="请输入孩子昵称"
          className="w-full border border-gray-300 rounded-lg p-2 text-sm mt-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      ),
      onConfirm: () => {
        const input = document.getElementById('nickname-input') as HTMLInputElement;
        if (input && input.value.trim()) {
          updateChildNickname(input.value.trim());
          Toast.show({ icon: 'success', content: '昵称已更新' });
        }
      },
    });
  };

  const handleResetData = () => {
    Dialog.confirm({
      title: '恢复初始测试数据',
      content: '该操作将重置今日任务、金币与模板为默认初始数据，是否继续？',
      confirmText: '确定重置',
      onConfirm: () => {
        resetAllData();
        Toast.show({ icon: 'success', content: '已恢复初始数据' });
      },
    });
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* 硬件设备状态卡片 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📺</span>
            <h3 className="font-bold text-gray-800 text-sm">微雪 ESP32 硬件设备</h3>
          </div>
          <Tag color={device.status === 'paired' ? 'success' : 'default'} className="!text-[10px]">
            {device.status === 'paired' ? '已绑定' : '未绑定'}
          </Tag>
        </div>

        {device.status === 'paired' ? (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span className="text-gray-400">设备型号：</span>
              <span className="font-medium">{device.deviceModel}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span className="text-gray-400">MAC 地址：</span>
              <span className="font-mono">{device.macAddress || 'DC:54:75:A8:B2:10'}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span className="text-gray-400">固件版本：</span>
              <span>{device.firmwareVersion}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span className="text-gray-400">连接状态：</span>
              <span className="text-green-600 font-medium">● 在线活跃 ({device.lastSeenAt})</span>
            </div>

            <div className="pt-3 mt-2 border-t border-slate-100 flex justify-end">
              <Button
                size="mini"
                color="danger"
                fill="outline"
                onClick={handleUnbind}
                className="!text-xs !rounded-lg"
              >
                解除设备绑定
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-3">
            <p className="text-xs text-gray-400">当前尚未绑定微雪 ESP32-S3-Touch-LCD-2.8 开发板</p>
            <Button
              color="primary"
              size="middle"
              onClick={() => setPairModalVisible(true)}
              className="!rounded-xl font-bold shadow-sm !px-6"
            >
              绑定新设备 (输入 6 位配对码)
            </Button>
          </div>
        )}
      </div>

      {/* 家庭与孩子信息 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 font-bold text-xs text-gray-700">
          家庭基础设置
        </div>
        <List>
          <List.Item
            extra={child.nickname}
            onClick={handleEditNickname}
            clickable
            arrow
          >
            孩子昵称
          </List.Item>
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
