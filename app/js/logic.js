/* PAGUU · cálculos, cadena Verifactu local y estado del piloto. */
(function (root) {
  'use strict';

  const SH_K = [], SH_H = [];
  (function () {
    let n = 2;
    while (SH_K.length < 64) {
      let p = true;
      for (let i = 2; i * i <= n; i++) if (n % i === 0) { p = false; break; }
      if (p) {
        if (SH_H.length < 8) SH_H.push(Math.floor((Math.sqrt(n) % 1) * 4294967296));
        SH_K.push(Math.floor((Math.cbrt(n) % 1) * 4294967296));
      }
      n++;
    }
  })();
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  function sha256(msg) {
    const s = unescape(encodeURIComponent(msg));
    const b = [];
    for (let i = 0; i < s.length; i++) b.push(s.charCodeAt(i));
    const l = b.length * 8;
    b.push(0x80);
    while (b.length % 64 !== 56) b.push(0);
    const hi = Math.floor(l / 4294967296), lo = l >>> 0;
    for (const v of [hi, lo]) b.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
    let h = SH_H.slice();
    for (let o = 0; o < b.length; o += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) w[i] = ((b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3]) >>> 0;
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, bb, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + SH_K[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & bb) ^ (a & c) ^ (bb & c);
        const t2 = (S0 + mj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
      }
      h = [h[0] + a, h[1] + bb, h[2] + c, h[3] + d, h[4] + e, h[5] + f, h[6] + g, h[7] + hh].map(x => x >>> 0);
    }
    return h.map(x => x.toString(16).padStart(8, '0')).join('');
  }

  const ZERO = '0'.repeat(64);
  const eur = c => {
    const neg = c < 0;
    c = Math.abs(Math.round(c));
    const e = Math.floor(c / 100);
    const d = String(c % 100).padStart(2, '0');
    return (neg ? '-' : '') + String(e).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d + ' €';
  };
  const eurPlain = c => eur(c).replace(' €', '');
  const fd = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; };
  const qtyText = m => {
    const neg = m < 0; m = Math.abs(m);
    const w = Math.floor(m / 1000), f = String(m % 1000).padStart(3, '0').replace(/0+$/, '');
    return (neg ? '-' : '') + String(w).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (f ? ',' + f : '');
  };
  function parseEur(s) {
    let t = String(s == null ? '' : s).trim().replace(/€/g, '').replace(/\s/g, '');
    if (!t) return null;
    if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
    else if (t.includes(',')) t = t.replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
    return Math.round(parseFloat(t) * 100);
  }
  function parseQty(s) {
    let t = String(s == null ? '' : s).trim().replace(/\s/g, '');
    if (!t) return null;
    if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
    else if (t.includes(',')) t = t.replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(t)) return null;
    return Math.round(parseFloat(t) * 1000);
  }
  function lineAmounts(line) {
    const base = Math.round(line.qtyMilli * line.price / 1000);
    const igic = Math.round(base * (Number(line.rate) || 0) / 100);
    return { base, igic, total: base + igic };
  }
  function totals(doc) {
    return (doc.lines || []).reduce((s, ln) => {
      const a = lineAmounts(ln);
      s.base += a.base; s.igic += a.igic; s.total += a.total;
      return s;
    }, { base: 0, igic: 0, total: 0 });
  }
  function canon(rec) {
    let s = ['PAGUU', '1', rec.prev, rec.nif, rec.num, rec.date, rec.base, rec.igic, rec.total, rec.tipo].join('|');
    if (rec.tipo === 'Anulacion') s += '|' + (rec.motivo || '');
    return s;
  }
  function uid(state, p) {
    state.seq = state.seq || 1;
    return p + (state.seq++);
  }
  function addr(p) {
    if (!p) return '';
    const d = String(p.address || '').replace(/,\s*$/, '');
    return [d, [p.cp, p.city].filter(Boolean).join(' '), p.province, p.country].filter(Boolean).join(', ');
  }
  function byId(list, id) { return (list || []).find(x => x.id === id) || null; }
  function daysBetween(a, b) {
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    const da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
    const db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
    return Math.round((db - da) / 86400000);
  }
  function monthEnd(ym) {
    const [y, m] = ym.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return ym + '-' + String(last).padStart(2, '0');
  }
  function signPayload(doc, sig) {
    const t = totals(doc);
    return sha256([doc.num, doc.date, t.total, sig.name, sig.ts, (sig.paths || []).join('|')].join('§'));
  }

