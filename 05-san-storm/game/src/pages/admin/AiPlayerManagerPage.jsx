/**
 * AI 玩家管理页面（管理员专用）
 *
 * @description 行为总开关（运行时）· 各势力人数控制 · 休眠/唤醒 · 立即唤起
 */
import React from 'react';
import AiPlayerManager from '@/components/admin/AiPlayerManager';
import AdminPageGate from '@/components/admin/AdminPageGate';

function AiPlayerManagerPage() {
  return (
    <AdminPageGate>
      <AiPlayerManager />
    </AdminPageGate>
  );
}

export default AiPlayerManagerPage;
