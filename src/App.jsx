import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, X, ExternalLink, LogOut, History, Save, Users,
  Clipboard, Copy, ChevronDown, ChevronUp, Layers
} from 'lucide-react';
import { supabase, configured } from './supabase';

const CITIES = [
  'Port Richey','New Port Richey','Holiday','Tarpon Springs','Palm Harbor',
  'Dunedin','Oldsmar','Safety Harbor','Clearwater','Clearwater Beach',
  'Indian Rocks Beach','Largo','Belleair Bluffs','Pinellas Park','Seminole',
  'Madeira Beach','Treasure Island','St Petersburg','St Pete Beach'
];

const STATUS = {
  not_visited: '待拜访',
  visited: '已卖进/拜访',
  follow_up: '需跟进',
  no_interest: '无意向/暂缓'
};

const emptyShop = () => ({
  name: '',
  address: '',
  city: 'Clearwater',
  phone: '',
  tier: '',
  status: 'not_visited',
  is_chain: false,
  chain_id: null,
  chain_name: '',
  chain_total_stores: '',
  staff_contact: '',
  owner_name: '',
  owner_schedule: '',
  contact_role: '',
  store_number: '',
  restock_status: '',
  distributor: '',
  test_case_placed: false,
  traffic_note: '',
  brands_note: '',
  next_plan: '',
  source_url: ''
});

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
  };

  return (
    <main className="login">
      <form className="panel" onSubmit={submit}>
        <h1>门店拜访清单</h1>
        <p>Tampa Bay 西岸 · 云端版</p>
        <label>邮箱<input value={email} onChange={e => setEmail(e.target.value)} type="email" required /></label>
        <label>密码<input value={password} onChange={e => setPassword(e.target.value)} type="password" required /></label>
        {err && <div className="error">{err}</div>}
        <button className="primary">登录</button>
      </form>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [shops, setShops] = useState([]);
  const [chains, setChains] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [visits, setVisits] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [reportText, setReportText] = useState('');
  const [copied, setCopied] = useState(false);
  const [expandedChains, setExpandedChains] = useState({});
  const [visit, setVisit] = useState({
    visit_date: new Date().toISOString().slice(0, 10),
    units: '',
    feedback: '',
    decision_maker: '',
    restock_status: '',
    test_case_placed: false,
    next_plan: ''
  });

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadAll();
    else {
      setProfile(null);
      setShops([]);
      setChains([]);
    }
  }, [session]);

  async function loadAll() {
    setLoading(true);
    const uid = session.user.id;

    const { data: p, error: pe } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();

    if (pe) {
      alert(pe.message);
      setLoading(false);
      return;
    }

    setProfile(p);

    const [{ data: s, error: se }, { data: c, error: ce }] = await Promise.all([
      supabase.from('shops').select('*').order('updated_at', { ascending: false }),
      supabase.from('chains').select('*').order('name')
    ]);

    if (se) alert(se.message);
    else setShops(s || []);

    if (ce) alert(ce.message);
    else setChains(c || []);

    if (p.role === 'manager') {
      const { data: m } = await supabase
        .from('profiles')
        .select('id,full_name,email,role,active')
        .eq('team_id', p.team_id)
        .order('full_name');
      setMembers(m || []);
    }

    setLoading(false);
  }

  function chainForShop(s) {
    if (!s?.chain_id) return null;
    return chains.find(c => c.id === s.chain_id) || null;
  }

  function chainShops(chainId) {
    return shops.filter(s => s.chain_id === chainId);
  }

  function toggleChain(chainId, e) {
    e?.stopPropagation?.();
    setExpandedChains(prev => ({ ...prev, [chainId]: !prev[chainId] }));
  }

  async function openShop(s) {
    setSelected(s.id);
    setDraft({
      ...s,
      chain_total_stores: s.chain_total_stores ?? chainForShop(s)?.total_stores ?? ''
    });
    setShowHistory(false);
    setReportText('');
    setCopied(false);

    const { data, error } = await supabase
      .from('visits')
      .select('*')
      .eq('shop_id', s.id)
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) alert(error.message);
    else setVisits(data || []);
  }

  function openNew(prefill = {}) {
    setSelected('new');
    setDraft({ ...emptyShop(), ...prefill });
    setVisits([]);
    setReportText('');
    setCopied(false);
  }

  function openNewForChain(chain, e) {
    e?.stopPropagation?.();
    openNew({
      is_chain: true,
      chain_id: chain.id,
      chain_name: chain.name,
      chain_total_stores: chain.total_stores
    });
  }

  async function ensureChainForDraft(payload) {
    if (!payload.is_chain) {
      payload.chain_id = null;
      payload.chain_name = '';
      payload.chain_total_stores = null;
      return payload;
    }

    const desiredName = (payload.chain_name || '').trim();
    const desiredTotal = payload.chain_total_stores === '' || payload.chain_total_stores == null
      ? 1
      : Math.max(1, Number(payload.chain_total_stores) || 1);

    let chainId = payload.chain_id || null;

    if (chainId) {
      const current = chains.find(c => c.id === chainId);
      const patch = {};
      if (desiredName && desiredName !== current?.name) patch.name = desiredName;
      if (desiredTotal !== current?.total_stores) patch.total_stores = desiredTotal;

      if (Object.keys(patch).length) {
        const { error } = await supabase.from('chains').update(patch).eq('id', chainId);
        if (error) throw error;
      }
    } else {
      if (!desiredName) {
        throw new Error('连锁店需要填写“连锁名称”，或选择一个已有连锁。');
      }

      const existing = chains.find(c =>
        c.team_id === profile.team_id &&
        c.name.trim().toLowerCase() === desiredName.toLowerCase()
      );

      if (existing) {
        chainId = existing.id;
        if (desiredTotal !== existing.total_stores) {
          const { error } = await supabase
            .from('chains')
            .update({ total_stores: desiredTotal })
            .eq('id', existing.id);
          if (error) throw error;
        }
      } else {
        const { data, error } = await supabase
          .from('chains')
          .insert({
            team_id: profile.team_id,
            name: desiredName,
            total_stores: desiredTotal
          })
          .select()
          .single();

        if (error) throw error;
        chainId = data.id;
      }
    }

    payload.chain_id = chainId;
    payload.chain_name = desiredName;
    payload.chain_total_stores = desiredTotal;
    return payload;
  }

  async function saveShop() {
    if (!draft.name.trim()) return;

    try {
      let payload = {
        ...draft,
        name: draft.name.trim(),
        chain_total_stores: draft.chain_total_stores === ''
          ? null
          : Number(draft.chain_total_stores)
      };

      payload = await ensureChainForDraft(payload);

      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;

      if (selected === 'new') {
        payload.team_id = profile.team_id;
        payload.assigned_to = profile.role === 'manager'
          ? (draft.assigned_to || profile.id)
          : profile.id;

        const { error } = await supabase.from('shops').insert(payload);
        if (error) return alert(error.message);
      } else {
        const { error } = await supabase.from('shops').update(payload).eq('id', selected);
        if (error) return alert(error.message);
      }

      setSelected(null);
      setDraft(null);
      await loadAll();
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  async function addVisit() {
    if (selected === 'new') return;

    const payload = {
      shop_id: selected,
      sales_id: session.user.id,
      ...visit,
      units: Number(visit.units) || 0
    };

    const { error } = await supabase.from('visits').insert(payload);
    if (error) return alert(error.message);

    await supabase
      .from('shops')
      .update({
        status: 'visited',
        restock_status: visit.restock_status || draft.restock_status,
        test_case_placed: visit.test_case_placed || draft.test_case_placed,
        next_plan: visit.next_plan || draft.next_plan
      })
      .eq('id', selected);

    setVisit({
      visit_date: new Date().toISOString().slice(0, 10),
      units: '',
      feedback: '',
      decision_maker: '',
      restock_status: '',
      test_case_placed: false,
      next_plan: ''
    });

    await openShop({ ...draft, id: selected });
    await loadAll();
  }

  function buildReport() {
    if (!draft) return;
    const owner = visit.decision_maker || draft.owner_name || draft.staff_contact || '未知';
    const restock = visit.restock_status || draft.restock_status || '未知';
    const remarkParts = [
      draft.owner_schedule,
      draft.traffic_note,
      draft.brands_note,
      visit.feedback,
      visit.next_plan || draft.next_plan
    ]
      .map(x => (x || '').trim())
      .filter(Boolean);

    const remarks = remarkParts.length ? remarkParts.join('，') : '无';
    const address = [draft.address, draft.city, draft.state || 'FL'].filter(Boolean).join(', ');
    const chain = chainForShop(draft);
    const totalStores = chain?.total_stores || draft.chain_total_stores;
    const storeDisplay = draft.is_chain && totalStores
      ? `${totalStores}家`
      : (draft.store_number || '未知');

    setReportText([
      `店名：${draft.name || '未知'}`,
      `地址：${address || '未知'}`,
      `老板：${owner}`,
      `电话：${draft.phone || '未知'}`,
      `店面：${storeDisplay}`,
      `进货：${restock}`,
      `备注：${remarks}`
    ].join('\n'));

    setCopied(false);
  }

  async function copyReport() {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      alert('复制失败，请手动选择文本复制');
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return shops.filter(s =>
      !q ||
      [s.name, s.address, s.city, s.owner_name, s.staff_contact, s.chain_name]
        .some(v => (v || '').toLowerCase().includes(q))
    );
  }, [shops, search]);

  if (!configured) {
    return (
      <main className="login">
        <div className="panel">
          <h1>还差环境变量</h1>
          <p>
            把 <code>.env.example</code> 复制成 <code>.env</code>，填入你的 Supabase Project URL
            和 Publishable key，然后重新启动。
          </p>
        </div>
      </main>
    );
  }

  if (loading) return <div className="loading">加载中…</div>;
  if (!session) return <Login />;

  return (
    <main className="app">
      <header>
        <div>
          <h1>门店拜访清单</h1>
          <span>Tampa Bay 西岸</span>
        </div>
        <div className="user">
          <Users size={15} />
          {profile?.full_name || session.user.email}
          <b>{profile?.role === 'manager' ? 'Manager' : 'Sales'}</b>
          <button onClick={() => supabase.auth.signOut()}>
            <LogOut size={15} />退出
          </button>
        </div>
      </header>

      <section className="toolbar">
        <div className="search">
          <Search size={15} />
          <input
            placeholder="搜索店名 / 地址 / 城市 / 联系人 / 连锁名"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="primary" onClick={() => openNew()}>
          <Plus size={15} />添加店铺
        </button>
        <button disabled title="后续版本：导出今日 Excel">
          导出今日表格（预留）
        </button>
      </section>

      {profile?.role === 'manager' && (
        <div className="manager-note">
          Manager 模式：当前可查看团队全部门店 · {members.length} 个账号
        </div>
      )}

      <div className="count">共 {filtered.length} 家店铺</div>

      <section>
        {filtered.map(s => {
          const chain = chainForShop(s);
          const siblingShops = chain ? chainShops(chain.id) : [];
          const totalStores = chain?.total_stores || s.chain_total_stores || siblingShops.length || 1;
          const isExpanded = chain && expandedChains[chain.id];

          return (
            <article className="card" key={s.id} onClick={() => openShop(s)}>
              <div className="cardtop">
                <div>
                  <strong>{s.name}</strong>
                  <small>{s.city}{s.address ? ` · ${s.address}` : ' · 地址待补充'}</small>
                </div>
                <div>
                  {chain && (
                    <button
                      type="button"
                      className="chip"
                      onClick={(e) => toggleChain(chain.id, e)}
                      title="展开/收起连锁门店"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                    >
                      <Layers size={12} />
                      连锁 · {totalStores}家
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                  <span className="chip">{s.tier || '未分级'}</span>
                  <span className="chip">{STATUS[s.status]}</span>
                </div>
              </div>

              <div className="meta">
                {s.owner_name && <span>老板 {s.owner_name}</span>}
                {s.distributor && <span>批发商 {s.distributor}</span>}
                {s.test_case_placed && <span>已放 Test Case</span>}
              </div>

              {s.brands_note && <p>{s.brands_note}</p>}
              {s.next_plan && <p className="next">下次：{s.next_plan}</p>}

              {chain && isExpanded && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid rgba(0,0,0,.08)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <b>{chain.name} · 门店地址</b>
                    <button type="button" onClick={(e) => openNewForChain(chain, e)}>
                      <Plus size={13} />新增同连锁门店
                    </button>
                  </div>

                  <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                    {Array.from({ length: Math.max(totalStores, siblingShops.length) }).map((_, idx) => {
                      const member = siblingShops[idx];
                      return member ? (
                        <button
                          type="button"
                          key={member.id}
                          onClick={() => openShop(member)}
                          style={{
                            textAlign: 'left',
                            padding: '8px 10px',
                            border: '1px solid rgba(0,0,0,.08)',
                            borderRadius: 8,
                            background: 'rgba(255,255,255,.65)'
                          }}
                        >
                          <b>店铺 {idx + 1}</b>
                          <div style={{ fontSize: 13, opacity: .8 }}>
                            {[member.address, member.city, member.state || 'FL'].filter(Boolean).join(', ') || '地址待补充'}
                          </div>
                        </button>
                      ) : (
                        <div
                          key={`placeholder-${idx}`}
                          style={{
                            padding: '8px 10px',
                            border: '1px dashed rgba(0,0,0,.15)',
                            borderRadius: 8,
                            opacity: .65
                          }}
                        >
                          <b>店铺 {idx + 1}</b>
                          <div style={{ fontSize: 13 }}>地址待补充</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {draft && (
        <div className="modal" onMouseDown={() => { setDraft(null); setSelected(null); }}>
          <div className="editor" onMouseDown={e => e.stopPropagation()}>
            <div className="editorhead">
              <h2>{selected === 'new' ? '添加店铺' : '编辑店铺'}</h2>
              <button onClick={() => setDraft(null)}><X size={18} /></button>
            </div>

            <div className="grid">
              <Field label="店铺名称">
                <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
              </Field>

              <Field label="城市">
                <select value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value })}>
                  {CITIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>

              <Field wide label="地址">
                <input value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} />
              </Field>

              <Field label="电话">
                <input value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} />
              </Field>

              <Field label="评级">
                <select value={draft.tier} onChange={e => setDraft({ ...draft, tier: e.target.value })}>
                  {['', 'S', 'A+', 'A', 'B'].map(x => <option key={x} value={x}>{x || '未分级'}</option>)}
                </select>
              </Field>

              <Field label="拜访状态">
                <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>

              <Field label="是否连锁店">
                <select
                  value={draft.is_chain ? 'yes' : 'no'}
                  onChange={e => {
                    const yes = e.target.value === 'yes';
                    setDraft({
                      ...draft,
                      is_chain: yes,
                      chain_id: yes ? draft.chain_id : null,
                      chain_name: yes ? draft.chain_name : '',
                      chain_total_stores: yes ? (draft.chain_total_stores || 1) : ''
                    });
                  }}
                >
                  <option value="no">否</option>
                  <option value="yes">是</option>
                </select>
              </Field>

              {draft.is_chain && (
                <>
                  <Field label="选择已有连锁">
                    <select
                      value={draft.chain_id || ''}
                      onChange={e => {
                        const id = e.target.value || null;
                        const c = chains.find(x => x.id === id);
                        setDraft({
                          ...draft,
                          chain_id: id,
                          chain_name: c?.name || draft.chain_name || '',
                          chain_total_stores: c?.total_stores || draft.chain_total_stores || 1
                        });
                      }}
                    >
                      <option value="">新建连锁 / 不选择</option>
                      {chains.map(c => (
                        <option value={c.id} key={c.id}>
                          {c.name} · {c.total_stores}家
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="连锁名称">
                    <input
                      value={draft.chain_name || ''}
                      onChange={e => setDraft({ ...draft, chain_name: e.target.value })}
                      placeholder="例如 ABC Smoke Shop"
                    />
                  </Field>

                  <Field label="店铺数量">
                    <input
                      type="number"
                      min="1"
                      value={draft.chain_total_stores ?? ''}
                      onChange={e => setDraft({ ...draft, chain_total_stores: e.target.value })}
                      placeholder="例如 4"
                    />
                  </Field>
                </>
              )}

              <Field label="老板 / Decision maker">
                <input value={draft.owner_name} onChange={e => setDraft({ ...draft, owner_name: e.target.value })} />
              </Field>

              <Field label="员工联系人">
                <input value={draft.staff_contact} onChange={e => setDraft({ ...draft, staff_contact: e.target.value })} />
              </Field>

              <Field label="老板到店规律">
                <input value={draft.owner_schedule} onChange={e => setDraft({ ...draft, owner_schedule: e.target.value })} />
              </Field>

              <Field label="主要拿货二级批发商">
                <input value={draft.distributor} onChange={e => setDraft({ ...draft, distributor: e.target.value })} />
              </Field>

              <Field label="进货情况">
                <input value={draft.restock_status} onChange={e => setDraft({ ...draft, restock_status: e.target.value })} />
              </Field>

              <Field label="是否放 Test Case">
                <select
                  value={draft.test_case_placed ? 'yes' : 'no'}
                  onChange={e => setDraft({ ...draft, test_case_placed: e.target.value === 'yes' })}
                >
                  <option value="no">否</option>
                  <option value="yes">是</option>
                </select>
              </Field>

              {profile?.role === 'manager' && (
                <Field label="负责人">
                  <select
                    value={draft.assigned_to || profile.id}
                    onChange={e => setDraft({ ...draft, assigned_to: e.target.value })}
                  >
                    {members.filter(m => m.active).map(m => (
                      <option value={m.id} key={m.id}>
                        {m.full_name || m.email} · {m.role}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field wide label="热卖品牌明细">
                <textarea value={draft.brands_note} onChange={e => setDraft({ ...draft, brands_note: e.target.value })} />
              </Field>

              <Field wide label="客流 / 位置信息">
                <textarea value={draft.traffic_note} onChange={e => setDraft({ ...draft, traffic_note: e.target.value })} />
              </Field>

              <Field wide label="下次拜访计划">
                <input value={draft.next_plan} onChange={e => setDraft({ ...draft, next_plan: e.target.value })} />
              </Field>
            </div>

            {draft.is_chain && draft.chain_id && (
              <div className="visitbox">
                <h3>连锁门店 <small>当前系统已录入 {chainShops(draft.chain_id).length} 家</small></h3>
                <div className="history">
                  {chainShops(draft.chain_id).map((member, idx) => (
                    <div key={member.id}>
                      <b>店铺 {idx + 1} · {member.name}</b>
                      <p>
                        {[member.address, member.city, member.state || 'FL']
                          .filter(Boolean)
                          .join(', ') || '地址待补充'}
                      </p>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const c = chains.find(x => x.id === draft.chain_id);
                      if (c) openNewForChain(c);
                    }}
                  >
                    <Plus size={14} />新增同连锁门店
                  </button>
                </div>
              </div>
            )}

            {selected !== 'new' && (
              <>
                <div className="visitbox">
                  <h3>拜访记录 <small>明面显示最近 3 次</small></h3>
                  <div className="visitform">
                    <input
                      type="date"
                      value={visit.visit_date}
                      onChange={e => setVisit({ ...visit, visit_date: e.target.value })}
                    />
                    <input
                      placeholder="进店支数"
                      value={visit.units}
                      onChange={e => setVisit({ ...visit, units: e.target.value })}
                    />
                    <input
                      placeholder="Decision maker"
                      value={visit.decision_maker}
                      onChange={e => setVisit({ ...visit, decision_maker: e.target.value })}
                    />
                    <input
                      placeholder="进货情况"
                      value={visit.restock_status}
                      onChange={e => setVisit({ ...visit, restock_status: e.target.value })}
                    />
                    <textarea
                      placeholder="Visit feedback / 当日动态"
                      value={visit.feedback}
                      onChange={e => setVisit({ ...visit, feedback: e.target.value })}
                    />
                    <input
                      placeholder="下次计划"
                      value={visit.next_plan}
                      onChange={e => setVisit({ ...visit, next_plan: e.target.value })}
                    />
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={visit.test_case_placed}
                        onChange={e => setVisit({ ...visit, test_case_placed: e.target.checked })}
                      />
                      本次放 Test Case
                    </label>
                    <button onClick={addVisit}><Plus size={14} />记录本次拜访</button>
                  </div>

                  <div className="history">
                    {visits.slice(0, showHistory ? 10 : 3).map(v => (
                      <div key={v.id}>
                        <b>{v.visit_date}</b> · {v.units}支 {v.decision_maker && `· ${v.decision_maker}`}
                        <p>{v.feedback || '无反馈备注'}</p>
                      </div>
                    ))}

                    {visits.length > 3 && (
                      <button onClick={() => setShowHistory(!showHistory)}>
                        <History size={14} />{showHistory ? '收起' : '查看最近 10 次'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="visitbox">
                  <h3>拜访播报</h3>
                  <button onClick={buildReport}>
                    <Clipboard size={14} />一键生成播报文本
                  </button>

                  {reportText && (
                    <div style={{ marginTop: 10 }}>
                      <textarea
                        readOnly
                        value={reportText}
                        style={{ minHeight: 160, whiteSpace: 'pre-wrap' }}
                      />
                      <button style={{ marginTop: 8 }} onClick={copyReport}>
                        <Copy size={14} />{copied ? '已复制' : '复制播报'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            <footer>
              <button className="primary" onClick={saveShop}>
                <Save size={15} />保存门店
              </button>

              {draft.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${draft.name} ${draft.address} ${draft.city} FL`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} />谷歌地图
                </a>
              )}
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({ label, children, wide }) {
  return (
    <label className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      {children}
    </label>
  );
}