function ensureStock(state, lines) {
  const need = {};
  for (const ln of lines) if (ln.pid) need[ln.pid] = (need[ln.pid] || 0) + ln.qtyMilli;
  for (const pid of Object.keys(need)) {
    const have = state.lots.filter(l => l.pid === pid).reduce((s, l) => s + l.left, 0);
    if (have < need[pid]) {
      const p = byId(state.products, pid);
      throw new Error('Stock insuficiente de ' + (p ? p.name : pid) + ': hay ' + qtyText(have) + ' y se piden ' + qtyText(need[pid]));
    }
  }
}
function consume(state, pid, qtyMilli, ref, date) {
  if (!pid || !qtyMilli) return;
  const lots = state.lots.filter(l => l.pid === pid && l.left > 0);
    const have = lots.reduce((s, l) => s + l.left, 0);
    if (have < qtyMilli) {
      const p = byId(state.products, pid);
      throw new Error('Stock insuficiente de ' + (p ? p.name : pid) + ': hay ' + qtyText(have) + ' y se piden ' + qtyText(qtyMilli));
    }
    let left = qtyMilli;
    for (const lot of lots) {
      if (left <= 0) break;
      const take = Math.min(lot.left, left);
      lot.left -= take;
      left -= take;
      state.moves.push({ id: uid(state, 'm'), pid, qtyMilli: take, type: 'salida', lot: lot.lot, origin: lot.origin, ref, date });
    }
  }

  function appendAlta(state, inv) {
    const t = totals(inv);
    const prev = state.chain.length ? state.chain[state.chain.length - 1].hash : ZERO;
    const rec = {
      id: uid(state, 'ch'), invoiceId: inv.id, num: inv.num, date: inv.date, tipo: 'Alta',
      nif: state.company.nif, base: t.base, igic: t.igic, total: t.total, prev, motivo: '', aeat: 'no-enviado'
    };
    rec.hash = sha256(canon(rec));
    state.chain.push(rec);
    inv.huella = rec.hash;
    inv.huellaPrev = prev;
    state.log.push({ id: uid(state, 'lg'), date: inv.date, n: inv.n || 0, text: 'Factura emitida', ref: inv.id });
  }

  function stampSignatures(state) {
    for (const a of state.albaranes) {
      if (a.signed && !a.signed.hash) a.signed.hash = signPayload(a, a.signed);
    }
    for (const inv of state.invoices) {
      if (inv.signed && !inv.signed.hash) inv.signed.hash = signPayload(inv, inv.signed);
    }
  }

  function prepare(seed) {
    const state = (typeof structuredClone === 'function') ? structuredClone(seed) : JSON.parse(JSON.stringify(seed));
    state.seq = 1;
    state.chain = [];
    state.log = [];
    state.bank = [];
    state.moves = [];
    state.remesas = [];
    state.counts = {};
    state.nextFac = 1;
    state.nextAlb = 1;
    state.nextRec = 1;
    state.invoices.sort((a, b) => a.n - b.n);
    for (const inv of state.invoices) appendAlta(state, inv);
    state.nextFac = state.invoices.reduce((m, i) => Math.max(m, i.n), 0) + 1;
    for (const inv of state.invoices) {
      if (inv.status !== 'cobrada') continue;
      const t = totals(inv);
      state.bank.push({
        id: uid(state, 'b'), date: inv.date, concept: 'Cobro ' + inv.num + ' · ' + (byId(state.clients, inv.clientId) || {}).name,
        amount: t.total, invoiceId: inv.id, receivedId: null, origin: 'importado'
      });
      state.log.push({ id: uid(state, 'lg'), date: inv.date, n: inv.n, text: 'Cobro casado con el banco', ref: inv.id });
    }
    for (const rec of state.received || []) {
      if (rec.status !== 'pagada') continue;
      const t = totals(rec);
      const sup = byId(state.suppliers, rec.supplierId);
      state.bank.push({
        id: uid(state, 'b'), date: rec.date, concept: 'Pago ' + rec.num + ' · ' + (sup ? sup.name : ''),
        amount: -t.total, invoiceId: null, receivedId: rec.id, origin: 'importado'
      });
    }
    state.nextRec = (state.received || []).reduce((m, r) => Math.max(m, r.n || 0), 0) + 1;
    state.albaranes.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.n - b.n);
    for (const a of state.albaranes) {
      for (const ln of a.lines) if (ln.pid) consume(state, ln.pid, ln.qtyMilli, a.num, a.date);
    }
    state.nextAlb = state.albaranes.reduce((m, a) => Math.max(m, a.n), 0) + 1;
    for (const extra of seed.bankExtra || []) {
      state.bank.push({ id: uid(state, 'b'), date: extra.date, concept: extra.concept, amount: extra.amount, invoiceId: null, receivedId: null, origin: 'simulado' });
    }
    const plat = state.products.find(p => p.id === 'platano');
    if (plat) {
      const left = state.lots.filter(l => l.pid === 'platano').reduce((s, l) => s + l.left, 0);
      state.counts.platano = Math.max(0, left - 3000);
    }
    stampSignatures(state);
    state.bank.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
    return state;
  }

  function verifyChain(state) {
    let prev = ZERO;
    for (const rec of state.chain) {
      if (rec.prev !== prev) return { ok: false, id: rec.id, reason: 'eslabón anterior' };
      if (sha256(canon(rec)) !== rec.hash) return { ok: false, id: rec.id, reason: 'huella' };
      prev = rec.hash;
    }
    return { ok: true, count: state.chain.length, head: prev === ZERO ? '' : prev };
  }

  function kpis(state) {
    let cobrar = 0, pagar = 0;
    for (const inv of state.invoices) if (inv.status === 'emitida') cobrar += totals(inv).total;
    for (const rec of state.received || []) if (rec.status === 'emitida' || rec.status === 'pendiente') pagar += totals(rec).total;
    return { cobrar, pagar, neta: cobrar - pagar, next: state.company.serie + state.nextFac };
  }

  function lineCost(ln) { return ln.cost == null ? null : ln.cost; }

  function docCost(doc) {
    let known = 0, missing = 0, cost = 0;
    for (const ln of doc.lines || []) {
      if (ln.cost == null) missing++;
      else { known++; cost += ln.cost; }
    }
    return { known, missing, cost, none: known === 0 };
  }

  function beneficios(state, from, to) {
    const invs = state.invoices.filter(i => i.status !== 'anulada' && i.date >= from && i.date <= to);
    let base = 0, cost = 0, known = 0, missing = 0;
    const perInv = [];
    for (const inv of invs) {
      const t = totals(inv);
      const c = docCost(inv);
      base += t.base; cost += c.cost; known += c.known; missing += c.missing;
      perInv.push({ inv, t, c });
    }
    const none = known === 0;
    const full = missing === 0 && known > 0;
    const profit = none ? null : base - cost;
    const margin = full && base ? (profit / base) * 100 : null;
    const byClient = new Map();
    for (const row of perInv) {
      const id = row.inv.clientId;
      if (!byClient.has(id)) byClient.set(id, { clientId: id, n: 0, base: 0, cost: 0, known: 0, missing: 0 });
      const g = byClient.get(id);
      g.n++; g.base += row.t.base; g.cost += row.c.cost; g.known += row.c.known; g.missing += row.c.missing;
    }
    return { base, cost, known, missing, none, full, profit, margin, perInv, byClient: [...byClient.values()] };
  }

  function relacion(state, ym, clientId) {
    const from = ym + '-01', to = monthEnd(ym);
    const invs = state.invoices.filter(i => i.clientId === clientId && i.date >= from && i.date <= to)
      .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.n - b.n);
    let base = 0, igic = 0, total = 0, pendiente = 0;
    for (const inv of invs) {
      if (inv.status === 'anulada') continue;
      const t = totals(inv);
      base += t.base; igic += t.igic; total += t.total;
      if (inv.status === 'emitida') pendiente += t.total;
    }
    let saldo = 0;
    for (const inv of state.invoices) {
      if (inv.clientId === clientId && inv.status === 'emitida' && inv.date <= to) saldo += totals(inv).total;
    }
    return { from, to, invs, base, igic, total, pendiente, saldo };
  }

  function aging(state, today) {
    const rows = new Map();
    for (const inv of state.invoices) {
      if (inv.status !== 'emitida') continue;
      const t = totals(inv).total;
      const age = daysBetween(inv.date, today);
      if (!rows.has(inv.clientId)) rows.set(inv.clientId, { clientId: inv.clientId, total: 0, b0: 0, b30: 0, b60: 0, b90: 0, n: 0 });
      const r = rows.get(inv.clientId);
      r.total += t; r.n++;
      if (age <= 30) r.b0 += t;
      else if (age <= 60) r.b30 += t;
      else if (age <= 90) r.b60 += t;
      else r.b90 += t;
    }
    return [...rows.values()].sort((a, b) => b.total - a.total);
  }

  function igicPeriod(state, from, to) {
    let rep = 0, sop = 0, baseV = 0, baseC = 0;
    for (const inv of state.invoices) {
      if (inv.status === 'anulada' || inv.date < from || inv.date > to) continue;
      const t = totals(inv); rep += t.igic; baseV += t.base;
    }
    for (const rec of state.received || []) {
      if (rec.status === 'anulada' || rec.date < from || rec.date > to) continue;
      const t = totals(rec); sop += t.igic; baseC += t.base;
    }
    return { rep, sop, cuota: rep - sop, baseV, baseC };
  }

  function trial(state) {
    const acc = {};
    const add = (code, name, debe, haber) => {
      if (!acc[code]) acc[code] = { code, name, debe: 0, haber: 0 };
      acc[code].debe += debe; acc[code].haber += haber;
    };
    for (const inv of state.invoices) {
      if (inv.status === 'anulada') continue;
      const t = totals(inv);
      let v700 = 0, v705 = 0;
      for (const ln of inv.lines) {
        const a = lineAmounts(ln);
        if ((Number(ln.rate) || 0) > 0) v705 += a.base; else v700 += a.base;
      }
      add('430', 'Clientes', t.total, 0);
      if (v700) add('700', 'Ventas de mercaderías', 0, v700);
      if (v705) add('705', 'Prestaciones de servicios', 0, v705);
      if (t.igic) add('477', 'HP IGIC repercutido', 0, t.igic);
      if (inv.status === 'cobrada') {
        add('572', 'Bancos c/c', t.total, 0);
        add('430', 'Clientes', 0, t.total);
      }
    }
    for (const rec of state.received || []) {
      if (rec.status === 'anulada') continue;
      const t = totals(rec);
      add('600', 'Compras', t.base, 0);
      if (t.igic) add('472', 'HP IGIC soportado', t.igic, 0);
      add('400', 'Proveedores', 0, t.total);
      if (rec.status === 'pagada') {
        add('400', 'Proveedores', t.total, 0);
        add('572', 'Bancos c/c', 0, t.total);
      }
    }
    const list = Object.values(acc).filter(a => a.debe || a.haber).sort((a, b) => a.code < b.code ? -1 : 1);
    let debe = 0, haber = 0;
    for (const a of list) {
      const net = a.debe - a.haber;
      a.saldoDebe = net > 0 ? net : 0;
      a.saldoHaber = net < 0 ? -net : 0;
      debe += a.saldoDebe; haber += a.saldoHaber;
    }
    return { list, debe, haber };
  }

  function cuadre(state) {
    return state.products.map(p => {
      const lots = state.lots.filter(l => l.pid === p.id);
      const entradas = lots.reduce((s, l) => s + l.qty, 0);
      const left = lots.reduce((s, l) => s + l.left, 0);
      const counted = Object.prototype.hasOwnProperty.call(state.counts, p.id) && state.counts[p.id] != null ? state.counts[p.id] : null;
      const value = lots.reduce((s, l) => s + Math.round(l.left * l.cost / 1000), 0);
      return { p, entradas, salidas: entradas - left, left, counted, diff: counted == null ? null : counted - left, value, lots };
    });
  }

  function qrPayload(state, inv) {
    const t = totals(inv);
    const importe = (t.total / 100).toFixed(2);
    const fecha = fd(inv.date).replaceAll('/', '-');
    const nif = state.company.nif;
    return 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=' + encodeURIComponent(nif)
      + '&numserie=' + encodeURIComponent(inv.num)
      + '&fecha=' + fecha
      + '&importe=' + importe;
  }

  function matchBank(state, bankId, invoiceId) {
    const b = byId(state.bank, bankId);
    const inv = byId(state.invoices, invoiceId);
    if (!b || !inv) throw new Error('No se encuentra el movimiento o la factura');
    if (b.invoiceId || b.receivedId) throw new Error('Ese movimiento ya está casado');
    if (b.amount <= 0) throw new Error('Ese movimiento no es un ingreso');
    if (inv.status === 'anulada') throw new Error('La factura está anulada');
    if (inv.status === 'cobrada') throw new Error('La factura ya está cobrada');
    const t = totals(inv);
    if (b.amount !== t.total) throw new Error('El importe del banco (' + eur(b.amount) + ') no coincide con el total de la factura (' + eur(t.total) + '). No se marca como cobrada.');
    b.invoiceId = inv.id;
    inv.status = 'cobrada';
    state.log.push({ id: uid(state, 'lg'), date: b.date, n: inv.n, text: 'Cobro casado con el banco', ref: inv.id });
  }

  function unmatchBank(state, bankId) {
    const b = byId(state.bank, bankId);
    if (!b || !b.invoiceId) throw new Error('El movimiento no está casado con una factura');
    const inv = byId(state.invoices, b.invoiceId);
    b.invoiceId = null;
    if (inv && inv.status === 'cobrada') inv.status = 'emitida';
    state.log.push({ id: uid(state, 'lg'), date: b.date, n: inv ? inv.n : 0, text: 'Casación de cobro deshecha', ref: inv ? inv.id : '' });
  }

  function anular(state, invoiceId, motivo, date) {
    const text = String(motivo || '').trim();
    if (text.length < 3) throw new Error('Indica el motivo de la anulación');
    const inv = byId(state.invoices, invoiceId);
    if (!inv) throw new Error('Factura no encontrada');
    if (inv.status === 'anulada') throw new Error('La factura ya está anulada');
    if (inv.status === 'cobrada') throw new Error('No se puede anular: ya tiene un cobro casado con el banco');
    const t = totals(inv);
    const prev = state.chain.length ? state.chain[state.chain.length - 1].hash : ZERO;
    const rec = {
      id: uid(state, 'ch'), invoiceId: inv.id, num: inv.num, date, tipo: 'Anulacion',
      nif: state.company.nif, base: t.base, igic: t.igic, total: t.total, prev, motivo: text, aeat: 'no-enviado'
    };
    rec.hash = sha256(canon(rec));
    state.chain.push(rec);
    inv.status = 'anulada';
    inv.anulacion = { motivo: text, date, huella: rec.hash };
    state.log.push({ id: uid(state, 'lg'), date, n: inv.n, text: 'Factura anulada', ref: inv.id });
  }

  function emitirFactura(state, draft) {
    if (!draft.clientId) throw new Error('Elige un cliente');
    if (!draft.date) throw new Error('Indica la fecha');
const lines = normalizeLines(draft.lines);
  const move = draft.moveStock !== false;
  if (move) ensureStock(state, lines);
  const n = state.nextFac++;
  const inv = {
    id: uid(state, 'f'), n, num: state.company.serie + n, date: draft.date, clientId: draft.clientId,
    lines, status: 'emitida', source: draft.source || 'app', groups: draft.groups || [], signed: null, anulacion: null
  };
  if (move) for (const ln of lines) if (ln.pid) consume(state, ln.pid, ln.qtyMilli, inv.num, inv.date);
  state.invoices.push(inv);
    appendAlta(state, inv);
    return inv;
  }

  function normalizeLines(lines) {
    const out = [];
    for (const ln of lines || []) {
      const qtyMilli = typeof ln.qtyMilli === 'number' ? ln.qtyMilli : parseQty(ln.qty);
      const price = typeof ln.price === 'number' && ln.qty == null ? ln.price : parseEur(ln.price);
      const desc = String(ln.desc || '').trim();
      if (!desc && (qtyMilli == null || qtyMilli === 0) && (price == null || price === 0)) continue;
      if (!desc) throw new Error('Falta la descripción de una línea');
      if (qtyMilli == null || qtyMilli <= 0) throw new Error('Cantidad no válida en «' + desc + '»');
      if (price == null || price < 0) throw new Error('Precio no válido en «' + desc + '»');
      const rate = Number(ln.rate) || 0;
      if (rate !== 0 && rate !== 7) throw new Error('IGIC solo admite 0 % (fruta/verdura o exento) o 7 % (servicios) en este piloto');
      out.push({
        desc, qtyMilli, price, rate,
        lot: String(ln.lot || '').trim(),
        origin: String(ln.origin || '').trim(),
        note: String(ln.note || (rate === 7 ? 'Servicios 7 %' : 'Fruta y verdura · IGIC 0 %')).trim(),
        cost: ln.cost == null || ln.cost === '' ? null : ln.cost,
        pid: ln.pid || null
      });
    }
    if (!out.length) throw new Error('Añade al menos una línea');
    return out;
  }

  function crearAlbaran(state, draft) {
    if (!draft.clientId) throw new Error('Elige un cliente');
const lines = normalizeLines(draft.lines);
  ensureStock(state, lines);
  const n = state.nextAlb++;
  const doc = {
      id: uid(state, 'a'), n, num: state.company.albSerie + n, date: draft.date, clientId: draft.clientId,
      lines, signed: null, invoicedIn: null
    };
    for (const ln of lines) if (ln.pid) consume(state, ln.pid, ln.qtyMilli, doc.num, doc.date);
    state.albaranes.push(doc);
    state.log.push({ id: uid(state, 'lg'), date: doc.date, n: doc.n, text: 'Albarán creado', ref: doc.id });
    return doc;
  }

  function facturarAlbaranes(state, ids, date) {
    const albs = ids.map(id => byId(state.albaranes, id));
    if (!albs.length || albs.some(a => !a)) throw new Error('Elige albaranes');
    const cid = albs[0].clientId;
    for (const a of albs) {
      if (a.clientId !== cid) throw new Error('Los albaranes deben ser del mismo cliente');
      if (!a.signed) throw new Error('El albarán ' + a.num + ' no está firmado');
      if (a.invoicedIn) throw new Error('El albarán ' + a.num + ' ya está facturado');
    }
    const lines = [];
    for (const a of albs) {
      for (const ln of a.lines) {
        lines.push(Object.assign({}, ln, { note: (ln.note ? ln.note + ' · ' : '') + a.num }));
      }
    }
    const inv = emitirFactura(state, { clientId: cid, date, lines, source: 'albaranes', groups: albs.map(a => a.id), moveStock: false });
    for (const a of albs) a.invoicedIn = inv.id;
    state.log.push({ id: uid(state, 'lg'), date, n: inv.n, text: 'Factura de fin de mes (' + albs.length + ' albaranes)', ref: inv.id });
    return inv;
  }

  function signDoc(doc, sig) {
    if (doc.signed) throw new Error('El documento ya está firmado');
    const name = String(sig.name || '').trim();
    if (name.length < 2) throw new Error('Escribe el nombre de quien firma');
    if (!sig.paths || !sig.paths.length) throw new Error('Falta la firma manuscrita');
    const stored = { name, ts: sig.ts || new Date().toISOString(), w: sig.w, h: sig.h, paths: sig.paths };
    stored.hash = signPayload(doc, stored);
    doc.signed = stored;
    return stored;
  }

  function verifySign(doc) {
    if (!doc.signed) return false;
    return signPayload(doc, doc.signed) === doc.signed.hash;
  }

  function addLot(state, o) {
    const qtyMilli = o.qtyMilli;
    if (!o.pid) throw new Error('Elige un producto');
    if (!qtyMilli || qtyMilli <= 0) throw new Error('Cantidad no válida');
    if (o.cost == null || o.cost < 0) throw new Error('Coste no válido');
    const lot = {
      id: uid(state, 'l'), pid: o.pid, qty: qtyMilli, left: qtyMilli, cost: o.cost,
      lot: o.lot || ('L-' + (o.date || '').slice(0, 7)), origin: o.origin || '', date: o.date
    };
    state.lots.push(lot);
    state.moves.push({ id: uid(state, 'm'), pid: o.pid, qtyMilli, type: 'entrada', lot: lot.lot, origin: lot.origin, ref: 'entrada', date: o.date });
    return lot;
  }

  function crearRecibida(state, draft) {
    if (!draft.supplierId) throw new Error('Elige un proveedor');
    const lines = normalizeLines(draft.lines);
    const n = state.nextRec++;
    const rec = {
      id: uid(state, 'r'), n, num: state.company.recSerie + n, date: draft.date, supplierId: draft.supplierId,
      lines, status: 'pendiente', source: 'app'
    };
    state.received.push(rec);
    state.log.push({ id: uid(state, 'lg'), date: rec.date, n: rec.n, text: 'Factura recibida', ref: rec.id });
    return rec;
  }

  function matchPago(state, bankId, receivedId) {
    const b = byId(state.bank, bankId);
    const rec = byId(state.received, receivedId);
    if (!b || !rec) throw new Error('No se encuentra el movimiento o la factura recibida');
    if (b.invoiceId || b.receivedId) throw new Error('Ese movimiento ya está casado');
    if (b.amount >= 0) throw new Error('Elige un cargo del banco (importe negativo)');
    if (rec.status === 'pagada') throw new Error('Esa factura ya está pagada');
    const t = totals(rec);
    if (-b.amount !== t.total) throw new Error('El cargo del banco no coincide con el total. No se marca como pagada.');
    b.receivedId = rec.id;
    rec.status = 'pagada';
    state.log.push({ id: uid(state, 'lg'), date: b.date, n: rec.n, text: 'Pago casado con el banco', ref: rec.id });
  }

  root.PaguuLogic = {
    sha256, eur, eurPlain, fd, qtyText, parseEur, parseQty, lineAmounts, totals, canon, addr, byId,
    daysBetween, monthEnd, prepare, verifyChain, kpis, beneficios, relacion, aging, igicPeriod, trial, cuadre,
    qrPayload, matchBank, unmatchBank, anular, emitirFactura, crearAlbaran, facturarAlbaranes, signDoc, verifySign,
    addLot, crearRecibida, matchPago, docCost, ZERO
  };
})(typeof window !== 'undefined' ? window : globalThis);
