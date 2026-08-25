import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, Plus, X, Phone, User, Filter, ExternalLink, Trash2, Check,
  ChevronDown, Copy, Clipboard, Link2, Upload,
} from "lucide-react";

// Outside Claude.ai, window.storage doesn't exist — this polyfills it with the
// browser's own localStorage so the same file runs standalone (e.g. via Vite)
// with real, permanent persistence you control yourself.
if (typeof window !== "undefined" && !window.storage) {
  const nsKey = (key, shared) => `vst:${shared ? "shared" : "personal"}:${key}`;
  window.storage = {
    async get(key, shared) {
      const raw = localStorage.getItem(nsKey(key, shared));
      if (raw === null) throw new Error("key not found: " + key);
      return { key, value: raw, shared: !!shared };
    },
    async set(key, value, shared) {
      localStorage.setItem(nsKey(key, shared), value);
      return { key, value, shared: !!shared };
    },
    async delete(key, shared) {
      localStorage.removeItem(nsKey(key, shared));
      return { key, deleted: true, shared: !!shared };
    },
    async list(prefix, shared) {
      const ns = `vst:${shared ? "shared" : "personal"}:`;
      const keys = Object.keys(localStorage)
        .filter((k) => k.startsWith(ns + (prefix || "")))
        .map((k) => k.slice(ns.length));
      return { keys, prefix, shared: !!shared };
    },
  };
}

const STORAGE_KEY = "tampabay-vape-shops-v6";
// Every time the schema/version changes we bump the key above — but that risks orphaning
// data someone already saved under an older key. This list lets the app recover it instead
// of silently falling back to seed data.
const LEGACY_KEYS = [
  "tampabay-vape-shops-v5",
  "tampabay-vape-shops-v4",
  "tampabay-vape-shops-v3",
  "tampabay-vape-shops-v2",
];

const CITIES = [
  "Port Richey", "New Port Richey", "Holiday", "Tarpon Springs", "Palm Harbor",
  "Dunedin", "Oldsmar", "Safety Harbor", "Clearwater", "Clearwater Beach",
  "Indian Rocks Beach", "Largo", "Belleair Bluffs", "Pinellas Park", "Seminole",
  "Madeira Beach", "Treasure Island", "St Petersburg", "St Pete Beach",
];

const TIER_LABEL = { "": "未分级", S: "S类", "A+": "A+类", A: "A类", B: "B类" };
const TIER_COLOR = { "": "#B4B2A9", S: "#D85A30", "A+": "#BA7517", A: "#0F6E56", B: "#888780" };
const STATUS_LABEL = { not_visited: "待拜访", visited: "已卖进/拜访", follow_up: "需跟进", no_interest: "无意向/暂缓" };
const STATUS_COLOR = { not_visited: "#D85A30", visited: "#0F6E56", follow_up: "#BA7517", no_interest: "#888780" };

