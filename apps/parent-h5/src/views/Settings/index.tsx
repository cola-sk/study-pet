'use client';

import React, { useState } from 'react';
import { Dialog, Toast } from 'antd-mobile';
import { DeleteOutline, EditSOutline } from 'antd-mobile-icons';
import { DevicePairModal } from './DevicePairModal';
import { useAppStore } from '../../stores/useAppStore';
import { PWAInstallState } from '../../hooks/usePWAInstall';
import { IconDevice, IconPlus, IconCoin } from '../../components/Icons';

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
      title: '解除设备连接？',
      content: `确定要断开设备「${alias}」吗？断开后可随时重新配对。`,
      confirmText: '断开',
      cancelText: '取消',
      onConfirm: () => {
        unbindDevice(deviceId);
        Toast.show({ icon: 'success', content: '已解除设备绑定' });
      },
    });
  };

  const handleEditNickname = (childId: string, currentName: string) => {
    Dialog.confirm({
      title: '修改宝贝昵称',
      content: (
        <input
          id="nickname-input"
          defaultValue={currentName}
          placeholder="请输入宝贝昵称"
          className="kid-input mt-2"
        />
      ),
      onConfirm: () => {
        const input = document.getElementById('nickname-input') as HTMLInputElement;
        if (input && input.value.trim()) {
          updateChildNickname(childId, input.value.trim());
          Toast.show({ icon: 'success', content: '已更新昵称' });
        }
      },
    });
  };

  const handleAddChild = () => {
    Dialog.confirm({
      title: '添加宝贝档案',
      content: (
        <div className="mt-2">
          <input
            id="new-child-input"
            placeholder="例如：小宝 / 豆豆"
            className="kid-input"
          />
        </div>
      ),
      onConfirm: () => {
        const input = document.getElementById('new-child-input') as HTMLInputElement;
        if (input && input.value.trim()) {
          addChild(input.value.trim(), '👧');
          Toast.show({ icon: 'success', content: '已添加宝贝档案' });
        }
      },
    });
  };

  return (
    <div className="px-3 py-2.5 space-y-3 pb-20 text-[#1F2937]">
      {/* 1. 桌面伙伴硬件设备管理 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-h2 text-[#1F2937]">桌面设备 ({devices.length})</h2>
          <button
            type="button"
            onClick={() => setPairModalVisible(true)}
            className="kid-btn kid-btn-primary kid-btn-sm"
          >
            <IconPlus className="w-3 h-3" />
            <span>配对新设备</span>
          </button>
        </div>

        {devices.length === 0 ? (
          <div className="kid-card text-center py-5 text-body text-[#9CA3AF]">
            暂未绑定设备，点击右上角配对
          </div>
        ) : (
          <div className="kid-list">
            {devices.map(device => {
              const child = children.find(c => c.id === device.childId);
              return (
                <div key={device.id} className="kid-list-row">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center shrink-0">
                      <IconDevice className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[13px] text-[#1F2937] truncate">
                          {device.alias}
                        </span>
                        <span className="kid-status-chip kid-status-complete shrink-0">
                          ● 已连接
                        </span>
                      </div>
                      <div className="text-caption text-[#6B7280] mt-0.5 truncate">
                        {child?.nickname || '未分配'} · <span className="font-mono text-[10px] text-[#9CA3AF]">{device.macAddress}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnbind(device.id, device.alias)}
                    className="kid-btn kid-btn-danger-ghost kid-btn-sm !h-6 !min-h-[24px] !px-2 !text-[11px] shrink-0"
                  >
                    <DeleteOutline />
                    <span>断开</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. 宝贝档案列表 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="text-h2 text-[#1F2937]">宝贝档案 ({children.length})</h3>
          <button
            type="button"
            onClick={handleAddChild}
            className="kid-btn kid-btn-secondary kid-btn-sm"
          >
            <IconPlus className="w-3 h-3" />
            <span>添加宝贝</span>
          </button>
        </div>

        <div className="kid-list">
          {children.map(child => (
            <button
              key={child.id}
              type="button"
              onClick={() => handleEditNickname(child.id, child.nickname)}
              className="kid-list-row w-full text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none">{child.avatarIcon || '🧒'}</span>
                <span className="font-semibold text-[13px] text-[#1F2937] truncate">
                  {child.nickname}
                </span>
                <EditSOutline className="text-[#9CA3AF] text-xs shrink-0" />
              </div>

              <span className="inline-flex items-center gap-1 text-caption font-bold text-[#B45309] shrink-0">
                <IconCoin className="w-3.5 h-3.5" />
                <span>{child.coinsBalance} 金币</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. 系统与桌面安装 */}
      <section className="space-y-2">
        <h3 className="text-h2 text-[#1F2937] px-0.5">系统设置</h3>
        <div className="kid-list">
          <div className="kid-list-row">
            <span className="font-semibold text-[13px] text-[#1F2937]">家庭空间</span>
            <span className="text-body text-[#6B7280]">{family.name} ({family.timezone})</span>
          </div>

          <div className="kid-list-row">
            <div>
              <div className="font-semibold text-[13px] text-[#1F2937]">添加到手机主屏幕</div>
              <div className="text-caption text-[#9CA3AF]">支持全屏快捷打开</div>
            </div>
            {installState.isStandalone ? (
              <span className="kid-status-chip kid-status-complete">已安装</span>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  if (installState.isInstallable) {
                    await installState.triggerInstall();
                  } else {
                    Toast.show({
                      content: '请在浏览器菜单中点击「添加到主屏幕」',
                    });
                  }
                }}
                className="kid-btn kid-btn-ghost kid-btn-sm"
              >
                <span>安装</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <DevicePairModal
        visible={pairModalVisible}
        onClose={() => setPairModalVisible(false)}
      />
    </div>
  );
};
