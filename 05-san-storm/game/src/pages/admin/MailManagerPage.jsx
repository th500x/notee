/**
 * 邮件模板管理（管理员）
 */

import React from 'react';
import MailManager from '@/components/admin/MailManager';
import AdminPageGate from '@/components/admin/AdminPageGate';

function MailManagerPage() {
  return (
    <AdminPageGate>
      <MailManager />
    </AdminPageGate>
  );
}

export default MailManagerPage;