// Seed data = only shops you've actually visited and entered yourself.
// Everything else that used to be here (the ~37 Yelp/map-search placeholders)
// has been removed per your request — this is now a clean slate that only
// grows from your own field notes.
const SEED = [
  {
    name: "Macs Smoke Shop", address: "1220 Clearwater Largo Rd", city: "Largo", phone: "",
    staffContact: "Dang", status: "visited",
    brandsNote: "raz / ras mary",
    trafficNote: "大约10支/天",
    nextPlan: "可能下周再来一次",
    visitLog: [{ date: todayStr(), units: 0, note: "店员Dang，热卖raz/ras mary，约10支/天" }],
  },
  {
    name: "NU Vape & Glass Inc", address: "1703 S Missouri Ave", city: "Clearwater", phone: "",
    ownerName: "Chad / Serra", ownerSchedule: "Chad周日周一在；Serra周二12点后在", status: "visited",
    brandsNote: "raz $27.99\ngeek $23.99\n店员喜欢带 Watermelon/mint",
    trafficNote: "Chad在时约20-25支/天，Serra在时约40支/天",
    nextPlan: "下周二带试抽盒",
    visitLog: [{ date: todayStr(), units: 0, note: "两位负责人分别反馈：Chad周一20-25支/天；Serra周二40支/天，raz$27.99/geek$23.99" }],
  },
  {
    name: "Sun Flare Smoke and Kava Bar", address: "910 W Bay Dr", city: "Largo", phone: "(848) 242-9020",
    isChain: true, chainTotalStores: 2, status: "visited",
    trafficNote: "二次拜访，放置test station，老板对口味比较满意",
    nextPlan: "从7 Star拿货，给老板看了口味单子，表示会让顾客尝试",
    visitLog: [
      { date: todayStr(), units: 0, note: "明天sales manager在店里，放试用品，详聊" },
      { date: todayStr(), units: 0, note: "二次拜访，放置test station，老板对口味满意，从7 Star拿货" },
    ],
  },
  {
    name: "Smoke Rite Smoke Shop", address: "11100 66th St N Unit 31", city: "Largo", phone: "",
    ownerName: "Jack", status: "visited",
    trafficNote: "店很小，老板说大概一天10支；店员不清楚具体销量，货架上lost Mary和raz比较多",
    nextPlan: "老板希望寄售(consignment)；老板今天下午三点半到店",
    visitLog: [{ date: todayStr(), units: 0, note: "希望寄售，店很小" }],
  },
  {
    name: "Local Store Smoke Shop and Convenience Store", address: "5825 66th St N", city: "St Petersburg", phone: "(727) 598-2063",
    ownerName: "Ric", ownerSchedule: "周四、五、六下午在店里，今天下午两点来", status: "visited",
    brandsNote: "什么牌子都有卖\nraz 35K $19.99\ngeek bar\n店内已有 Vozol 50K，草莓/西瓜口味卖得好",
    trafficNote: "日销60+支，拜访期间遇到3位顾客；女店员尝了blue razz表示不错",
    nextPlan: "已放test station，等下午老板来了再拜访",
    visitLog: [{ date: todayStr(), units: 0, note: "日销60+，老板对Vozol草莓西瓜反馈好；女店员试吃blue razz反馈不错，放了test station" }],
  },
  {
    name: "Mis Electronics Smoke Shop", address: "", city: "St Petersburg", phone: "",
    ownerName: "MJ", status: "visited",
    brandsNote: "主要卖raz",
    trafficNote: "约10-15支/天，老板感兴趣，愿意帮忙放试用品(example)",
    visitLog: [{ date: todayStr(), units: 0, note: "West Lealman 片区，老板MJ愿意试放样品" }],
  },
  {
    name: "Pinellas Food & Smoke Shop", address: "8191 66th St N", city: "Pinellas Park", phone: "",
    ownerName: "M", status: "visited",
    brandsNote: "geekbar 35K $19.99\nlosmary 70K $24.99\nmint/3Berry/strawberry口味卖得好\n7-Star已有货",
    trafficNote: "约20支/天，老板在考虑换新品，愿意尝试",
    nextPlan: "今天二次拜访，已放置test station在收银台旁边；两周后7 Star会有货",
    visitLog: [
      { date: todayStr(), units: 0, note: "老板M有意向换新品，7-Star已铺货，需带样品跟进" },
      { date: todayStr(), units: 0, note: "二次拜访，放置test station在收银台旁，老板愿意让顾客尝试新品" },
    ],
  },
  {
    name: "Save Well Mart And Smoke Shop", address: "6595 66th St N", city: "Pinellas Park", phone: "",
    ownerSchedule: "老板周六会在店里", status: "follow_up",
    brandsNote: "店内raz比较多",
    trafficNote: "拜访时只有临时工在，不清楚详情",
  },
  {
    name: "Gone With the Wind Smoke Shop", address: "6101 Park Blvd Ste D", city: "Pinellas Park", phone: "",
    status: "no_interest",
    trafficNote: "店主不友善，此前卖电子烟因政府禁令亏损严重，现基本不卖，角落小货架仅几盒raz，不让拍照",
  },

  // --- New visits added from today's report screenshots ---
  {
    name: "Skyline Smoke Shop & Dispensary", address: "9753 66th St N", city: "Pinellas Park", phone: "",
    status: "follow_up",
    trafficNote: "老板周一二晚六点后在，店员说可能不打算买新品，店里大麻卖的比较多",
  },
  {
    name: "66 Smoke Shop", address: "10201 66th St N", city: "Pinellas Park", phone: "",
    status: "no_interest",
    trafficNote: "老板不在，店员不愿意透露信息，表示不带sample不想继续聊下去",
  },
  {
    name: "Asylum Smoke & Stuff", address: "7149 Ulmerton Rd", city: "Largo", phone: "",
    isChain: true, chainTotalStores: 4, status: "follow_up",
    trafficNote: "店员说卖的很多，四家连锁店",
    nextPlan: "店员不能自行放test station，需问老板；老板很忙不来店里，已拿到老板邮箱，直接联系老板",
  },
  {
    name: "Master Novelty Smoke Shop", address: "8248 Ulmerton Rd", city: "Largo", phone: "",
    status: "follow_up",
    trafficNote: "店比较小，一天卖十几支，店长不怎么来店里，店员也不清楚店长什么时候来",
    nextPlan: "已留联系方式",
  },
  {
    name: "Strange Cloudz Vape And Smoke Shop", address: "13355 S Belcher Rd A", city: "Largo", phone: "",
    status: "visited",
    trafficNote: "客流不错，进店期间来了六七个顾客，从7 Star拿货",
    brandsNote: "raz pod $17.99",
    nextPlan: "店员尝了两个口味都觉得不错，已放test station",
  },
  {
    name: "Exclusive Smokes & Same Day Delivery", address: "7250 Ulmerton Rd", city: "Largo", phone: "",
    status: "follow_up",
    trafficNote: "日销约30支左右",
    brandsNote: "raz pod $19.99",
    nextPlan: "店员当场给老板打了电话并留下test station，老板说自己会先试一下，喜欢的话会回电",
  },
  {
    name: "2Cloudy Vape", address: "14100 US Hwy 19 N #112", city: "Clearwater", phone: "",
    status: "visited",
    trafficNote: "一天十几支，进货渠道是7 Star",
    nextPlan: "店主表示愿意卖新品，觉得我们价格比较低、也喜欢口味，希望下次带sample给顾客试",
  },
  {
    name: "Jungle Smoke Shop", address: "6160 Ulmerton Rd #3", city: "Dunedin", phone: "",
    isChain: true, chainTotalStores: 2, status: "visited",
    trafficNote: "有两家店，加起来一天三十多支",
    nextPlan: "已留test station，店主表示愿意让顾客尝试，但需要客户反馈喜欢才会后续采购",
  },
  {
    name: "IndianRocks SmokeShop", address: "1495 Indian Rocks Rd #2", city: "Indian Rocks Beach", phone: "",
    status: "no_interest",
    trafficNote: "sales manager在店里，不是很感兴趣，不从7 Star拿货，raz卖得比较多",
  },
  {
    name: "Mirage Emporium Smoke Shop", address: "760 Indian Rocks Rd N", city: "Belleair Bluffs", phone: "",
    isChain: true, chainTotalStores: 2, status: "visited",
    trafficNote: "有两家店，这家新开的，一天卖15支左右，sales manager周四一整天都在",
    brandsNote: "raz kit $29.99, pod $19.99",
    nextPlan: "让店员试了一下，反馈不错",
  },
  {
    name: "Mirage Emporium Smoke Shop #2", address: "1705 Clearwater Largo Rd", city: "Largo", phone: "(813) 507-9391",
    isChain: true, chainName: "Mirage Emporium Smoke Shop", chainTotalStores: 2, status: "visited",
    ownerName: "Mirage Rattani",
    trafficNote: "老板碰巧不在，但平常每天都来",
    nextPlan: "店员给了老板名片",
  },
  {
    name: "Cloud 9 Galleries Smokeshop", address: "1661 W Bay Dr", city: "Largo", phone: "",
    status: "follow_up",
    trafficNote: "店员说老板有很多家店，拿了老板名片；店员自己抽raz碰到过漏油的问题；店里电子烟摆放面积不大，就收银台边上一个角",
    nextPlan: "已介绍产品，但店员不能提供老板联系方式",
  },
  {
    name: "Sam Smoke Shop", address: "741 Clearwater Largo Rd", city: "Largo", phone: "",
    ownerName: "Yaz", status: "visited",
    trafficNote: "刚开业五天，店里主要是raz",
    nextPlan: "给老板试了一下觉得不错，老板说如果消费者喜欢愿意尝试",
  },
  {
    name: "Cozy Smoke Shop 1 / Vape & Kratom Bar", address: "178 W Bay Dr", city: "Largo", phone: "",
    status: "visited",
    trafficNote: "一天三十多支",
    brandsNote: "nexa 买二送一, raz $22.99",
    nextPlan: "已留test station，sales manager下周一二早上会在",
  },
];

