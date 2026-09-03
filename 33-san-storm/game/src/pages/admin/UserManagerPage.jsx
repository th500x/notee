/**
 * 用户管理页面（管理员专用）
 * 
 * @description 管理员查看和管理已注册用户
 */

import React from 'react';
import UserManager from '@/components/admin/UserManager';
import AdminPageGate from '@/components/admin/AdminPageGate';

function UserManagerPage() {
  return (
    <AdminPageGate>
      <UserManager />
    </AdminPageGate>
  );
}

export default UserManagerPage;
