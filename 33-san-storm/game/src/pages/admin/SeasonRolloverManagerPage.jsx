/**
 * 赛季关服切换运营面板（管理员）
 */
import SeasonRolloverManager from '@/components/admin/SeasonRolloverManager';
import AdminPageGate from '@/components/admin/AdminPageGate';

export default function SeasonRolloverManagerPage() {
  return (
    <AdminPageGate>
      <SeasonRolloverManager />
    </AdminPageGate>
  );
}
