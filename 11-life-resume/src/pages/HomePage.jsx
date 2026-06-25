import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLifeAuth } from '@/contexts/LifeAuthContext';
import { useLifeProfile } from '@/contexts/LifeProfileContext';
import usePageMeta from '@/hooks/usePageMeta';
import { fetchHomeCards, fetchPublicHomeCards } from '@/services/lifeResumeApi';
import MyProfileCard from '@/components/home/MyProfileCard';
import SharedAccessCard from '@/components/home/SharedAccessCard';
import PublicProfileCard from '@/components/home/PublicProfileCard';

export default function HomePage() {
  const { isLoggedIn, bootstrapping } = useLifeAuth();
  const { profile } = useLifeProfile();
  usePageMeta({ title: '人生片段', robots: 'noindex, nofollow' });
  const [cards, setCards] = useState(null);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState('');
  const [publicCards, setPublicCards] = useState(null);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState('');
  const isDeactivated = profile?.profileStatus === 'deactivated';

  useEffect(() => {
    if (!isLoggedIn || bootstrapping || isDeactivated) {
      setCards(null);
      if (!isDeactivated) setCardsError('');
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setCardsLoading(true);
      try {
        const res = await fetchHomeCards();
        if (!cancelled) {
          setCards(res.data);
          setCardsError('');
        }
      } catch (err) {
        if (!cancelled) {
          setCards(null);
          setCardsError(err.message || '无法加载首页卡片');
        }
      } finally {
        if (!cancelled) setCardsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, bootstrapping, isDeactivated]);

  useEffect(() => {
    if (isLoggedIn || bootstrapping) {
      setPublicCards(null);
      setPublicError('');
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setPublicLoading(true);
      try {
        const res = await fetchPublicHomeCards();
        if (!cancelled) {
          setPublicCards(res.data || []);
          setPublicError('');
        }
      } catch (err) {
        if (!cancelled) {
          setPublicCards(null);
          setPublicError(err.message || '无法加载公开片段');
        }
      } finally {
        if (!cancelled) setPublicLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, bootstrapping]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">记录你的人生片段</h1>
        <p className="text-slate-600 leading-relaxed mb-6">
          按年份整理文字、照片与地点；你可以选择公开，或只对特定的人可见。公开页链接形如{' '}
          <code className="text-sm bg-slate-100 px-1.5 py-0.5 rounded">/u/3ABC</code>。
        </p>
        {!isLoggedIn && !bootstrapping && (
          <>
            <p className="text-sm text-slate-500 mb-4">登录后可编辑；也可浏览他人公开片段。</p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                登录
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                注册
              </Link>
            </div>
          </>
        )}
      </section>

      {!isLoggedIn && !bootstrapping && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">公开片段</h2>
          {publicLoading && (
            <p className="text-sm text-slate-500 text-center py-6">加载中…</p>
          )}
          {publicError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              {publicError}
            </p>
          )}
          {!publicLoading && !publicError && publicCards?.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {publicCards.map((item) => (
                <PublicProfileCard
                  key={item.accountId}
                  accountId={item.accountId}
                  displayName={item.displayName}
                  username={item.username}
                  publicEntryCount={item.publicEntryCount}
                  publishedLifePath={item.publishedLifePath}
                />
              ))}
            </div>
          )}
          {!publicLoading && !publicError && publicCards?.length === 0 && (
            <p className="text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-4 py-6 text-center">
              暂无公开片段
            </p>
          )}
        </section>
      )}

      {isLoggedIn && !bootstrapping && isDeactivated && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          你的片段处于注销冷静期，公开页暂不可访问。
          <Link to="/settings" className="ml-2 text-amber-950 underline font-medium">
            前往设置撤销注销
          </Link>
        </section>
      )}

      {isLoggedIn && !bootstrapping && !isDeactivated && (
        <section className="space-y-6">
          {cardsLoading && (
            <p className="text-sm text-slate-500 text-center py-6">加载中…</p>
          )}
          {cardsError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              {cardsError}
            </p>
          )}
          {cards?.mine && (
            <MyProfileCard
              accountId={cards.mine.accountId}
              displayName={cards.mine.displayName}
              username={cards.mine.username}
              isDefaultUsername={cards.mine.isDefaultUsername}
            />
          )}
          {cards && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">分享给我看的</h2>
              {cards.sharedWithMe?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cards.sharedWithMe.map((item) => (
                    <SharedAccessCard
                      key={item.accountId}
                      accountId={item.accountId}
                      displayName={item.displayName}
                      username={item.username}
                      accessibleEntryCount={item.accessibleEntryCount}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-4 py-6 text-center">
                  暂无他人对你开放的特定条目
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
