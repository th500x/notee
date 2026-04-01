/**
 * 传书模板 config_texts：列表、增删改、试发
 */

import { useState, useEffect } from 'react';
import { adminConfigTextsAPI } from '@/services/api';
import { useAdminToast } from '@/components/admin/useAdminToast';

/** S1 七势力（与 public/data/shared/factions.json 一致） */
const TRIAL_FACTIONS = [
  { id: 'san_1_faction_1001', name: '刘备' },
  { id: 'san_1_faction_2001', name: '曹操' },
  { id: 'san_1_faction_3001', name: '孙坚' },
  { id: 'san_1_faction_4001', name: '袁绍' },
  { id: 'san_1_faction_5001', name: '董卓' },
  { id: 'san_1_faction_6001', name: '汉室' },
  { id: 'san_1_faction_7001', name: '黄巾' }
];

/** 奖励附件 JSON 示例：银两/粮草/items 道具/cards 将领·部队·装备（与后端领取逻辑一致） */
const ATTACHMENTS_JSON_SAMPLE = `{
  "silver": 100,
  "food": 500,
  "items": {
    "item_nanyang_troop_legendary": 1
  },
  "cards": [
    "san_1_char_1002",
    "san_1_troop_0014",
    "san_1_equip_1_1001"
  ]
}`;

/** 新建/重置时的默认表单：模板 ID 与 reward 附件为「已填入」的真实初值，只需改 xxxx / 改 JSON 即可 */
const emptyForm = () => ({
  template_id: 'san_1_texts_xxxx',
  mail_type: 'system',
  subject: '',
  body: '',
  attachments_json: ATTACHMENTS_JSON_SAMPLE,
  season: 'san_1',
  is_enabled: true,
  sort_order: 0,
  remark: ''
});

