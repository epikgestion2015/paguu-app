/* PAGUU · contabilidad completa de demo (PGC pyme, IGIC canario, partida doble). */
(function (root) {
  'use strict';
  const PL = root.PaguuLogic;

  const DEFAULT_ACCOUNTS = [
    ['100', 'Capital social'],
    ['112', 'Reserva legal'],
    ['113', 'Reservas voluntarias'],
    ['120', 'Remanente'],
    ['129', 'Resultado del ejercicio'],
    ['170', 'Deudas a largo plazo con entidades de crédito'],
    ['206', 'Aplicaciones informáticas'],
    ['210', 'Terrenos y bienes naturales'],
    ['211', 'Construcciones'],
    ['213', 'Maquinaria'],
    ['216', 'Mobiliario'],
    ['217', 'Equipos para procesos de información'],
    ['218', 'Elementos de transporte'],
    ['280', 'Amortización acumulada del inmovilizado intangible'],
    ['281', 'Amortización acumulada del inmovilizado material'],
    ['300', 'Mercaderías'],
    ['400', 'Proveedores'],
    ['410', 'Acreedores por prestaciones de servicios'],
    ['430', 'Clientes'],
    ['431', 'Clientes, efectos comerciales a cobrar'],
    ['465', 'Remuneraciones pendientes de pago'],
    ['4700', 'Hacienda Pública, deudora por IGIC'],
    ['472', 'Hacienda Pública, IGIC soportado'],
    ['473', 'Hacienda Pública, retenciones y pagos a cuenta'],
    ['4750', 'Hacienda Pública, acreedora por IGIC'],
    ['4751', 'Hacienda Pública, acreedora por retenciones practicadas'],
    ['476', 'Organismos de la Seguridad Social, acreedores'],
    ['477', 'Hacienda Pública, IGIC repercutido'],
    ['520', 'Deudas a corto plazo con entidades de crédito'],
    ['555', 'Partidas pendientes de aplicación'],
    ['570', 'Caja, euros'],
    ['572', 'Bancos e instituciones de crédito c/c'],
    ['600', 'Compras de mercaderías'],
    ['610', 'Variación de existencias de mercaderías'],
    ['621', 'Arrendamientos y cánones'],
    ['622', 'Reparaciones y conservación'],
    ['623', 'Servicios de profesionales independientes'],
    ['624', 'Transportes'],
    ['625', 'Primas de seguros'],
    ['626', 'Servicios bancarios y similares'],
    ['627', 'Publicidad, propaganda y relaciones públicas'],
    ['628', 'Suministros'],
    ['629', 'Otros servicios'],
    ['640', 'Sueldos y salarios'],
    ['642', 'Seguridad Social a cargo de la empresa'],
    ['662', 'Intereses de deudas'],
    ['680', 'Amortización del inmovilizado intangible'],
    ['681', 'Amortización del inmovilizado material'],
    ['700', 'Ventas de mercaderías'],
    ['705', 'Prestaciones de servicios'],
    ['708', 'Devoluciones de ventas y operaciones similares'],
    ['769', 'Otros ingresos financieros']
  ].map(([code, name]) => ({ code, name, group: code.charAt(0), active: true }));

  const SAMPLE_ASSET = {
    id: 'am-demo',
    name: 'Equipo informático oficina',
    cuenta: '217',
    acum: '281',
    gasto: '681',
    fecha: '2026-01-15',
    valor: 120000,
    residual: 0,
    anos: 4
  };

  function ensure(state) {
    let dirty = false;
    if (!Array.isArray(state.asientos)) { state.asientos = []; dirty = true; }
    if (!Array.isArray(state.activos)) { state.activos = [Object.assign({}, SAMPLE_ASSET)]; dirty = true; }
    if (!Array.isArray(state.ejercicios)) { state.ejercicios = []; dirty = true; }
    if (!Array.isArray(state.extracto)) { state.extracto = []; dirty = true; }
    if (!Array.isArray(state.moves)) state.moves = [];
    if (!Array.isArray(state.lots)) state.lots = [];
    if (!Array.isArray(state.bank)) state.bank = [];
    if (!Array.isArray(state.received)) state.received = [];
    return dirty;
  }

  function materialize(state) {
    ensure(state);
    if (!Array.isArray(state.planCuentas)) {
      state.planCuentas = DEFAULT_ACCOUNTS.map(a => Object.assign({}, a));
    }
  }

  function allAccounts(state) {
    ensure(state);
    const custom = Array.isArray(state.planCuentas) ? state.planCuentas : null;
    const map = new Map();
    for (const a of DEFAULT_ACCOUNTS) map.set(a.code, Object.assign({}, a));
    if (custom) for (const a of custom) map.set(a.code, Object.assign({ group: String(a.code).charAt(0), active: true }, a));
    return [...map.values()].sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
  }

  function chart(state) {
    return allAccounts(state).filter(a => a.active !== false);
  }

  function accName(state, code) {
    const a = allAccounts(state).find(x => x.code === code);
    return a ? a.name : ('Cuenta ' + code);
  }

  function upsertAccount(state, code, name) {
    materialize(state);
    const a = state.planCuentas.find(x => x.code === code);
    if (!a) throw new Error('No existe la cuenta ' + code);
    const n = String(name || '').trim();
    if (n.length < 2) throw new Error('El nombre de la cuenta es demasiado corto');
    a.name = n;
  }

  function addAccount(state, code, name) {
    materialize(state);
    code = String(code || '').trim();
    name = String(name || '').trim();
    if (!/^[1-7]\d{2,9}$/.test(code)) throw new Error('Código no válido: grupo 1 a 7 y al menos 3 dígitos');
    if (name.length < 2) throw new Error('Indica el nombre de la cuenta');
    if (state.planCuentas.some(a => a.code === code)) throw new Error('Esa cuenta ya está en el plan');
    state.planCuentas.push({ code, name, group: code.charAt(0), active: true, custom: true });
    state.planCuentas.sort((a, b) => a.code < b.code ? -1 : 1);
  }

  function setAccountActive(state, code, active) {
    materialize(state);
    const a = state.planCuentas.find(x => x.code === code);
    if (!a) throw new Error('No existe la cuenta ' + code);
    a.active = !!active;
  }

  function line(code, debe, haber) {
    return { code, debe: debe || 0, haber: haber || 0 };
  }

  function balanced(lines) {
    let d = 0, h = 0;
    const out = [];
    for (const ln of lines) {
      const debe = Math.round(ln.debe || 0);
      const haber = Math.round(ln.haber || 0);
      if (!debe && !haber) continue;
      if (debe && haber) throw new Error('Una línea no puede llevar debe y haber');
      if (debe < 0 || haber < 0) throw new Error('Los importes del asiento van en positivo');
      d += debe; h += haber;
      out.push({ code: String(ln.code), debe, haber });
    }
    if (d !== h) throw new Error('El asiento no cuadra: debe ' + PL.eur(d) + ' y haber ' + PL.eur(h));
    if (!d) return [];
    return out;
  }

  function pushEntry(out, entry) {
    let lines;
    try { lines = balanced(entry.lines); }
    catch (e) { throw new Error((entry.concept || 'Asiento') + ': ' + e.message); }
    if (!lines.length) return;
    out.push({
      id: entry.id,
      date: entry.date,
      concept: entry.concept,
      source: entry.source,
      ref: entry.ref || '',
      year: entry.year || null,
      lines
    });
  }

  function stockAmount(qtyMilli, cost) {
    if (!qtyMilli || cost == null) return 0;
    return Math.round(qtyMilli * cost / 1000);
  }

  function lotCost(state, pid, lotCode) {
    const lot = (state.lots || []).find(l => l.pid === pid && l.lot === lotCode);
    return lot ? lot.cost : 0;
  }

  function productName(state, pid) {
    const p = PL.byId(state.products || [], pid);
    return p ? p.name : (pid || 'mercadería');
  }

  function autoEntries(state) {
    const out = [];
    for (const inv of state.invoices || []) {
      if (inv.status === 'anulada') continue;
      const t = PL.totals(inv);
      let v700 = 0, v705 = 0;
      for (const ln of inv.lines || []) {
        const a = PL.lineAmounts(ln);
        if ((Number(ln.rate) || 0) > 0) v705 += a.base;
        else v700 += a.base;
      }
      const lines = [line('430', t.total, 0)];
      if (v700) lines.push(line('700', 0, v700));
      if (v705) lines.push(line('705', 0, v705));
      if (t.igic) lines.push(line('477', 0, t.igic));
      pushEntry(out, {
        id: 'auto-fac-' + inv.id,
        date: inv.date,
        concept: 'Factura emitida ' + inv.num,
        source: 'auto-factura',
        ref: inv.id,
        lines
      });
      if (inv.status === 'cobrada') {
        const b = (state.bank || []).find(x => x.invoiceId === inv.id);
        pushEntry(out, {
          id: 'auto-cob-' + inv.id,
          date: b && b.date ? b.date : inv.date,
          concept: 'Cobro ' + inv.num,
          source: 'auto-cobro',
          ref: inv.id,
          lines: [line('572', t.total, 0), line('430', 0, t.total)]
        });
      }
    }
    for (const rec of state.received || []) {
      if (rec.status === 'anulada') continue;
      const t = PL.totals(rec);
      const lines = [line('600', t.base, 0)];
      if (t.igic) lines.push(line('472', t.igic, 0));
      lines.push(line('400', 0, t.total));
      pushEntry(out, {
        id: 'auto-com-' + rec.id,
        date: rec.date,
        concept: 'Factura recibida ' + rec.num,
        source: 'auto-compra',
        ref: rec.id,
        lines
      });
      if (rec.status === 'pagada') {
        const b = (state.bank || []).find(x => x.receivedId === rec.id);
        pushEntry(out, {
          id: 'auto-pag-' + rec.id,
          date: b && b.date ? b.date : rec.date,
          concept: 'Pago ' + rec.num,
          source: 'auto-pago',
          ref: rec.id,
          lines: [line('400', t.total, 0), line('572', 0, t.total)]
        });
      }
    }

    const covered = new Set();
    for (const m of state.moves || []) {
      if (m.type !== 'entrada') continue;
      const cost = lotCost(state, m.pid, m.lot);
      const amt = stockAmount(m.qtyMilli, cost);
      const key = m.pid + '|' + m.lot + '|' + m.date + '|' + m.qtyMilli;
      covered.add(key);
      pushEntry(out, {
        id: 'auto-ent-' + m.id,
        date: m.date,
        concept: 'Entrada de stock · ' + productName(state, m.pid) + ' · ' + (m.lot || ''),
        source: 'auto-stock',
        ref: m.id,
        lines: [line('300', amt, 0), line('610', 0, amt)]
      });
    }
    for (const lot of state.lots || []) {
      const key = lot.pid + '|' + lot.lot + '|' + lot.date + '|' + lot.qty;
      if (covered.has(key)) continue;
      const amt = stockAmount(lot.qty, lot.cost);
      pushEntry(out, {
        id: 'auto-open-' + lot.id,
        date: lot.date,
        concept: 'Existencias iniciales · ' + productName(state, lot.pid) + ' · ' + (lot.lot || ''),
        source: 'auto-stock',
        ref: lot.id,
        lines: [line('300', amt, 0), line('610', 0, amt)]
      });
    }
    for (const m of state.moves || []) {
      if (m.type !== 'salida') continue;
      const cost = lotCost(state, m.pid, m.lot);
      const amt = stockAmount(m.qtyMilli, cost);
      const alb = (state.albaranes || []).find(a => a.num === m.ref);
      const inv = (state.invoices || []).find(i => i.num === m.ref);
      const source = alb ? 'auto-albaran' : 'auto-stock';
      const who = alb ? ('Albarán ' + m.ref) : (inv ? ('Factura ' + m.ref) : (m.ref || 'Salida'));
      pushEntry(out, {
        id: 'auto-sal-' + m.id,
        date: m.date,
        concept: who + ' · salida de existencias · ' + productName(state, m.pid),
        source,
        ref: alb ? alb.id : (inv ? inv.id : m.id),
        lines: [line('610', amt, 0), line('300', 0, amt)]
      });
    }
    return out;
  }

  const SOURCE_ORDER = {
    apertura: 0,
    'auto-stock': 1,
    'auto-albaran': 2,
    'auto-factura': 3,
    'auto-compra': 4,
    'auto-cobro': 5,
    'auto-pago': 6,
    manual: 7,
    amort: 8,
    cuadre: 9,
    regularizacion: 10,
    cierre: 11
  };

  function entries(state) {
    ensure(state);
    const manual = (state.asientos || []).map(a => ({
      id: a.id,
      date: a.date,
      concept: a.concept,
      source: a.source,
      ref: a.ref || '',
      year: a.year || null,
      lines: (a.lines || []).map(l => ({ code: l.code, debe: l.debe || 0, haber: l.haber || 0 }))
    }));
    const all = autoEntries(state).concat(manual);
    all.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const oa = SOURCE_ORDER[a.source] == null ? 5 : SOURCE_ORDER[a.source];
      const ob = SOURCE_ORDER[b.source] == null ? 5 : SOURCE_ORDER[b.source];
      if (oa !== ob) return oa - ob;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    all.forEach((e, i) => { e.n = i + 1; });
    return all;
  }

  function inRange(list, from, to) {
    return list.filter(e => (!from || e.date >= from) && (!to || e.date <= to));
  }

  function isStatement(e) {
    return e.source !== 'cierre' && e.source !== 'regularizacion';
  }

  function accumulate(list) {
    const map = new Map();
    for (const e of list) {
      for (const ln of e.lines) {
        if (!map.has(ln.code)) map.set(ln.code, { code: ln.code, debe: 0, haber: 0 });
        const a = map.get(ln.code);
        a.debe += ln.debe;
        a.haber += ln.haber;
      }
    }
    return map;
  }

  function sumasFrom(state, list) {
    const map = accumulate(list);
    const rows = [...map.values()].map(a => {
      const net = a.debe - a.haber;
      return {
        code: a.code,
        name: accName(state, a.code),
        debe: a.debe,
        haber: a.haber,
        saldoDebe: net > 0 ? net : 0,
        saldoHaber: net < 0 ? -net : 0
      };
    }).sort((a, b) => a.code < b.code ? -1 : 1);
    let debe = 0, haber = 0, saldoDebe = 0, saldoHaber = 0;
    for (const a of rows) {
      debe += a.debe; haber += a.haber; saldoDebe += a.saldoDebe; saldoHaber += a.saldoHaber;
    }
    return { list: rows, debe, haber, saldoDebe, saldoHaber, cuadra: debe === haber && saldoDebe === saldoHaber };
  }

  function pygFrom(state, list) {
    const map = accumulate(list);
    const ingresos = [];
    const gastos = [];
    map.forEach(a => {
      const g = a.code.charAt(0);
      if (g === '7') {
        const amt = a.haber - a.debe;
        if (amt) ingresos.push({ code: a.code, name: accName(state, a.code), amount: amt });
      } else if (g === '6') {
        const amt = a.debe - a.haber;
        if (amt) gastos.push({ code: a.code, name: accName(state, a.code), amount: amt });
      }
    });
    ingresos.sort((a, b) => a.code < b.code ? -1 : 1);
    gastos.sort((a, b) => a.code < b.code ? -1 : 1);
    const totalIng = ingresos.reduce((s, a) => s + a.amount, 0);
    const totalGas = gastos.reduce((s, a) => s + a.amount, 0);
    return { ingresos, gastos, totalIng, totalGas, resultado: totalIng - totalGas };
  }

  function classify(code, net) {
    if (!net) return null;
    const g = code.charAt(0);
    const debit = net > 0;
    const amt = Math.abs(net);
    if (g === '6' || g === '7') return null;
    if (g === '2') return { side: 'anc', amount: debit ? amt : -amt };
    if (g === '3') return { side: 'ex', amount: debit ? amt : -amt };
    if (g === '1') {
      if (/^(14|15|16|17|18)/.test(code)) return { side: debit ? 'deud' : 'pnc', amount: amt };
      return { side: 'pn', amount: debit ? -amt : amt };
    }
    if (code.indexOf('57') === 0) return { side: debit ? 'tes' : 'pc', amount: amt };
    if (g === '5') return { side: debit ? 'deud' : 'pc', amount: amt };
    if (/^(40|41|465|475|476|477)/.test(code)) return { side: debit ? 'deud' : 'pc', amount: amt };
    return { side: debit ? 'deud' : 'pc', amount: amt };
  }

  function section() {
    return { lines: [], total: 0 };
  }

  function balanceFrom(state, list, pyg) {
    const map = accumulate(list);
    const activo = { anc: section(), ex: section(), deud: section(), tes: section() };
    const pasivo = { pn: section(), pnc: section(), pc: section() };
    const put = (bag, code, amount) => {
      if (!amount) return;
      bag.lines.push({ code, name: accName(state, code), amount });
      bag.total += amount;
    };
    map.forEach((a, code) => {
      const net = a.debe - a.haber;
      const c = classify(code, net);
      if (!c) return;
      const bag = activo[c.side] || pasivo[c.side];
      if (bag) put(bag, code, c.amount);
    });
    const has129 = pasivo.pn.lines.some(l => l.code === '129');
    put(pasivo.pn, has129 ? '' : '129', pyg.resultado);
    if (has129 && pyg.resultado) {
      pasivo.pn.lines[pasivo.pn.lines.length - 1].name = 'Resultado del periodo';
      pasivo.pn.lines[pasivo.pn.lines.length - 1].code = 'PyG';
    } else if (!has129) {
      const last = pasivo.pn.lines[pasivo.pn.lines.length - 1];
      if (last && last.code === '129') last.name = 'Resultado del ejercicio';
    }
    const sortLines = bag => bag.lines.sort((a, b) => String(a.code) < String(b.code) ? -1 : 1);
    Object.keys(activo).forEach(k => sortLines(activo[k]));
    Object.keys(pasivo).forEach(k => sortLines(pasivo[k]));
    activo.total = activo.anc.total + activo.ex.total + activo.deud.total + activo.tes.total;
    pasivo.total = pasivo.pn.total + pasivo.pnc.total + pasivo.pc.total;
    return { activo, pasivo, cuadra: activo.total === pasivo.total };
  }

function statementEntries(state, to) {
  return entries(state).filter(e => {
    if (to && e.date > to) return false;
    if (!isStatement(e)) return false;
    if (e.source === 'apertura') return true;
    const y = e.date.slice(0, 4);
    if (yearClosed(state, y)) {
      const ap = (Number(y) + 1) + '-01-01';
      if (!to || ap <= to) return false;
    }
    return true;
  });
}

function cashFrom(period, prior) {
  const rows = [];
  let entradas = 0, salidas = 0, inicial = 0;
  const tipo = { cobros: 0, pagos: 0, otrosIn: 0, otrosOut: 0 };
  const addSaldo = e => {
    for (const ln of e.lines) if (ln.code === '570' || ln.code === '572') inicial += ln.debe - ln.haber;
  };
  for (const e of prior) addSaldo(e);
  for (const e of period) {
    if (e.source === 'apertura') { addSaldo(e); continue; }
    for (const ln of e.lines) {
      if (ln.code !== '570' && ln.code !== '572') continue;
      entradas += ln.debe;
      salidas += ln.haber;
      const contra = e.lines.filter(x => x !== ln).map(x => x.code);
      let kind = 'otros';
      if (contra.indexOf('430') >= 0) { kind = 'cobro'; tipo.cobros += ln.debe; }
      else if (contra.indexOf('400') >= 0 || contra.indexOf('410') >= 0) { kind = 'pago'; tipo.pagos += ln.haber; }
      else if (ln.debe) tipo.otrosIn += ln.debe;
      else tipo.otrosOut += ln.haber;
      rows.push({
        date: e.date, n: e.n, concept: e.concept, code: ln.code, contra: contra.join(', '),
        entra: ln.debe, sale: ln.haber, kind
      });
    }
  }
  return { rows, entradas, salidas, neto: entradas - salidas, inicial, final: inicial + entradas - salidas, tipo };
}

function report(state, from, to) {
  const all = entries(state);
  const until = statementEntries(state, to);
  const periodStmt = until.filter(e => !from || e.date >= from);
  const prior = until.filter(e => from && e.date < from);
  const pygList = periodStmt.filter(e => e.source !== 'apertura');
  const pyg = pygFrom(state, pygList);
  const sumas = sumasFrom(state, periodStmt);
  const balance = balanceFrom(state, until, pygFrom(state, until.filter(e => e.source !== 'apertura')));
  const cash = cashFrom(periodStmt, prior);
  const inv = inventario(state, until);
  return { entries: inRange(all, from, to), period: periodStmt, sumas, pyg, balance, cash, inventario: inv, from, to };
}

  function inventario(state, until) {
    const rows = (state.products && root.PaguuLogic.cuadre) ? PL.cuadre(state) : [];
    const valor = rows.reduce((s, r) => s + (r.value || 0), 0);
    const map = accumulate(until);
    const a300 = map.get('300') || { debe: 0, haber: 0 };
    const a610 = map.get('610') || { debe: 0, haber: 0 };
    const saldo300 = a300.debe - a300.haber;
    const saldo610 = a610.haber - a610.debe;
    return { rows, valor, saldo300, saldo610, cuadra: valor === saldo300 };
  }

function mayor(state, code, from, to) {
  code = String(code || '430');
  const all = statementEntries(state, to);
  let saldo = 0;
    for (const e of all) {
      if (from && e.date >= from) break;
      for (const ln of e.lines) if (ln.code === code) saldo += ln.debe - ln.haber;
    }
    const anterior = saldo;
    const rows = [];
    for (const e of all) {
      if (from && e.date < from) continue;
      if (to && e.date > to) continue;
      for (const ln of e.lines) {
        if (ln.code !== code) continue;
        saldo += ln.debe - ln.haber;
        rows.push({ date: e.date, n: e.n, concept: e.concept, source: e.source, ref: e.ref, debe: ln.debe, haber: ln.haber, saldo });
      }
    }
    return { code, name: accName(state, code), anterior, rows, saldo };
  }

  function ratesOf(doc) {
    const map = new Map();
    for (const ln of doc.lines || []) {
      const a = PL.lineAmounts(ln);
      const rate = Number(ln.rate) || 0;
      if (!map.has(rate)) map.set(rate, { base: 0, cuota: 0 });
      const g = map.get(rate);
      g.base += a.base;
      g.cuota += a.igic;
    }
    return map;
  }

  function igic(state, from, to) {
    const expedidas = [];
    const recibidas = [];
    const tasasE = new Map();
    const tasasR = new Map();
    const addT = (map, rate, base, cuota) => {
      if (!map.has(rate)) map.set(rate, { rate, base: 0, cuota: 0 });
      const g = map.get(rate);
      g.base += base; g.cuota += cuota;
    };
    for (const inv of state.invoices || []) {
      if (inv.status === 'anulada' || (from && inv.date < from) || (to && inv.date > to)) continue;
      const t = PL.totals(inv);
      const cl = PL.byId(state.clients || [], inv.clientId) || {};
      const rates = ratesOf(inv);
      let b0 = 0, b7 = 0;
      rates.forEach((g, rate) => {
        addT(tasasE, rate, g.base, g.cuota);
        if (rate === 0) b0 += g.base;
        else if (rate === 7) b7 += g.base;
      });
      expedidas.push({ date: inv.date, num: inv.num, name: cl.name || '', nif: cl.nif || '', b0, b7, cuota: t.igic, total: t.total });
    }
    for (const rec of state.received || []) {
      if (rec.status === 'anulada' || (from && rec.date < from) || (to && rec.date > to)) continue;
      const t = PL.totals(rec);
      const sup = PL.byId(state.suppliers || [], rec.supplierId) || {};
      const rates = ratesOf(rec);
      let b0 = 0, b7 = 0;
      rates.forEach((g, rate) => {
        addT(tasasR, rate, g.base, g.cuota);
        if (rate === 0) b0 += g.base;
        else if (rate === 7) b7 += g.base;
      });
      recibidas.push({ date: rec.date, num: rec.num, name: sup.name || '', nif: sup.nif || '', b0, b7, cuota: t.igic, total: t.total });
    }
    const rep = [...tasasE.values()].reduce((s, a) => s + a.cuota, 0);
    const sop = [...tasasR.values()].reduce((s, a) => s + a.cuota, 0);
    const cuota = rep - sop;
    return {
      from, to, expedidas, recibidas,
      tasasE: [...tasasE.values()].sort((a, b) => a.rate - b.rate),
      tasasR: [...tasasR.values()].sort((a, b) => a.rate - b.rate),
      rep, sop, cuota,
      aIngresar: cuota > 0 ? cuota : 0,
      aCompensar: cuota < 0 ? -cuota : 0,
      modelo: '420',
      aviso: 'Modelo 420 de IGIC, orientativo. Por validar con asesor. No es una autoliquidación presentada ante la ATC.'
    };
  }

  function quarterRange(year, q) {
    const qi = Math.min(4, Math.max(1, Number(q) || 1));
    const sm = (qi - 1) * 3 + 1;
    const from = year + '-' + String(sm).padStart(2, '0') + '-01';
    const endMonth = sm + 2;
    const to = PL.monthEnd(year + '-' + String(endMonth).padStart(2, '0'));
    return { from, to, label: qi + 'T ' + year, q: qi, year: String(year) };
  }

  function yearClosed(state, year) {
    ensure(state);
    return (state.ejercicios || []).some(e => String(e.year) === String(year));
  }

  function assertOpen(state, date) {
    const year = String(date || '').slice(0, 4);
    if (year && yearClosed(state, year)) throw new Error('El ejercicio ' + year + ' está cerrado');
  }

  function addManual(state, draft) {
    ensure(state);
    const date = String(draft.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Fecha no válida');
    assertOpen(state, date);
    const concept = String(draft.concept || '').trim();
    if (concept.length < 3) throw new Error('Indica un concepto');
    const known = new Set(chart(state).map(a => a.code));
    const raw = [];
    for (const ln of draft.lines || []) {
      const code = String(ln.code || '').trim();
      if (!code) continue;
      if (!known.has(code)) throw new Error('La cuenta ' + code + ' no está activa en el plan');
      const debe = ln.debe == null || ln.debe === '' ? 0 : (typeof ln.debe === 'number' ? ln.debe : PL.parseEur(ln.debe));
      const haber = ln.haber == null || ln.haber === '' ? 0 : (typeof ln.haber === 'number' ? ln.haber : PL.parseEur(ln.haber));
      if (debe == null || haber == null) throw new Error('Importe no válido en la cuenta ' + code);
      if (!debe && !haber) continue;
      raw.push({ code, debe: debe || 0, haber: haber || 0 });
    }
    const lines = balanced(raw);
    if (lines.length < 2) throw new Error('Hacen falta al menos dos líneas');
    state.seq = state.seq || 1;
    const id = 'man' + (state.seq++);
    state.asientos.push({ id, date, concept, source: 'manual', ref: '', year: Number(date.slice(0, 4)), lines });
    return id;
  }

  function deleteAsiento(state, id) {
    ensure(state);
    const a = state.asientos.find(x => x.id === id);
    if (!a) throw new Error('Asiento no encontrado');
    if (a.source === 'cierre' || a.source === 'regularizacion' || a.source === 'apertura') {
      throw new Error('Ese asiento es del cierre. Reabre el ejercicio para quitarlo.');
    }
    assertOpen(state, a.date);
    state.asientos = state.asientos.filter(x => x.id !== id);
  }

  function addAsset(state, o) {
    ensure(state);
    const name = String(o.name || '').trim();
    if (name.length < 2) throw new Error('Indica el bien');
    const fecha = String(o.fecha || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha de alta no válida');
    const valor = typeof o.valor === 'number' ? o.valor : PL.parseEur(o.valor);
    const residual = o.residual == null || o.residual === '' ? 0 : (typeof o.residual === 'number' ? o.residual : PL.parseEur(o.residual));
    const anos = Number(o.anos);
    if (valor == null || valor <= 0) throw new Error('Valor de adquisición no válido');
    if (residual == null || residual < 0 || residual >= valor) throw new Error('Valor residual no válido');
    if (!anos || anos < 1 || anos > 50) throw new Error('Vida útil entre 1 y 50 años');
    const cuenta = String(o.cuenta || '217');
    const acum = String(o.acum || (cuenta.indexOf('20') === 0 ? '280' : '281'));
    const gasto = String(o.gasto || (acum === '280' ? '680' : '681'));
    const known = new Set(chart(state).map(a => a.code));
    if (!known.has(cuenta) || !known.has(acum) || !known.has(gasto)) throw new Error('Revisa las cuentas del inmovilizado, la acumulada y el gasto');
    state.seq = state.seq || 1;
    const asset = { id: 'am' + (state.seq++), name, cuenta, acum, gasto, fecha, valor, residual, anos };
    state.activos.push(asset);
    return asset;
  }

  function deleteAsset(state, id) {
    ensure(state);
    if (state.asientos.some(a => a.source === 'amort' && a.ref === id)) throw new Error('Ya tiene cuotas contabilizadas. Elimina esos asientos antes.');
    state.activos = state.activos.filter(a => a.id !== id);
  }

  function postedAmort(state, assetId, year) {
    return (state.asientos || []).filter(a => a.source === 'amort' && a.ref === assetId && Number(String(a.date).slice(0, 4)) < Number(year))
      .reduce((s, a) => s + (a.lines.find(l => l.debe) || {}).debe, 0);
  }

  function cuota(state, asset, year) {
    const y = Number(year);
    const start = Number(String(asset.fecha).slice(0, 4));
    const month = Number(String(asset.fecha).slice(5, 7));
    if (!y || y < start) return 0;
    const base = asset.valor - (asset.residual || 0);
    const annual = Math.round(base / asset.anos);
    const already = postedAmort(state, asset.id, y);
    const room = base - already;
    if (room <= 0) return 0;
    let q = annual;
    if (y === start) q = Math.round(annual * (12 - month + 1) / 12);
    if (q > room) q = room;
    return q;
  }

  function postAmort(state, assetId, year) {
    ensure(state);
    const asset = state.activos.find(a => a.id === assetId);
    if (!asset) throw new Error('Bien no encontrado');
    const y = Number(year);
    if (yearClosed(state, y)) throw new Error('El ejercicio ' + y + ' está cerrado');
    if (state.asientos.some(a => a.source === 'amort' && a.ref === assetId && Number(String(a.date).slice(0, 4)) === y)) {
      throw new Error('La cuota de ' + y + ' ya está contabilizada');
    }
    const q = cuota(state, asset, y);
    if (!q) throw new Error('No queda cuota pendiente en ' + y);
    const date = y + '-12-31';
    state.seq = state.seq || 1;
    const id = 'amo' + (state.seq++);
    state.asientos.push({
      id, date, year: y, source: 'amort', ref: assetId,
      concept: 'Amortización ' + y + ' · ' + asset.name,
      lines: balanced([line(asset.gasto, q, 0), line(asset.acum, 0, q)])
    });
    return id;
  }

function balancesOfYear(state, year) {
  const y = String(year);
  const map = {};
    for (const e of entries(state)) {
      if (!isStatement(e) || e.date.slice(0, 4) !== y) continue;
      for (const ln of e.lines) {
        if (!map[ln.code]) map[ln.code] = { debe: 0, haber: 0 };
        map[ln.code].debe += ln.debe;
        map[ln.code].haber += ln.haber;
      }
    }
    return map;
  }

  function regularizacionLines(map) {
    const lines = [];
    let d129 = 0, h129 = 0;
    Object.keys(map).sort().forEach(code => {
      if (code.charAt(0) !== '6' && code.charAt(0) !== '7') return;
      const net = map[code].debe - map[code].haber;
      if (net > 0) { lines.push(line(code, 0, net)); d129 += net; }
      else if (net < 0) { lines.push(line(code, -net, 0)); h129 += -net; }
    });
    if (d129 || h129) {
      if (d129 >= h129) lines.push(line('129', d129 - h129, 0));
      else lines.push(line('129', 0, h129 - d129));
    }
    return { lines, resultado: h129 - d129 };
  }

  function applyMap(map, lines) {
    for (const ln of lines) {
      if (!map[ln.code]) map[ln.code] = { debe: 0, haber: 0 };
      map[ln.code].debe += ln.debe;
      map[ln.code].haber += ln.haber;
    }
  }

  function cierreLines(map) {
    const lines = [];
    Object.keys(map).sort().forEach(code => {
      const net = map[code].debe - map[code].haber;
      if (net > 0) lines.push(line(code, 0, net));
      else if (net < 0) lines.push(line(code, -net, 0));
    });
    return lines;
  }

  function previewCierre(state, year) {
    const map = balancesOfYear(state, year);
    const reg = regularizacionLines(map);
    const after = JSON.parse(JSON.stringify(map));
    applyMap(after, reg.lines);
    const cierre = cierreLines(after);
    return { year: Number(year), resultado: reg.resultado, regularizacion: reg.lines, cierre, movimientos: Object.keys(map).length };
  }

  function cierreStale(state, year) {
    const reg = (state.asientos || []).find(a => a.source === 'regularizacion' && Number(a.year) === Number(year));
    if (!reg) return false;
    const prev = previewCierre(state, year);
    return prev.resultado !== reg.resultado;
  }

  function closeYear(state, year) {
    ensure(state);
    const y = Number(year);
    if (!y || y < 2000 || y > 2100) throw new Error('Ejercicio no válido');
    if (yearClosed(state, y)) throw new Error('Ese ejercicio ya está cerrado');
    if ((state.ejercicios || []).some(e => Number(e.year) > y)) throw new Error('Hay un ejercicio posterior cerrado');
    const prev = previewCierre(state, y);
    if (!prev.regularizacion.length && !prev.cierre.length) throw new Error('No hay saldos que cerrar en ' + y);
    const regLines = balanced(prev.regularizacion);
    const cieLines = balanced(prev.cierre);
    const apLines = balanced(cieLines.map(l => line(l.code, l.haber, l.debe)));
    state.seq = state.seq || 1;
    if (regLines.length) state.asientos.push({
      id: 'reg' + y, date: y + '-12-31', year: y, source: 'regularizacion', ref: 'regularizacion-' + y,
      concept: 'Regularización del ejercicio ' + y, resultado: prev.resultado, lines: regLines
    });
    state.asientos.push({
      id: 'cie' + y, date: y + '-12-31', year: y, source: 'cierre', ref: 'cierre-' + y,
      concept: 'Cierre del ejercicio ' + y, lines: cieLines
    });
    state.asientos.push({
      id: 'ape' + (y + 1), date: (y + 1) + '-01-01', year: y + 1, source: 'apertura', ref: 'apertura-' + (y + 1),
      concept: 'Apertura del ejercicio ' + (y + 1), lines: apLines
    });
    state.ejercicios.push({ year: y, closedAt: new Date().toISOString() });
    state.ejercicios.sort((a, b) => a.year - b.year);
    return prev;
  }

  function reopenYear(state, year) {
    ensure(state);
    const y = Number(year);
    if (!yearClosed(state, y)) throw new Error('Ese ejercicio no está cerrado');
    if (state.ejercicios.some(e => Number(e.year) > y)) throw new Error('Reabre antes el ejercicio ' + (y + 1));
    state.asientos = state.asientos.filter(a => {
      if (a.source === 'regularizacion' && Number(a.year) === y) return false;
      if (a.source === 'cierre' && Number(a.year) === y) return false;
      if (a.source === 'apertura' && a.ref === 'apertura-' + (y + 1)) return false;
      return true;
    });
    state.ejercicios = state.ejercicios.filter(e => Number(e.year) !== y);
  }

  function splitCsv(line, sep) {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else q = false;
        } else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  }

  function parseDateFlex(s) {
    const t = String(s || '').trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(t);
    if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    return null;
  }

  function normHead(s) {
    return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function importExtracto(state, text) {
    ensure(state);
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) throw new Error('El CSV está vacío');
    const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
    const head = splitCsv(lines[0], sep).map(normHead);
    const ix = (...names) => {
      for (const n of names) {
        const i = head.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };
    let iFecha = ix('fecha', 'date', 'f. valor', 'f valor', 'fvalor');
    let iCon = ix('concepto', 'descripcion', 'description', 'movimiento');
    let iImp = ix('importe', 'amount', 'cantidad');
    let iDebe = ix('debe', 'cargo', 'cargos');
    let iHaber = ix('haber', 'abono', 'abonos');
    let start = 1;
    if (iFecha < 0 && iImp < 0 && iDebe < 0) {
      iFecha = 0; iCon = 1; iImp = 2; start = 0;
    }
    let added = 0, dup = 0, skipped = 0;
    state.seq = state.seq || 1;
    for (let i = start; i < lines.length; i++) {
      const col = splitCsv(lines[i], sep);
      const date = parseDateFlex(col[iFecha] || '');
      const concept = (iCon >= 0 ? col[iCon] : '') || 'Movimiento importado';
      let amount = null;
      if (iDebe >= 0 || iHaber >= 0) {
        const debe = PL.parseEur(col[iDebe] || '') || 0;
        const haber = PL.parseEur(col[iHaber] || '') || 0;
        if (!debe && !haber) { skipped++; continue; }
        amount = haber - debe;
      } else {
        amount = PL.parseEur(col[iImp] || '');
      }
      if (!date || amount == null || !amount) { skipped++; continue; }
      const exists = state.bank.some(b => b.date === date && b.amount === amount && b.concept === concept)
        || state.extracto.some(b => b.date === date && b.amount === amount && b.concept === concept);
      if (exists) { dup++; continue; }
      const id = 'ex' + (state.seq++);
      const row = { id, date, concept, amount, invoiceId: null, receivedId: null, origin: 'csv' };
      state.extracto.push({ id, date, concept, amount, origin: 'csv' });
      state.bank.push(row);
      added++;
    }
    if (!added && !dup) throw new Error('No se ha leído ningún movimiento. Usa fecha;concepto;importe');
    return { added, dup, skipped };
  }

  function sugerencias(state) {
    const out = [];
    for (const b of state.bank || []) {
      if (b.invoiceId || b.receivedId) continue;
      if (b.amount > 0) {
        const docs = (state.invoices || []).filter(i => i.status === 'emitida' && PL.totals(i).total === b.amount);
        out.push({ bank: b, tipo: 'cobro', docs, cuadra: docs.length === 1 });
      } else if (b.amount < 0) {
        const docs = (state.received || []).filter(r => r.status !== 'pagada' && r.status !== 'anulada' && PL.totals(r).total === -b.amount);
        out.push({ bank: b, tipo: 'pago', docs, cuadra: docs.length === 1 });
      }
    }
    return out;
  }

function casarExactos(state) {
  let cobros = 0, pagos = 0, omitidos = 0;
  const usedI = new Set();
  const usedR = new Set();
  for (const s of sugerencias(state)) {
    if (!s.cuadra) { omitidos++; continue; }
    const doc = s.docs[0];
    if (s.tipo === 'cobro') {
      if (usedI.has(doc.id)) { omitidos++; continue; }
      PL.matchBank(state, s.bank.id, doc.id);
      usedI.add(doc.id);
      cobros++;
    } else {
      if (usedR.has(doc.id)) { omitidos++; continue; }
      PL.matchPago(state, s.bank.id, doc.id);
      usedR.add(doc.id);
      pagos++;
    }
  }
  return { cobros, pagos, omitidos };
}

  function postCuadre(state, date) {
    ensure(state);
    date = date || new Date().toISOString().slice(0, 10);
    assertOpen(state, date);
    if (state.asientos.some(a => a.source === 'cuadre')) throw new Error('Ya hay un asiento de cuadre. Elimínalo en el diario antes de generar otro.');
    const rows = PL.cuadre(state);
    const lines = [];
    let note = [];
    for (const r of rows) {
      if (r.counted == null || !r.diff) continue;
      const cost = r.lots && r.lots.length ? r.lots[0].cost : 0;
      const amt = stockAmount(r.diff, cost);
      if (!amt) continue;
      if (amt > 0) { lines.push(line('300', amt, 0)); lines.push(line('610', 0, amt)); }
      else { lines.push(line('610', -amt, 0)); lines.push(line('300', 0, -amt)); }
      note.push(r.p.name);
    }
    if (!lines.length) throw new Error('No hay diferencia de conteo que contabilizar');
    const packed = [];
    const acc = {};
    for (const ln of lines) {
      if (!acc[ln.code]) acc[ln.code] = { debe: 0, haber: 0 };
      acc[ln.code].debe += ln.debe;
      acc[ln.code].haber += ln.haber;
    }
    Object.keys(acc).forEach(code => {
      const net = acc[code].debe - acc[code].haber;
      if (net > 0) packed.push(line(code, net, 0));
      else if (net < 0) packed.push(line(code, 0, -net));
    });
    state.seq = state.seq || 1;
    const id = 'cua' + (state.seq++);
    state.asientos.push({
      id, date, source: 'cuadre', ref: 'cuadre', year: Number(date.slice(0, 4)),
      concept: 'Ajuste de existencias por cuadre · ' + note.join(', '),
      lines: balanced(packed)
    });
    return id;
  }

  root.PaguuConta = {
    DEFAULT_ACCOUNTS, ensure, chart, allAccounts, accName, upsertAccount, addAccount, setAccountActive,
    entries, report, mayor, igic, quarterRange, addManual, deleteAsiento, addAsset, deleteAsset, cuota, postAmort,
    previewCierre, closeYear, reopenYear, yearClosed, cierreStale, importExtracto, sugerencias, casarExactos, postCuadre
  };
})(typeof window !== 'undefined' ? window : globalThis);
