'use client';

import React, { useState } from 'react';
import { Dialog, Toast } from 'antd-mobile';
import { DeleteOutline, EditSOutline } from 'antd-mobile-icons';
import { DevicePairModal } from './DevicePairModal';
import { useAppStore } from '../../stores/useAppStore';
import { PWAInstallState } from '../../hooks/usePWAInstall';
import { IconDevice, IconPlus, IconCheck, IconCoin, IconStar } from '../../components/Icons';

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
      content: `确定要断开设备「${alias}」吗？断开后可以随时重新配对哦。`,
      confirmText: '确定断开',
      cancelText: '返回',
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
          Toast.show({ icon: 'success', content: '昵称改好啦！' });
        }
      },
    });
  };

  const handleAddChild = () => {
    Dialog.confirm({
      title: '添加新宝贝档案',
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
          Toast.show({ icon: 'success', content: '已添加宝贝档案！' });
        }
      },
    });
  };

  return (
    <div className="px-3.5 py-3.5 space-y-5 pb-24 text-[#1F2937]">
      {/* 1. 桌面伙伴硬件设备管理 */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-h2 text-[#1F2937]">桌面伙伴设备 ({devices.length})</h2>
            <p className="text-caption text-[#6B7280]">管理宝贝书桌上的硬件屏幕</p>
          </div>
          <button
            type="button"
            onClick={() => setPairModalVisible(true)}
            className="kid-btn kid-btn-primary kid-btn-sm"
          >
            <IconPlus className="w-3.5 h-3.5" />
            <span>连接新设备</span>
          </button>
        </div>

        {devices.length === 0 ? (
          <div className="kid-card text-center py-6">
            <div className="text-body text-[#6B7280]">
              还没有连接桌面设备，点击右上角【连接新设备】开始配对吧！
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map(device => {
              const child = children.find(c => c.id === device.childId);
              return (
                <div key={device.id} className="kid-card space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#DBEAFE] text-[#3B82F6] flex items-center justify-center shrink-0">
                        <IconDevice className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-h3 text-[#1F2937] truncate">{device.alias}</h3>
                        <p className="text-caption text-[#6B7280] truncate">
                          专属宝贝：{child?.nickname || '未指定'}
                        </p>
                      </div>
                    </div>

                    <span className="kid-status-chip kid-status-complete shrink-0">
                      <IconCheck className="w-3.5 h-3.5" />
                      <span>已连接</span>
                    </span>
                  </div>

                  <div className="pt-2.5 border-t border-[#E5E7EB] flex items-center justify-between gap-2">
                    <div className="text-mono text-[#6B7280] truncate">
                      {device.deviceModel.replace('Waveshare ', '')} · {device.macAddress}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnbind(device.id, device.alias)}
                      className="kid-btn kid-btn-ghost kid-btn-sm !h-7 !min-h-[28px] !px-2.5 !text-[11px] shrink-0"
                    >
                      <DeleteOutline />
                      <span>断开</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. 宝贝档案列表 */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-h2 text-[#1F2937]">家庭宝贝档案 ({children.length})</h3>
          <button
            type="button"
            onClick={handleAddChild}
            className="kid-btn kid-btn-secondary kid-btn-sm"
          >
            <IconPlus className="w-3.5 h-3.5" />
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
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#FEF3C7] border border-[#FACC15] flex items-center justify-center text-lg shrink-0">
                  {child.avatarIcon || '🧒'}
                </div>
                <div className="min-w-0">
                  <div className="font-headline font-bold text-[14px] text-[#1F2937] flex items-center gap-1.5">
                    <span className="truncate">{child.nickname}</span>
                    <EditSOutline className="text-[#3B82F6] text-xs shrink-0" />
                  </div>
                  <div className="text-caption text-[#6B7280]">点击可修改宝贝昵称</div>
                </div>
              </div>

              <span className="kid-status-chip kid-status-new shrink-0">
                <IconCoin className="w-4 h-4" />
                <span>{child.coinsBalance} 金币</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. 家庭与手机桌面安装 */}
      <section className="space-y-2.5">
        <h3 className="text-h2 text-[#1F2937]">系统与安装信息</h3>
        <div className="kid-list">
          <div className="kid-list-row">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#DBEAFE] text-[#3B82F6] flex items-center justify-center shrink-0">
                <IconStar className="w-4 h-4" />
              </div>
              <div>
                <div className="font-headline font-bold text-[14px] text-[#1F2937]">家庭空间</div>
                <div className="text-caption text-[#6B7280]">{family.timezone}</div>
              </div>
            </div>
            <span className="font-headline font-bold text-[14px] text-[#1F2937]">{family.name}</span>
          </div>

          <div className="kid-list-row">
            <div>
              <div className="font-headline font-bold text-[14px] text-[#1F2937]">安装到手机桌面</div>
              <div className="text-caption text-[#6B7280]">像原生 App 一样随时打开</div>
            </div>
            {installState.isStandalone ? (
              <span className="kid-status-chip kid-status-complete">
                <IconCheck className="w-3.5 h-3.5" />
                <span>已安装</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  if (installState.isInstallable) {
                    await installState.triggerInstall();
                  } else {
                    Toast.show({
                      content: '请在浏览器菜单中点击「添加到主屏幕」哦！',
                    });
                  }
                }}
                className="kid-btn kid-btn-secondary kid-btn-sm"
              >
                <span>立即安装</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 绑定弹窗 */}
      <DevicePairModal
        visible={pairModalVisible}
        onClose={() => setPairModalVisible(false)}
      />
    </div>
  );
};
