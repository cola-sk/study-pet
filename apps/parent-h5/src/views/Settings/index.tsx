'use client';

import React, { useState } from 'react';
import { List, Dialog, Toast } from 'antd-mobile';
import { DeleteOutline, EditSOutline } from 'antd-mobile-icons';
import { DevicePairModal } from './DevicePairModal';
import { useAppStore } from '../../stores/useAppStore';
import { PWAInstallState } from '../../hooks/usePWAInstall';
import { IconDevice, IconPlus, IconWifi, IconCoin, IconUser } from '../../components/Icons';

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
      title: '修改成员昵称',
      content: (
        <input
          id="nickname-input"
          defaultValue={currentName}
          placeholder="请输入成员昵称"
          className="w-full border border-slate-300 bg-slate-50 rounded-lg p-2.5 text-sm mt-2 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
      title: '添加新成员档案',
      content: (
        <div className="space-y-2 mt-2">
          <input
            id="new-child-input"
            placeholder="例如：小宝 / 豆豆"
            className="w-full border border-slate-300 bg-slate-50 rounded-lg p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
      ),
      onConfirm: () => {
        const input = document.getElementById('new-child-input') as HTMLInputElement;
        if (input && input.value.trim()) {
          addChild(input.value.trim(), '👧');
          Toast.show({ icon: 'success', content: '已添加成员档案' });
        }
      },
    });
  };

  return (
    <div className="p-4 space-y-5 pb-24 text-slate-900">
      {/* 硬件终端设备列表（支持多设备） */}
      <section className="card-surface bg-white rounded-xl shadow-card border border-slate-200/90 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconDevice className="w-4 h-4 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-xs">已绑定桌面硬件终端 ({devices.length})</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPairModalVisible(true)}
            className="rounded-md text-xs px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold inline-flex items-center gap-1 shadow-xs transition-all select-none"
          >
            <IconPlus className="w-3 h-3" />
            <span>配对新终端</span>
          </button>
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            暂未绑定任何硬件终端，点击右上角【配对新终端】开始连接
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {devices.map(device => {
              const child = children.find(c => c.id === device.childId);
              return (
                <div key={device.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{device.alias}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-1.5 py-0.5 rounded font-medium">
                        <IconWifi className="w-3 h-3" />
                        在线
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnbind(device.id, device.alias)}
                      className="text-slate-400 hover:text-red-600 text-xs flex items-center gap-1 transition-colors select-none"
                    >
                      <DeleteOutline /> 解除绑定
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400">绑定成员</div>
                      <div className="font-semibold text-slate-800 mt-0.5">{child?.nickname || '未指定'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">终端型号</div>
                      <div className="font-medium text-slate-700 mt-0.5 truncate">{device.deviceModel.replace('Waveshare ', '')}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">MAC 标识</div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5 truncate">{device.macAddress}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 成员档案管理 */}
      <section className="card-surface bg-white rounded-xl shadow-card border border-slate-200/90 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconUser className="w-4 h-4 text-slate-600" />
            <span className="font-bold text-xs text-slate-900">成员档案管理 ({children.length})</span>
          </div>
          <button
            type="button"
            onClick={handleAddChild}
            className="text-indigo-600 hover:text-indigo-700 text-xs font-semibold inline-flex items-center gap-1 select-none"
          >
            <IconPlus className="w-3 h-3" />
            <span>添加成员</span>
          </button>
        </div>
        <List>
          {children.map(child => (
            <List.Item
              key={child.id}
              prefix={
                <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-base">
                  {child.avatarIcon || '🧒'}
                </div>
              }
              extra={
                <span className="inline-flex items-center gap-1 text-amber-700 font-mono font-bold text-xs bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded">
                  <IconCoin className="w-3 h-3" />
                  {child.coinsBalance}
                </span>
              }
              clickable
              onClick={() => handleEditNickname(child.id, child.nickname)}
              arrow
            >
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-slate-900">{child.nickname}</span>
                <EditSOutline className="text-slate-400 text-xs" />
              </div>
            </List.Item>
          ))}
        </List>
      </section>

      {/* 系统与客户端配置 */}
      <section className="card-surface bg-white rounded-xl shadow-card border border-slate-200/90 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 font-bold text-xs text-slate-900">
          系统与客户端状态
        </div>
        <List>
          <List.Item extra={<span className="text-xs font-medium text-slate-700">{family.name}</span>}>
            <span className="text-xs text-slate-600">家庭空间</span>
          </List.Item>
          <List.Item extra={<span className="text-xs font-mono text-slate-500">{family.timezone}</span>}>
            <span className="text-xs text-slate-600">任务结算时区</span>
          </List.Item>
          <List.Item
            extra={
              installState.isStandalone ? (
                <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded font-medium">
                  独立 App 模式
                </span>
              ) : (
                <span className="text-[11px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-medium">
                  浏览器网页模式
                </span>
              )
            }
          >
            <span className="text-xs text-slate-600">客户端形态</span>
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
              <span className="text-xs text-indigo-600 font-semibold">安装至手机主屏幕 (PWA)</span>
            </List.Item>
          )}
        </List>
      </section>

      {/* 绑定弹窗 */}
      <DevicePairModal
        visible={pairModalVisible}
        onClose={() => setPairModalVisible(false)}
      />
    </div>
  );
};
