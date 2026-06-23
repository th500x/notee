import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { buildTimelineLayoutWithPinned } from '@shared/utils/lifeResumeEntryTime.js';
import { useLifeAuth } from '@/contexts/LifeAuthContext';
import { useLifeProfile } from '@/contexts/LifeProfileContext';
import { useToast } from '@/contexts/ToastContext';
import usePageMeta from '@/hooks/usePageMeta';
import EntryEditorModal from '@/components/entry/EntryEditorModal';
import ProfileHeader from '@/components/timeline/ProfileHeader';
import TimelineSection from '@/components/timeline/TimelineSection';
import TimelineEntryCard from '@/components/timeline/TimelineEntryCard';
import { deleteEntry, fetchPublicTimeline } from '@/services/lifeResumeApi';
import { formatLifeResumeError, isAuthError } from '@/utils/lifeResumeErrors';
import { buildPublicSeoFromEntries } from '@/utils/pageMeta';

export default function TimelinePage() {
  const { accountId: routeAccountId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const { isLoggedIn, accountId: myAccountId, bootstrapping } = useLifeAuth();
  const { profile } = useLifeProfile();
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notAvailable, setNotAvailable] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const ownerId = (routeAccountId || '').toUpperCase();
  const isOwner = isLoggedIn && myAccountId && myAccountId.toUpperCase() === ownerId;

  const profileDefaults = useMemo(
    () =>
      profile && isOwner
        ? {
            pageDefaultVisibility: profile.pageDefaultVisibility,
            defaultGranteeAccountId: profile.defaultGranteeAccountId,
          }
        : null,
    [profile, isOwner]
  );

  const pageMeta = useMemo(() => {
    if (notAvailable || loadError || !timeline) {
      return { title: '人生片段', description: null, robots: 'noindex, nofollow' };
    }
    return buildPublicSeoFromEntries(timeline.entries, {
      displayName: timeline.profile?.displayName,
      username: timeline.profile?.username,
      accountId: ownerId,
    });
  }, [notAvailable, loadError, timeline, ownerId]);

  usePageMeta(pageMeta);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setNotAvailable(false);
    try {
      const res = await fetchPublicTimeline(ownerId);
      setTimeline(res.data);
    } catch (err) {
      setTimeline(null);
      if (err.code === 'PROFILE_NOT_AVAILABLE' || err.status === 404) {
        setNotAvailable(true);
      } else {
        const message = formatLifeResumeError(err);
        setLoadError(message);
        showToast(message, { type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  }, [ownerId, showToast]);

  useEffect(() => {
    if (bootstrapping) return;
    loadTimeline();
  }, [bootstrapping, loadTimeline]);

  const { pinned, sections } = useMemo(
    () => buildTimelineLayoutWithPinned(timeline?.entries || []),
    [timeline?.entries]
  );

  const headerDisplayName =
    timeline?.profile?.displayName ||
    (isOwner ? profile?.displayName : null) ||
    timeline?.profile?.username ||
    (isOwner ? profile?.username : null);

  const openCreate = () => {
    setEditingEntry(null);
    setEditorOpen(true);
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setEditorOpen(true);
  };

  const handleSaved = (entry, status) => {
    showToast(status === 'published' ? '已发布' : '已保存', { type: 'success' });
    loadTimeline();
  };

  const handleDelete = async (entry) => {
    try {
      await deleteEntry(entry.id);
      showToast('已删除', { type: 'success' });
      loadTimeline();
    } catch (err) {
      showToast(formatLifeResumeError(err), { type: 'error' });
      if (isAuthError(err)) {
        navigate('/login');
      }
    }
  };

  if (bootstrapping || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-slate-500">
        正在加载片段…
      </div>
    );
  }

  if (notAvailable) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-3">
        <p className="text-slate-600">页面不存在或暂无内容</p>
        {!isLoggedIn && (
          <p className="text-sm text-slate-500">
            <Link to="/login" className="text-indigo-600 hover:underline">
              登录
            </Link>{' '}
            后可创建自己的片段
          </p>
        )}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-red-600 mb-3">{loadError}</p>
        <button type="button" className="text-indigo-600 hover:underline" onClick={loadTimeline}>
          重试
        </button>
      </div>
    );
  }

  const entries = timeline?.entries || [];
  const viewerIsOwner = timeline?.viewer?.isOwner || isOwner;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <ProfileHeader
        accountId={ownerId}
        displayName={headerDisplayName}
        username={timeline?.profile?.username || (isOwner ? profile?.username : null)}
        isOwner={viewerIsOwner}
        onCreateClick={openCreate}
      />

      {entries.length === 0 && viewerIsOwner && (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
          <p className="text-slate-600 mb-4">还没有片段，点击新建第一条</p>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={openCreate}
          >
            新建片段
          </button>
        </div>
      )}

      {entries.length === 0 && !viewerIsOwner && (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
          <p className="text-slate-600">暂无公开内容</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-2">
          {pinned.length > 0 && (
            <section className="mb-6 space-y-4">
              <h2 className="text-sm font-semibold text-indigo-700 tracking-wide">置顶</h2>
              <div className="space-y-4">
                {pinned.map((entry) => (
                  <TimelineEntryCard
                    key={entry.id}
                    entry={entry}
                    isOwner={viewerIsOwner}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}
          {sections.map((section) => (
            <TimelineSection
              key={section.id}
              section={section}
              isOwner={viewerIsOwner}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <EntryEditorModal
        open={editorOpen}
        entry={editingEntry}
        profileDefaults={profileDefaults}
        onClose={() => setEditorOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
