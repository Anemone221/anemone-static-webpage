// Live status for EVE Online (Statuspage + ESI) and zKillboard.
// All three APIs send `Access-Control-Allow-Origin: *`, so this runs entirely
// in the browser — no server needed.

(() => {
  "use strict";

  const SOURCES = {
    eve: "https://status.eveonline.com/api/v2/summary.json",
    tq: "https://esi.evetech.net/latest/status/",
    zkill: "https://zkillboard.com/api/kills/",
  };

  const REFRESH_MS = 3 * 60 * 1000;    // auto-refresh interval
  const TIMEOUT_MS = 15 * 1000;        // per-request timeout
  const ZKILL_STALE_MIN = 30;          // no new killmail for this long = stale feed

  const updatedEl = document.getElementById("updated");
  const refreshBtn = document.getElementById("refresh");
  let lastRefresh = 0;

  // ── helpers ──────────────────────────────────────────────

  const card = (id) => document.getElementById(id);
  const field = (cardEl, name) => cardEl.querySelector(`[data-field="${name}"]`);
  const setDot = (cardEl, state) => cardEl.querySelector(".dot").dataset.state = state;

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "dataset") Object.assign(node.dataset, v);
      else node[k] = v;
    }
    for (const c of children) node.append(c);
    return node;
  }

  async function getJSON(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function ago(date) {
    const s = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h}h ${m % 60}m ago`;
    return `${Math.floor(h / 24)} days ago`;
  }

  const utc = (date) =>
    date.toLocaleString(undefined, {
      timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    }) + " UTC";

  function isk(n) {
    const units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
    for (const [v, u] of units) if (n >= v) return `${(n / v).toFixed(1)}${u} ISK`;
    return `${Math.round(n)} ISK`;
  }

  // Statuspage component status → our dot state + label
  const COMPONENT = {
    operational:          ["ok",    "Operational"],
    degraded_performance: ["warn",  "Degraded"],
    partial_outage:       ["warn",  "Partial outage"],
    major_outage:         ["bad",   "Major outage"],
    under_maintenance:    ["maint", "Maintenance"],
  };
  const INDICATOR = { none: "ok", minor: "warn", major: "bad", critical: "bad", maintenance: "maint" };

  // ── EVE Online status page ───────────────────────────────

  async function loadEve() {
    const c = card("card-eve");
    try {
      const d = await getJSON(SOURCES.eve);
      setDot(c, INDICATOR[d.status.indicator] ?? "warn");
      field(c, "headline").textContent = d.status.description;

      // Components: top-level ones in order; groups get a header with their children.
      const list = field(c, "components");
      const byId = new Map(d.components.map((x) => [x.id, x]));
      const rows = [];
      const compRow = (x, cls = "") => {
        const [state, label] = COMPONENT[x.status] ?? ["warn", x.status];
        return el("li", { className: cls }, el("span", { textContent: x.name }),
          el("span", { className: "comp-status", textContent: label, dataset: { state } }));
      };
      d.components
        .filter((x) => !x.group_id)
        .sort((a, b) => a.position - b.position)
        .forEach((x) => {
          if (x.group) {
            rows.push(el("li", { className: "group", textContent: x.name }));
            (x.components ?? [])
              .map((id) => byId.get(id))
              .filter(Boolean)
              .sort((a, b) => a.position - b.position)
              .forEach((child) => rows.push(compRow(child, "child")));
          } else {
            rows.push(compRow(x));
          }
        });
      list.replaceChildren(...rows);

      // Active incidents and upcoming/in-progress maintenance.
      const notices = [
        ...d.incidents.map((i) => ({ i, maint: false, when: `${i.status.replace(/_/g, " ")} · updated ${ago(new Date(i.updated_at))}` })),
        ...d.scheduled_maintenances.map((i) => ({ i, maint: true, when: `${i.status.replace(/_/g, " ")} · ${utc(new Date(i.scheduled_for))}` })),
      ].map(({ i, maint, when }) =>
        el("div", { className: maint ? "notice maint" : "notice" },
          el("a", { href: i.shortlink || "https://status.eveonline.com/", target: "_blank", rel: "noopener", textContent: i.name }),
          el("span", { className: "when", textContent: when })));
      field(c, "notices").replaceChildren(...notices);
    } catch (err) {
      setDot(c, "bad");
      field(c, "headline").textContent = "Couldn't reach status.eveonline.com";
      field(c, "components").replaceChildren();
      field(c, "notices").replaceChildren();
    }
  }

  // ── Tranquility (ESI /status) ────────────────────────────

  async function loadTq() {
    const c = card("card-tq");
    try {
      const d = await getJSON(SOURCES.tq);
      const start = new Date(d.start_time);
      if (d.vip) {
        setDot(c, "warn");
        field(c, "headline").textContent = "Online (VIP mode, restricted access)";
      } else {
        setDot(c, "ok");
        field(c, "headline").textContent = "Online";
      }
      field(c, "players").textContent = d.players.toLocaleString();
      field(c, "uptime").textContent = utc(start);
      field(c, "uptime").title = ago(start);
      field(c, "version").textContent = d.server_version;
    } catch (err) {
      // ESI returns 503 while TQ is down (e.g. daily downtime at 11:00 UTC).
      setDot(c, "bad");
      field(c, "headline").textContent = "Offline or unreachable";
      for (const f of ["players", "uptime", "version"]) field(c, f).textContent = "—";
    }
  }

  // ── zKillboard ───────────────────────────────────────────

  async function loadZkill() {
    const c = card("card-zkill");
    try {
      const kills = await getJSON(SOURCES.zkill);
      if (!Array.isArray(kills) || kills.length === 0) throw new Error("empty feed");

      const newest = new Date(Math.max(...kills.map((k) => Date.parse(k.killmail_time))));
      const ageMin = (Date.now() - newest.getTime()) / 60000;
      const total = kills.reduce((sum, k) => sum + (k.zkb?.totalValue ?? 0), 0);

      if (ageMin > ZKILL_STALE_MIN) {
        setDot(c, "warn");
        field(c, "headline").textContent = "Online, but the killmail feed is stale";
      } else {
        setDot(c, "ok");
        field(c, "headline").textContent = "Online";
      }
      field(c, "latest").textContent = ago(newest);
      field(c, "latest").title = utc(newest);
      field(c, "count").textContent = kills.length.toLocaleString();
      field(c, "isk").textContent = isk(total);
    } catch (err) {
      setDot(c, "bad");
      field(c, "headline").textContent = "Couldn't reach zKillboard";
      for (const f of ["latest", "count", "isk"]) field(c, f).textContent = "—";
    }
  }

  // ── refresh loop ─────────────────────────────────────────

  async function refreshAll() {
    refreshBtn.disabled = true;
    updatedEl.textContent = "Checking…";
    await Promise.allSettled([loadEve(), loadTq(), loadZkill()]);
    lastRefresh = Date.now();
    updatedEl.textContent = `Updated ${new Date(lastRefresh).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    refreshBtn.disabled = false;
  }

  refreshBtn.addEventListener("click", refreshAll);

  // Poll only while the tab is visible; catch up immediately when it comes back.
  setInterval(() => { if (!document.hidden) refreshAll(); }, REFRESH_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - lastRefresh > REFRESH_MS) refreshAll();
  });

  refreshAll();
})();