const MailManager = () => {
  const { showToast, Toast } = useAdminToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => emptyForm());
  const [trialTemplateId, setTrialTemplateId] = useState('');
  const [trialTarget, setTrialTarget] = useState('user');
  const [trialFactionId, setTrialFactionId] = useState(TRIAL_FACTIONS[0].id);
  const [trialUserId, setTrialUserId] = useState('');
  const [trialSubject, setTrialSubject] = useState('');
  const [trialContent, setTrialContent] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await adminConfigTextsAPI.list();
      if (r.success) setRows(r.data || []);
      else setError(r.error || '加载失败');
    } catch (e) {
      setError('加载失败');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = (row) => {
    setEditingId(row.template_id);
    setForm({
      template_id: row.template_id,
      mail_type: row.mail_type || 'system',
      subject: row.subject || '',
      body: row.body || '',
      attachments_json:
        row.attachments_json != null
          ? typeof row.attachments_json === 'string'
            ? row.attachments_json
            : JSON.stringify(row.attachments_json, null, 2)
          : row.mail_type === 'reward'
            ? ATTACHMENTS_JSON_SAMPLE
            : '',
      season: row.season || '',
      is_enabled: !!row.is_enabled,
      sort_order: row.sort_order ?? 0,
      remark: row.remark || ''
    });
  };

  const save = async () => {
    setLoading(true);
    setError('');
    try {
      let attachments_json = form.attachments_json.trim() ? form.attachments_json : null;
      if (attachments_json && form.mail_type === 'system') {
        attachments_json = null;
      }
      const payload = {
        template_id: form.template_id.trim(),
        mail_type: form.mail_type,
        subject: form.subject.trim(),
        body: form.body,
        attachments_json,
        season: form.season.trim() || null,
        is_enabled: form.is_enabled,
        sort_order: Number(form.sort_order) || 0,
        remark: form.remark.trim() || null
      };
      if (!payload.template_id || !payload.subject) {
        setError('请填写模板 ID 与标题');
        setLoading(false);
        return;
      }
      const r = editingId
        ? await adminConfigTextsAPI.update(editingId, {
            mail_type: payload.mail_type,
            subject: payload.subject,
            body: payload.body,
            attachments_json,
            season: payload.season,
            is_enabled: payload.is_enabled,
            sort_order: payload.sort_order,
            remark: payload.remark
          })
        : await adminConfigTextsAPI.create(payload);
      if (r.success) {
        setEditingId(null);
        setForm(emptyForm());
        await load();
      } else {
        setError(r.error || '保存失败');
      }
    } catch (e) {
      setError('保存失败');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (templateId) => {
    if (!window.confirm(`删除模板 ${templateId}？`)) return;
    setLoading(true);
    const r = await adminConfigTextsAPI.remove(templateId);
    setLoading(false);
    if (r.success) {
      if (editingId === templateId) startNew();
      load();
    } else {
      showToast(r.error || '删除失败', 'error');
    }
  };

  const sendTrial = async () => {
    if (!trialTemplateId) {
      setError('请选择模板');
      return;
    }
    if (trialTarget === 'user') {
      if (!trialUserId.trim()) {
        setError('请填写用户 ID');
        return;
      }
    }
    if (trialTarget === 'faction' && !trialFactionId) {
      setError('请选择势力');
      return;
    }
    if (trialTarget === 'all') {
      if (!window.confirm('确定向当前数据库内【全部玩家】各发一封传书？（不含系统账号 sys1）')) return;
    }
    if (trialTarget === 'faction') {
      const fn = TRIAL_FACTIONS.find((f) => f.id === trialFactionId)?.name || '';
      if (!window.confirm(`确定向【势力：${fn}】内全部玩家各发一封传书？`)) return;
    }

    setLoading(true);
    setError('');
    const payload = {
      template_id: trialTemplateId,
      subject: trialSubject.trim() || undefined,
      content: trialContent.trim() || undefined
    };
    if (trialTarget === 'all') {
      payload.target_type = 'all';
    } else if (trialTarget === 'faction') {
      payload.target_type = 'faction';
      payload.faction_id = trialFactionId;
    } else {
      payload.target_type = 'user';
      payload.receiver_id = trialUserId.trim();
    }

    const r = await adminConfigTextsAPI.trialSend(payload);
    setLoading(false);
    if (r.success) {
      const n = r.data?.count ?? 1;
      const tid = r.data?.first_text_id || r.data?.sample_text_ids?.[0] || '';
      showToast(`试发成功，共 ${n} 封。首条 text_id: ${tid || '—'}`);
    } else {
      setError(r.error || '试发失败');
    }
  };

  return (
    <>
      <Toast />
    <div className="max-w-6xl mx-auto space-y-8 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">传书模板管理</h1>
          <p className="text-sm text-gray-600 mt-1">表 config_texts · 试发写入 texts（sender=sys1）</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            刷新
          </button>
          <button
            type="button"
            onClick={startNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            新建模板
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">{editingId ? `编辑：${editingId}` : '新建 / 编辑模板'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-gray-600">模板 ID</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 font-mono text-sm"
              value={form.template_id}
              onChange={(e) => setForm({ ...form, template_id: e.target.value })}
              disabled={!!editingId}
            />
            <span className="text-xs text-gray-500 mt-1 block">已预填完整模板 ID，只需把 xxxx 改成你的编号即可（与库内其它 ID 一样用下划线，如 san_1_texts_welcome）。</span>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">类型</span>
            <select
              className="mt-1 w-full border rounded px-3 py-2"
              value={form.mail_type}
              onChange={(e) => setForm({ ...form, mail_type: e.target.value })}
            >
              <option value="system">system</option>
              <option value="reward">reward</option>
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-gray-600">标题</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-gray-600">正文</span>
            <textarea
              className="mt-1 w-full border rounded px-3 py-2 font-mono text-sm min-h-[120px]"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
          <div className="md:col-span-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">attachments_json（reward 用，JSON）</span>
              <button
                type="button"
                className="text-xs px-2 py-1 bg-gray-100 rounded border hover:bg-gray-200"
                disabled={form.mail_type === 'system'}
                onClick={() => setForm({ ...form, attachments_json: ATTACHMENTS_JSON_SAMPLE })}
              >
                填入附件示例
              </button>
            </div>
            <textarea
              className="w-full border rounded px-3 py-2 font-mono text-xs min-h-[140px]"
              value={form.attachments_json}
              onChange={(e) => setForm({ ...form, attachments_json: e.target.value })}
              disabled={form.mail_type === 'system'}
            />
            <p className="text-xs text-gray-500 leading-relaxed">
              下方已预填完整 JSON，可直接改数值或增删字段。含义：银两 100、粮草 500；道具 <code className="bg-gray-100 px-0.5">item_nanyang_troop_legendary</code>；
              <code className="bg-gray-100 px-0.5">cards</code> 为将领/部队/装备各 1 张（势力通配符规则与事件奖励一致）。类型选 system 时保存会忽略附件。
            </p>
          </div>
          <label className="block text-sm">
            <span className="text-gray-600">赛季</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={form.season}
              onChange={(e) => setForm({ ...form, season: e.target.value })}
              placeholder="san_1"
            />
          </label>
          <label className="block text-sm flex flex-col gap-1 mt-1">
            <span className="flex items-center gap-2 text-gray-600">
              <input
                type="checkbox"
                checked={form.is_enabled}
                onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
              />
              启用
            </span>
            <span className="text-xs text-gray-500 pl-6">
              关闭后仍保存模板；将来若脚本/定时只发「已启用」模板，未勾选则不会被自动选中。试发不受此限制。
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">排序</span>
            <input
              type="number"
              className="mt-1 w-full border rounded px-3 py-2"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            />
            <span className="text-xs text-gray-500 mt-1 block">数字越小，在本页模板表格里越靠前（仅展示顺序）。</span>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-gray-600">备注</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          保存
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">试发</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-gray-600">模板</span>
            <select
              className="mt-1 w-full border rounded px-3 py-2"
              value={trialTemplateId}
              onChange={(e) => setTrialTemplateId(e.target.value)}
            >
              <option value="">选择模板</option>
              {rows.map((r) => (
                <option key={r.template_id} value={r.template_id}>
                  {r.template_id} ({r.mail_type})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-gray-600">接收类型</span>
            <select
              className="mt-1 w-full border rounded px-3 py-2"
              value={trialTarget === 'faction' ? trialFactionId : trialTarget}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'all' || v === 'user') {
                  setTrialTarget(v);
                } else {
                  setTrialTarget('faction');
                  setTrialFactionId(v);
                }
              }}
            >
              <option value="all">全部玩家</option>
              {TRIAL_FACTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  势力 · {f.name}
                </option>
              ))}
              <option value="user">用户 ID（单个）</option>
            </select>
          </label>
        </div>

        {trialTarget === 'user' && (
          <label className="block text-sm max-w-md">
            <span className="text-gray-600">用户 ID（4 位）</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={trialUserId}
              onChange={(e) => setTrialUserId(e.target.value)}
              placeholder="例如 0QVQ"
            />
          </label>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm md:col-span-2">
            <span className="text-gray-600">覆盖标题（可选）</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={trialSubject}
              onChange={(e) => setTrialSubject(e.target.value)}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-gray-600">覆盖正文（可选）</span>
            <textarea
              className="mt-1 w-full border rounded px-3 py-2 font-mono text-sm min-h-[80px]"
              value={trialContent}
              onChange={(e) => setTrialContent(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={sendTrial}
          disabled={loading}
          className="px-6 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
        >
          试发传书
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold">模板列表 ({rows.length})</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">类型</th>
                <th className="px-3 py-2">标题</th>
                <th className="px-3 py-2">赛季</th>
                <th className="px-3 py-2">启用</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.template_id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{r.template_id}</td>
                  <td className="px-3 py-2">{r.mail_type}</td>
                  <td className="px-3 py-2 max-w-xs truncate" title={r.subject}>
                    {r.subject}
                  </td>
                  <td className="px-3 py-2">{r.season || '—'}</td>
                  <td className="px-3 py-2">{r.is_enabled ? '是' : '否'}</td>
                  <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                    <button type="button" className="text-blue-600 hover:underline" onClick={() => startEdit(r)}>
                      编辑
                    </button>
                    <button type="button" className="text-red-600 hover:underline" onClick={() => remove(r.template_id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">暂无模板，请先执行迁移并新建</div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default MailManager;
