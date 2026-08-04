import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { buildTimelineLayoutWithPinned } from '@shared/utils/lifeResumeEntryTime.js';
import {
  CHRONOLOGICAL_ENTRY_SERIES_KEY,
  CHRONOLOGICAL_ENTRY_SERIES_NAME,
  filterEntriesByEntrySeriesId,
  normalizeEntrySeriesId,
} from '@shared/utils/lifeResumeEntrySeries.js';
import { matchesFindQuery } from '@/utils/entryBodyFindReplace';
import { useLifeAuth } from '@/contexts/LifeAuthContext';
import { useLifeProfile } from '@/contexts/LifeProfileContext';
import { useToast } from '@/contexts/ToastContext';
import usePageMeta from '@/hooks/usePageMeta';
import { useTimelineSectionCollapse } from '@/hooks/useTimelineSectionCollapse';
import EntryEditorModal from '@/components/entry/EntryEditorModal';
import ProfileHeader from '@/components/timeline/ProfileHeader';
import LifePathPreviewModal from '@/components/timeline/LifePathPreviewModal';
import ProfileTagStats from '@/components/timeline/ProfileTagStats';
import EntrySeriesSwitcher from '@/components/timeline/EntrySeriesSwitcher';
import EntryBodyFindReplaceModal from '@/components/timeline/EntryBodyFindReplaceModal';
import TimelineSection from '@/components/timeline/TimelineSection';
import {
  deleteEntry,
  fetchPublicTimeline,
  findReplaceEntryBodies,
  generateMyLifePath,
  publishMyLifePath,
  discardMyLifePathDraft,
} from '@/services/lifeResumeApi';
import { formatLifeResumeError, isAuthError } from '@/utils/lifeResumeErrors';
import { buildPublicSeoFromEntries } from '@/utils/pageMeta';