function makeShop(s, i) {
  return {
    id: "seed-" + i, name: s.name, address: s.address || "", city: s.city, phone: s.phone || "",
    tier: s.tier || "", status: s.status || "not_visited",
    isChain: s.isChain || false, chainName: s.chainName || "", chainTotalStores: s.chainTotalStores || "",
    staffContact: s.staffContact || "", ownerName: s.ownerName || "", ownerSchedule: s.ownerSchedule || "",
    contactRole: s.contactRole || "", storeNumber: s.storeNumber || "", restockStatus: s.restockStatus || "",
    trafficNote: s.trafficNote || "", brandsNote: s.brandsNote || "", nextPlan: s.nextPlan || "",
    sourceUrl: s.sourceUrl || "", visitLog: s.visitLog || [],
  };
}
const SEED_SHOPS = SEED.map(makeShop);

function emptyDraft() {
  return {
    id: null, name: "", address: "", city: CITIES[5], phone: "",
    tier: "", status: "not_visited",
    isChain: false, chainName: "", chainTotalStores: "",
    staffContact: "", ownerName: "", ownerSchedule: "",
    contactRole: "", storeNumber: "", restockStatus: "",
    trafficNote: "", brandsNote: "", nextPlan: "",
    sourceUrl: "", visitLog: [],
  };
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function addressLine(shop) {
  const addr = (shop.address || "").trim();
  if (!addr) return "地址待补充";
  const cityLower = (shop.city || "").toLowerCase();
  if (cityLower && addr.toLowerCase().includes(cityLower)) return addr;
  return `${addr}, ${shop.city}, FL`;
}

// Matches the team's field-report template exactly:
// 店名 / 地址 / 老板（角色）/ 电话 / 店面 / 进货 / 备注
function buildReportText(shop) {
  const contactName = shop.ownerName || shop.staffContact || "";
  const contactLine = contactName
    ? `${contactName}${shop.contactRole ? `（${shop.contactRole}）` : ""}`
    : "未知";
  const remarkParts = [shop.ownerSchedule, shop.trafficNote, shop.brandsNote, shop.nextPlan]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  const remarks = remarkParts.length ? remarkParts.join("，") : "无";
  return [
    `店名：${shop.name}`,
    `地址：${addressLine(shop)}`,
    `老板：${contactLine}`,
    `电话：${shop.phone || "未知"}`,
    `店面：${shop.storeNumber || "未知"}`,
    `进货：${shop.restockStatus || "未知"}`,
    `备注：${remarks}`,
  ].join("\n");
}

function gmapsSearchHref(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function VapeShopTrackerV4() {
  const [shops, setShops] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [fCity, setFCity] = useState("all");
  const [fTier, setFTier] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [logDate, setLogDate] = useState(todayStr());
  const [logUnits, setLogUnits] = useState("");
  const [logNote, setLogNote] = useState("");
  const [reportText, setReportText] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkDefaultCity, setBulkDefaultCity] = useState(CITIES[8]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        let parsed = res && res.value ? JSON.parse(res.value) : null;

        if (!(Array.isArray(parsed) && parsed.length)) {
          // Nothing under the current key — check older versions before giving up
          // and falling back to seed data, so a version bump never looks like data loss.
          for (const legacyKey of LEGACY_KEYS) {
            try {
              const legacyRes = await window.storage.get(legacyKey, false);
              const legacyParsed = legacyRes && legacyRes.value ? JSON.parse(legacyRes.value) : null;
              if (Array.isArray(legacyParsed) && legacyParsed.length) {
                parsed = legacyParsed;
                // migrate forward so future loads don't need to fall back again
                window.storage.set(STORAGE_KEY, JSON.stringify(legacyParsed), false).catch(() => {});
                break;
              }
            } catch (e) { /* this legacy key doesn't exist either, keep checking */ }
          }
        }

        if (!cancelled) {
          setShops(Array.isArray(parsed) && parsed.length ? parsed : SEED_SHOPS);
        }
      } catch (e) {
        if (!cancelled) setShops(SEED_SHOPS);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback((next) => {
    setShops(next);
    window.storage.set(STORAGE_KEY, JSON.stringify(next), false).catch(() => {});
  }, []);

  const updateShop = useCallback((id, patch) => {
    setShops((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      window.storage.set(STORAGE_KEY, JSON.stringify(next), false).catch(() => {});
      return next;
    });
  }, []);

  const deleteShop = useCallback((id) => {
    setShops((prev) => {
      const next = prev.filter((s) => s.id !== id);
      window.storage.set(STORAGE_KEY, JSON.stringify(next), false).catch(() => {});
      return next;
    });
    setSelectedId(null);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shops.filter((s) => {
      if (fCity !== "all" && s.city !== fCity) return false;
      if (fTier !== "all" && s.tier !== fTier) return false;
      if (fStatus !== "all" && s.status !== fStatus) return false;
      if (q && !(
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        (s.staffContact || "").toLowerCase().includes(q) ||
        (s.ownerName || "").toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [shops, search, fCity, fTier, fStatus]);

  function openEdit(shop) {
    setDraft({ ...shop, chainTotalStores: String(shop.chainTotalStores ?? "") });
    setSelectedId(shop.id);
    setLogDate(todayStr()); setLogUnits(""); setLogNote("");
    setReportText(null); setCopied(false);
  }
  function openNew() {
    setDraft(emptyDraft());
    setSelectedId("new");
    setLogDate(todayStr()); setLogUnits(""); setLogNote("");
    setReportText(null); setCopied(false);
  }
  function closePanel() { setSelectedId(null); setDraft(null); setReportText(null); }

  function saveDraft() {
    if (!draft.name.trim()) return;
    const chainTotalStores = draft.chainTotalStores === "" ? "" : parseInt(draft.chainTotalStores, 10);
    const clean = { ...draft, chainTotalStores, name: draft.name.trim() };
    if (selectedId === "new") {
      persist([...shops, { ...clean, id: "shop-" + Date.now() }]);
    } else {
      persist(shops.map((s) => (s.id === selectedId ? { ...s, ...clean } : s)));
    }
    closePanel();
  }

  function addVisitLog() {
    if (!draft || selectedId === "new") return;
    const entry = { date: logDate || todayStr(), units: Number(logUnits) || 0, note: logNote.trim() };
    const nextLog = [...(draft.visitLog || []), entry];
    setDraft({ ...draft, visitLog: nextLog, status: "visited" });
    updateShop(selectedId, { visitLog: nextLog, status: "visited" });
    setLogUnits(""); setLogNote("");
  }
  function removeVisitLog(idx) {
    const nextLog = draft.visitLog.filter((_, i) => i !== idx);
    setDraft({ ...draft, visitLog: nextLog });
    updateShop(selectedId, { visitLog: nextLog });
  }

  function genReport() {
    setReportText(buildReportText(draft));
    setCopied(false);
  }
  function copyReport() {
    if (!reportText) return;
    try { navigator.clipboard.writeText(reportText); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) {}
  }

  function parseBulkText() {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    let next = [...shops];
    lines.forEach((line, i) => {
      // Columns (all optional after name): 店名|地址|城市|电话|老板|员工|老板到店规律|热卖品牌|客流备注|下次计划|状态
      const parts = line.split(/\s*\|\s*/).map((p) => p.trim());
      const [name, address = "", city = "", phone = "", ownerName = "", staffContact = "",
        ownerSchedule = "", brandsNote = "", trafficNote = "", nextPlan = "", status = ""] = parts;
      if (!name) return;
      const validStatus = STATUS_LABEL[status] ? status : "";
      const existingIdx = next.findIndex((s) => s.name.trim().toLowerCase() === name.toLowerCase());
      if (existingIdx >= 0) {
        const cur = next[existingIdx];
        next[existingIdx] = {
          ...cur,
          address: address || cur.address,
          city: city || cur.city,
          phone: phone || cur.phone,
          ownerName: ownerName || cur.ownerName,
          staffContact: staffContact || cur.staffContact,
          ownerSchedule: ownerSchedule || cur.ownerSchedule,
          brandsNote: brandsNote || cur.brandsNote,
          trafficNote: trafficNote || cur.trafficNote,
          nextPlan: nextPlan || cur.nextPlan,
          status: validStatus || cur.status,
        };
      } else {
        next.push(makeShop({
          name, address, city: city || bulkDefaultCity, phone, ownerName, staffContact,
          ownerSchedule, brandsNote, trafficNote, nextPlan,
          status: validStatus || "not_visited",
        }, "bulk-" + Date.now() + "-" + i));
      }
    });
    persist(next);
    setBulkText("");
    setShowBulk(false);
  }

  const gmapsHref = (s) => gmapsSearchHref(`${s.name} ${s.address} ${s.city} FL`);


  if (!loaded) return <div style={{ padding: 32, color: "#5F5E5A", fontFamily: "ui-sans-serif" }}>加载中…</div>;

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system", background: "#F7F4EE", minHeight: 600, padding: "18px 16px 40px", color: "#26215C" }}>
      <style>{`
        .vst-btn { border: 1px solid #B4B2A9; background: #fff; border-radius: 8px; padding: 7px 12px; font-size: 13px; cursor: pointer; color: #2C2C2A; display: inline-flex; align-items: center; gap: 6px; }
        .vst-btn:hover { background: #F1EFE8; }
        .vst-btn.primary { background: #0F2A3D; color: #fff; border-color: #0F2A3D; }
        .vst-btn.primary:hover { background: #163d57; }
        .vst-select, .vst-input, .vst-textarea { border: 1px solid #B4B2A9; border-radius: 8px; padding: 7px 10px; font-size: 13px; background: #fff; color: #2C2C2A; font-family: inherit; width: 100%; box-sizing: border-box; }
        .vst-textarea { min-height: 56px; resize: vertical; }
        .vst-label { font-size: 11px; color: #5F5E5A; margin-bottom: 4px; display: block; font-weight: 500; }
        .vst-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; padding: 3px 9px; border-radius: 999px; font-weight: 500; }
        .vst-row { margin-bottom: 12px; }
        .vst-shop-item { border: 1px solid #E4E1D8; border-radius: 10px; padding: 10px 12px; background: #fff; cursor: pointer; margin-bottom: 8px; }
        .vst-shop-item:hover { border-color: #B4B2A9; }
      `}</style>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>门店拜访清单</h1>
        <span style={{ fontSize: 13, color: "#5F5E5A" }}>Tampa Bay 西岸</span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "#888780" }} />
          <input className="vst-input" style={{ paddingLeft: 30 }} placeholder="搜索店名 / 地址 / 城市 / 联系人" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="vst-btn" onClick={() => setShowFilters((v) => !v)}><Filter size={14} /> 筛选 <ChevronDown size={12} /></button>
        <button className="vst-btn" onClick={() => setShowBulk(true)}><Upload size={14} /> 批量导入</button>
        <button className="vst-btn primary" onClick={openNew}><Plus size={14} /> 添加店铺</button>
      </div>

      {showFilters && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, background: "#fff", border: "1px solid #E4E1D8", borderRadius: 10, padding: 12 }}>
          <div style={{ minWidth: 140 }}>
            <label className="vst-label">城市</label>
            <select className="vst-select" value={fCity} onChange={(e) => setFCity(e.target.value)}>
              <option value="all">全部城市</option>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 120 }}>
            <label className="vst-label">分级</label>
            <select className="vst-select" value={fTier} onChange={(e) => setFTier(e.target.value)}>
              <option value="all">全部分级</option>
              {Object.entries(TIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 140 }}>
            <label className="vst-label">拜访状态</label>
            <select className="vst-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="all">全部状态</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      )}

      <div style={{ fontSize: 11.5, color: "#888780", marginBottom: 8 }}>共 {filtered.length} 家店铺</div>

      {filtered.length === 0 && <div style={{ color: "#888780", fontSize: 13, padding: "20px 4px" }}>没有匹配的店铺，试试调整筛选条件。</div>}
      {filtered.map((s) => <ShopCard key={s.id} shop={s} active={selectedId === s.id} onOpen={() => openEdit(s)} gmapsHref={gmapsHref(s)} />)}

      {showBulk && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,42,61,0.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", zIndex: 50, overflowY: "auto" }} onClick={() => setShowBulk(false)}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: "100%", maxWidth: 480, marginBottom: 40 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>批量导入店铺</h2>
              <button className="vst-btn" style={{ padding: 6, border: "none" }} onClick={() => setShowBulk(false)}><X size={16} /></button>
            </div>
            <p style={{ fontSize: 12.5, color: "#5F5E5A", lineHeight: 1.6, marginTop: 0 }}>
              每行一家店，用竖线 <code>|</code> 分隔，后面的列都可以省略：<br />
              <code>店名 | 地址 | 城市 | 电话 | 老板 | 员工 | 老板到店规律 | 热卖品牌 | 客流备注 | 下次计划 | 状态</code><br />
              状态可填：not_visited / visited / follow_up / no_interest。<br />
              如果店名和已有店铺完全一样（不分大小写），会自动合并更新那家店，不会重复新建。
            </p>
            <div className="vst-row">
              <label className="vst-label">没写城市的默认归到</label>
              <select className="vst-select" value={bulkDefaultCity} onChange={(e) => setBulkDefaultCity(e.target.value)}>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <textarea
              className="vst-textarea"
              style={{ minHeight: 200, fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}
              placeholder={"例如:\nABC Smoke Shop | 123 Main St | Clearwater | (727) 000-0000\nXYZ Vape\nDEF Smoke Shop | 456 Bay Dr"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button className="vst-btn" onClick={() => setShowBulk(false)}>取消</button>
              <button className="vst-btn primary" onClick={parseBulkText}><Upload size={14} /> 导入</button>
            </div>
          </div>
        </div>
      )}

      {draft && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,42,61,0.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", zIndex: 50, overflowY: "auto" }} onClick={closePanel}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: "100%", maxWidth: 480, marginBottom: 40 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{selectedId === "new" ? "添加店铺" : "编辑店铺"}</h2>
              <button className="vst-btn" style={{ padding: 6, border: "none" }} onClick={closePanel} aria-label="关闭"><X size={16} /></button>
            </div>

            <div className="vst-row"><label className="vst-label">店铺名称</label>
              <input className="vst-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>

            <div style={{ display: "flex", gap: 10 }} className="vst-row">
              <div style={{ flex: 2 }}><label className="vst-label">地址</label>
                <input className="vst-input" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder="街道地址，留空则标记为待补充" /></div>
              <div style={{ flex: 1 }}><label className="vst-label">城市</label>
                <select className="vst-select" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })}>
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
            </div>

            <div style={{ display: "flex", gap: 10 }} className="vst-row">
              <div style={{ flex: 1 }}><label className="vst-label">门店分级（手动选择）</label>
                <select className="vst-select" value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value })}>
                  {Object.entries(TIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div style={{ flex: 1 }}><label className="vst-label">拜访状态</label>
                <select className="vst-select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
            </div>

            <div className="vst-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id="isChain" checked={draft.isChain} onChange={(e) => setDraft({ ...draft, isChain: e.target.checked })} />
              <label htmlFor="isChain" style={{ fontSize: 13 }}>属于连锁店</label>
            </div>
            {draft.isChain && (
              <div style={{ display: "flex", gap: 10 }} className="vst-row">
                <div style={{ flex: 1 }}><label className="vst-label">连锁品牌名</label>
                  <input className="vst-input" value={draft.chainName} onChange={(e) => setDraft({ ...draft, chainName: e.target.value })} /></div>
                <div style={{ flex: 1 }}><label className="vst-label">连锁总门店数</label>
                  <input className="vst-input" value={draft.chainTotalStores} onChange={(e) => setDraft({ ...draft, chainTotalStores: e.target.value })} /></div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }} className="vst-row">
              <div style={{ flex: 1 }}><label className="vst-label">店铺电话</label>
                <input className="vst-input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label className="vst-label">员工联系人</label>
                <input className="vst-input" value={draft.staffContact} onChange={(e) => setDraft({ ...draft, staffContact: e.target.value })} placeholder="例如: Brandon" /></div>
            </div>

            <div style={{ display: "flex", gap: 10 }} className="vst-row">
              <div style={{ flex: 1 }}><label className="vst-label">老板姓名</label>
                <input className="vst-input" value={draft.ownerName} onChange={(e) => setDraft({ ...draft, ownerName: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label className="vst-label">老板到店规律</label>
                <input className="vst-input" value={draft.ownerSchedule} onChange={(e) => setDraft({ ...draft, ownerSchedule: e.target.value })} placeholder="例如: 每天5点后在店" /></div>
            </div>

            <div style={{ display: "flex", gap: 10 }} className="vst-row">
              <div style={{ flex: 1 }}><label className="vst-label">联系人身份（播报里显示在括号里）</label>
                <input className="vst-input" value={draft.contactRole} onChange={(e) => setDraft({ ...draft, contactRole: e.target.value })} placeholder="例如: 店员 / 经理" /></div>
              <div style={{ flex: 1 }}><label className="vst-label">店面（编号）</label>
                <input className="vst-input" value={draft.storeNumber} onChange={(e) => setDraft({ ...draft, storeNumber: e.target.value })} placeholder="例如: 16" /></div>
            </div>

            <div className="vst-row"><label className="vst-label">进货</label>
              <input className="vst-input" value={draft.restockStatus} onChange={(e) => setDraft({ ...draft, restockStatus: e.target.value })} placeholder="例如: 已下单 / 未知" />
            </div>

            <div className="vst-row"><label className="vst-label">热卖品牌明细</label>
              <textarea className="vst-textarea" value={draft.brandsNote} onChange={(e) => setDraft({ ...draft, brandsNote: e.target.value })} placeholder={"例如:\ngeekbar 25K $35\nnorth 5K $19.99"} />
            </div>

            <div className="vst-row"><label className="vst-label">客流 / 位置备注</label>
              <input className="vst-input" value={draft.trafficNote} onChange={(e) => setDraft({ ...draft, trafficNote: e.target.value })} />
            </div>

            <div className="vst-row"><label className="vst-label">下次拜访计划</label>
              <input className="vst-input" value={draft.nextPlan} onChange={(e) => setDraft({ ...draft, nextPlan: e.target.value })} />
            </div>

            <div className="vst-row"><label className="vst-label">来源链接（可选）</label>
              <input className="vst-input" value={draft.sourceUrl} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} placeholder="粘贴谷歌地图/Yelp链接方便日后核对" />
            </div>

            {selectedId !== "new" && (
              <div style={{ border: "1px solid #E4E1D8", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <label className="vst-label">拜访日志</label>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  <input className="vst-input" type="date" style={{ flex: "1 1 120px" }} value={logDate} onChange={(e) => setLogDate(e.target.value)} />
                  <input className="vst-input" style={{ flex: "0 1 90px" }} placeholder="进店支数" value={logUnits} onChange={(e) => setLogUnits(e.target.value)} />
                  <input className="vst-input" style={{ flex: "2 1 140px" }} placeholder="备注" value={logNote} onChange={(e) => setLogNote(e.target.value)} />
                  <button className="vst-btn" onClick={addVisitLog}><Plus size={13} /> 记录</button>
                </div>
                {(draft.visitLog || []).length === 0 && <div style={{ fontSize: 12, color: "#888780" }}>还没有拜访记录</div>}
                {(draft.visitLog || []).slice().reverse().map((v, i) => {
                  const realIdx = draft.visitLog.length - 1 - i;
                  return (
                    <div key={realIdx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0", borderTop: "1px solid #F1EFE8" }}>
                      <span>{v.date} · {v.units}支 {v.note && `· ${v.note}`}</span>
                      <button className="vst-btn" style={{ padding: "2px 6px", border: "none" }} onClick={() => removeVisitLog(realIdx)} aria-label="删除记录"><X size={12} /></button>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedId !== "new" && (
              <div style={{ marginBottom: 12 }}>
                <button className="vst-btn" onClick={genReport}><Clipboard size={13} /> 生成拜访播报文本</button>
                {reportText && (
                  <div style={{ marginTop: 8 }}>
                    <textarea className="vst-textarea" style={{ minHeight: 100 }} readOnly value={reportText} />
                    <button className="vst-btn" style={{ marginTop: 6 }} onClick={copyReport}><Copy size={13} /> {copied ? "已复制" : "复制到剪贴板"}</button>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              {selectedId !== "new" ? (
                <button className="vst-btn" style={{ color: "#A32D2D", borderColor: "#F0997B" }} onClick={() => deleteShop(selectedId)}><Trash2 size={14} /> 删除</button>
              ) : <span />}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="vst-btn" onClick={closePanel}>取消</button>
                <button className="vst-btn primary" onClick={saveDraft}><Check size={14} /> 保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShopCard({ shop, active, onOpen, gmapsHref }) {
  const totalUnits = (shop.visitLog || []).reduce((a, v) => a + (Number(v.units) || 0), 0);
  const needsAddress = !shop.address;
  return (
    <div className="vst-shop-item" style={{ borderColor: active ? "#0F2A3D" : undefined }} onClick={onOpen}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "#2C2C2A" }}>{shop.name}</div>
          <div style={{ fontSize: 11.5, color: needsAddress ? "#BA7517" : "#888780", marginTop: 2 }}>
            {shop.city}{shop.address ? ` · ${shop.address}` : " · 地址待补充"}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
          {shop.tier && <span className="vst-chip" style={{ background: TIER_COLOR[shop.tier] + "22", color: TIER_COLOR[shop.tier] }}>{TIER_LABEL[shop.tier]}</span>}
          <span className="vst-chip" style={{ background: STATUS_COLOR[shop.status] + "22", color: STATUS_COLOR[shop.status] }}>{STATUS_LABEL[shop.status]}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
        {shop.isChain && <span className="vst-chip" style={{ background: "#F1EFE8", color: "#5F5E5A" }}>连锁: {shop.chainName || "未命名"}{shop.chainTotalStores ? ` (${shop.chainTotalStores}店)` : ""}</span>}
        {shop.staffContact && <span className="vst-chip" style={{ background: "#F1EFE8", color: "#5F5E5A" }}><User size={10} />{shop.staffContact}</span>}
        {shop.ownerName && <span className="vst-chip" style={{ background: "#F1EFE8", color: "#5F5E5A" }}>老板 {shop.ownerName}</span>}
        {shop.phone && <span className="vst-chip" style={{ background: "#F1EFE8", color: "#5F5E5A" }}><Phone size={10} />{shop.phone}</span>}
        {totalUnits > 0 && <span className="vst-chip" style={{ background: "#F1EFE8", color: "#5F5E5A" }}>累计进店 {totalUnits} 支</span>}
      </div>
      {shop.brandsNote && <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-line" }}>{shop.brandsNote}</div>}
      {shop.nextPlan && <div style={{ fontSize: 12, color: "#BA7517", marginTop: 4 }}>下次: {shop.nextPlan}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
        {shop.address && <a className="vst-btn" style={{ padding: "4px 9px", fontSize: 12, textDecoration: "none" }} href={gmapsHref} target="_blank" rel="noreferrer"><ExternalLink size={12} /> 谷歌地图打开</a>}
        {shop.sourceUrl && <a className="vst-btn" style={{ padding: "4px 9px", fontSize: 12, textDecoration: "none" }} href={shop.sourceUrl} target="_blank" rel="noreferrer"><Link2 size={12} /> 来源</a>}
      </div>
    </div>
  );
}
