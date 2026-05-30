/**
 * 活动管理（管理员）
 */

import ActivityManager from '@/components/admin/ActivityManager';
import AdminPageGate from '@/components/admin/AdminPageGate';

function ActivityManagerPage() {
  return (
    <AdminPageGate>
      <ActivityManager />
    </AdminPageGate>
  );
}

export default ActivityManagerPage;