export default function TimelinePage() {
  const { accountId: routeAccountId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const { isLoggedIn, accountId: myAccountId, bootstrapping } = useLifeAuth();
  const { profile, refreshProfile } = useLifeProfile();
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notAvailable, setNotAvailable] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [lifePathModalOpen, setLifePathModalOpen] = useState(false);
  const [lifePathDraft, setLifePathDraft] = useState(null);
  const [generatingLifePath, setGeneratingLifePath] = useState(false);
  const [publishingLifePath, setPublishingLifePath] = useState(false);
  const [discardingLifePath, setDiscardingLifePath] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [bodySearchFind, setBodySearchFind] = useState('');
  const [replacingBodies, setReplacingBodies] = useState(false);

  const ownerId = (routeAccountId || '').toUpperCase();
  const isOwner = isLoggedIn && myAccountId && myAccountId.toUpperCase() === ownerId;

  const activeEntrySeriesId = useMemo(() => {
    const raw = searchParams.get('entrySeriesId');
    let candidate;
    if (raw == null || raw === '') {
      candidate = timeline?.profile?.defaultEntrySeriesId ?? null;
    } else {
      const normalized = normalizeEntrySeriesId(raw);
      candidate = Number.isNaN(normalized) ? null : normalized;
    }

    const list = timeline?.entrySeriesList || [];
    if (!list.length) return candidate;

    const allowedIds = list.map((series) =>
      series.id == null ? null : Number(series.id)
    );
    if (allowedIds.some((id) => id === candidate || (id == null && candidate == null))) {
      return candidate;
    }
    return list[0]?.id ?? null;
  }, [searchParams, timeline?.profile?.defaultEntrySeriesId, timeline?.entrySeriesList]);

  const { isSectionCollapsed, toggleSectionCollapsed } = useTimelineSectionCollapse(
    ownerId,
    activeEntrySeriesId
  );

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

  const seriesEntries = useMemo(
    () => filterEntriesByEntrySeriesId(timeline?.entries || [], activeEntrySeriesId),
    [timeline?.entries, activeEntrySeriesId]
  );

  const displayEntries = useMemo(() => {
    if (!bodySearchFind) return seriesEntries;
    return seriesEntries.filter((entry) => matchesFindQuery(entry.body, bodySearchFind));
  }, [seriesEntries, bodySearchFind]);

  const { pinned, sections } = useMemo(
    () => buildTimelineLayoutWithPinned(displayEntries),
    [displayEntries]
  );

  const activeSeriesName = useMemo(() => {
    const list = timeline?.entrySeriesList || [];
    const found = list.find(
      (series) =>
        (activeEntrySeriesId == null && series.id == null) ||
        Number(series.id) === Number(activeEntrySeriesId)
    );
    return found?.name || CHRONOLOGICAL_ENTRY_SERIES_NAME;
  }, [timeline?.entrySeriesList, activeEntrySeriesId]);

  useEffect(() => {
    setBodySearchFind('');
  }, [activeEntrySeriesId]);

  const handleSeriesChange = (seriesId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (seriesId == null) {
          next.set('entrySeriesId', CHRONOLOGICAL_ENTRY_SERIES_KEY);
        } else {
          next.set('entrySeriesId', String(seriesId));
        }
        return next;
      },
      { replace: true }
    );
  };

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

  const handleSearchBodies = (find) => {
    setBodySearchFind(find);
    setFindReplaceOpen(false);
  };

  const handleReplaceBodies = async (find, replace) => {
    setReplacingBodies(true);
    try {
      const res = await findReplaceEntryBodies({
        entrySeriesId: activeEntrySeriesId,
        find,
        replace,
      });
      const result = res.data || {};
      const occurrenceCount = Number(result.occurrenceCount) || 0;
      const skippedOverLimitCount = Number(result.skippedOverLimitCount) || 0;

      setFindReplaceOpen(false);
      setBodySearchFind('');

      if (occurrenceCount > 0) {
        showToast(`有 ${occurrenceCount} 处被替换`, { type: 'success' });
      } else {
        showToast('没有匹配的正文，未做改动', { type: 'info' });
      }
      if (skippedOverLimitCount > 0) {
        showToast(`${skippedOverLimitCount} 条片段替换后会超出正文字数上限，已跳过`, {
          type: 'error',
        });
      }
      await loadTimeline();
    } catch (err) {
      showToast(formatLifeResumeError(err), { type: 'error' });
      if (isAuthError(err)) {
        navigate('/login');
      }
    } finally {
      setReplacingBodies(false);
    }
  };

  const openLifePathPreview = (draft) => {
    if (!draft) return;
    setLifePathDraft(draft);
    setLifePathModalOpen(true);
  };

  const handleGenerateLifePath = async () => {
    setGeneratingLifePath(true);
    try {
      const res = await generateMyLifePath();
      openLifePathPreview(res.data?.lifePathDraft);
      await refreshProfile();
      showToast('两种风格的轨迹草稿已生成', { type: 'success' });
    } catch (err) {
      showToast(formatLifeResumeError(err), { type: 'error' });
      if (isAuthError(err)) {
        navigate('/login');
      }
    } finally {
      setGeneratingLifePath(false);
    }
  };

  const handlePreviewExistingDraft = () => {
    openLifePathPreview(profile?.lifePathDraft);
  };

  const handlePublishLifePath = async (variant) => {
    setPublishingLifePath(true);
    try {
      await publishMyLifePath({ variant });
      await refreshProfile();
      setLifePathModalOpen(false);
      setLifePathDraft(null);
      showToast('轨迹已发布', { type: 'success' });
    } catch (err) {
      showToast(formatLifeResumeError(err), { type: 'error' });
      if (isAuthError(err)) {
        navigate('/login');
      }
    } finally {
      setPublishingLifePath(false);
    }
  };

  const handleDiscardLifePathDraft = async () => {
    setDiscardingLifePath(true);
    try {
      await discardMyLifePathDraft();
      await refreshProfile();
      setLifePathModalOpen(false);
      setLifePathDraft(null);
      showToast('草稿已丢弃', { type: 'success' });
    } catch (err) {
      showToast(formatLifeResumeError(err), { type: 'error' });
      if (isAuthError(err)) {
        navigate('/login');
      }
    } finally {
      setDiscardingLifePath(false);
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

  const allEntries = timeline?.entries || [];
  const entries = seriesEntries;
  const shownEntries = displayEntries;
  const searchActive = Boolean(bodySearchFind);
  const viewerIsOwner = timeline?.viewer?.isOwner || isOwner;
  const entrySeriesList = timeline?.entrySeriesList || [];
  const hasAnyEntries = allEntries.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-3">
        <ProfileHeader
          accountId={ownerId}
          displayName={headerDisplayName}
          username={timeline?.profile?.username || (isOwner ? profile?.username : null)}
          isOwner={viewerIsOwner}
          onCreateClick={openCreate}
          onFindReplaceClick={
            viewerIsOwner && entries.length > 0 ? () => setFindReplaceOpen(true) : undefined
          }
          onGenerateLifePathClick={viewerIsOwner ? handleGenerateLifePath : undefined}
          onPreviewLifePathClick={viewerIsOwner ? handlePreviewExistingDraft : undefined}
          generatingLifePath={generatingLifePath}
          lifePathStatus={isOwner ? profile?.lifePathStatus : 'none'}
          lifePathGeneratedAt={isOwner ? profile?.lifePathGeneratedAt : null}
          lifePathGenerateAvailableAt={isOwner ? profile?.lifePathGenerateAvailableAt : null}
          lifePathCooldownHours={isOwner ? profile?.lifePathCooldownHours : undefined}
          lifePathGenerateAllowed={isOwner ? profile?.lifePathGenerateAllowed : true}
        />
        <ProfileTagStats entries={entries} />
      </div>

      {entrySeriesList.length > 0 && (
        <EntrySeriesSwitcher
          seriesList={entrySeriesList}
          activeEntrySeriesId={activeEntrySeriesId}
          onChange={handleSeriesChange}
        />
      )}

      {!hasAnyEntries && viewerIsOwner && (
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

      {searchActive && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
          <p className="text-sm text-indigo-900">
            正文包含「{bodySearchFind}」：找到 {shownEntries.length} 条
          </p>
          <button
            type="button"
            className="text-sm text-indigo-700 hover:underline"
            onClick={() => setBodySearchFind('')}
          >
            清除搜索
          </button>
        </div>
      )}

      {searchActive && entries.length > 0 && shownEntries.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
          <p className="text-slate-600">当前系列没有正文包含「{bodySearchFind}」的片段</p>
        </div>
      )}

      {hasAnyEntries && entries.length === 0 && viewerIsOwner && (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
          <p className="text-slate-600 mb-4">当前系列还没有片段</p>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={openCreate}
          >
            在本系列新建
          </button>
        </div>
      )}

      {hasAnyEntries && entries.length === 0 && !viewerIsOwner && (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
          <p className="text-slate-600">该系列暂无公开内容</p>
        </div>
      )}

      {!hasAnyEntries && !viewerIsOwner && (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
          <p className="text-slate-600">暂无公开内容</p>
        </div>
      )}

      {shownEntries.length > 0 && (
        <div className="space-y-2">
          {pinned.length > 0 && (
            <TimelineSection
              section={{ id: 'pinned', type: 'pinned', label: '置顶', entries: pinned }}
              isOwner={viewerIsOwner}
              accountId={ownerId}
              profileDisplayName={headerDisplayName}
              collapsed={isSectionCollapsed('pinned')}
              onToggleCollapse={() => toggleSectionCollapsed('pinned')}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 items-start">
            {sections.map((section) => {
              const collapsed = isSectionCollapsed(section.id);
              return (
                <div
                  key={section.id}
                  className={collapsed ? 'min-w-0' : 'col-span-2 min-w-0'}
                >
                  <TimelineSection
                    section={section}
                    isOwner={viewerIsOwner}
                    accountId={ownerId}
                    profileDisplayName={headerDisplayName}
                    collapsed={collapsed}
                    onToggleCollapse={() => toggleSectionCollapsed(section.id)}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <EntryEditorModal
        open={editorOpen}
        entry={editingEntry}
        profileDefaults={profileDefaults}
        defaultEntrySeriesId={activeEntrySeriesId}
        onClose={() => setEditorOpen(false)}
        onSaved={handleSaved}
        onEntrySeriesCreated={loadTimeline}
      />

      {viewerIsOwner && (
        <EntryBodyFindReplaceModal
          open={findReplaceOpen}
          seriesName={activeSeriesName}
          entries={entries}
          onClose={() => setFindReplaceOpen(false)}
          onSearch={handleSearchBodies}
          onReplace={handleReplaceBodies}
          replacing={replacingBodies}
        />
      )}

      <LifePathPreviewModal
        open={lifePathModalOpen}
        draft={lifePathDraft}
        onClose={() => setLifePathModalOpen(false)}
        onPublish={handlePublishLifePath}
        onDiscardDraft={handleDiscardLifePathDraft}
        publishing={publishingLifePath}
        discarding={discardingLifePath}
      />
    </div>
  );
}
