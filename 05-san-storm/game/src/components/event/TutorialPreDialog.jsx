/**
 * TutorialPreDialog - 新手事件前置说明对话框
 *
 * @description 每条新手事件触发前弹出的简短说明
 */

import AncientModal from '@/components/common/AncientModal';

export default function TutorialPreDialog({ dialog, onClose }) {
  if (!dialog) return null;

  return (
    <AncientModal
      isOpen
      onClose={onClose}
      type="info"
      title={dialog.title || '新手指引'}
      confirmText="继续"
      onConfirm={onClose}
    >
      <div className="space-y-2">
        {dialog.lines?.map((line, i) => (
          <p key={i} className="text-gray-700 text-sm leading-relaxed">{line}</p>
        ))}
      </div>
    </AncientModal>
  );
}
