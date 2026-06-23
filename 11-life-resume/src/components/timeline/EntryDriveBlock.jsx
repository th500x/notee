import { useState } from 'react';

const KIND_LABELS = {
  file: '云端硬盘文件',
  folder: '云端硬盘文件夹',
  document: 'Google 文档',
  spreadsheet: 'Google 表格',
  presentation: 'Google 幻灯片',
  form: 'Google 表单',
};

export default function EntryDriveBlock({ entry }) {
  const [previewFailed, setPreviewFailed] = useState(false);

  if (!entry?.googleDriveShareUrl) return null;

  const label =
    entry.googleDriveDisplayLabel ||
    KIND_LABELS[entry.googleDriveResourceKind] ||
    'Google 云盘';
  const previewUrl = entry.googleDrivePreviewUrl;
  const isFolder = entry.googleDriveResourceKind === 'folder';

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">Google 云盘 · {label}</p>
        <a
          href={entry.googleDriveShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-600 hover:underline shrink-0"
        >
          {isFolder ? '在 Google 云盘中查看' : '在新标签打开'}
        </a>
      </div>

      {isFolder ? (
        <p className="text-sm text-slate-600">
          文件夹无法内嵌预览，请点击上方按钮在 Google 云盘中打开（须您已在 Google 侧设为知道链接者可查看）。
        </p>
      ) : previewUrl && !previewFailed ? (
        <div className="aspect-video w-full overflow-hidden rounded-md border border-slate-200 bg-white">
          <iframe
            title={label}
            src={previewUrl}
            className="w-full h-full"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setPreviewFailed(true)}
          />
        </div>
      ) : (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
          无法预览，请确认云盘分享权限为「知道链接的任何人可查看」，或点击上方链接直接打开。
        </p>
      )}
    </div>
  );
}
