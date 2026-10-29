/* PAGUU · interfaz del piloto (aspecto tipo panel oscuro, datos ficticios, IGIC). */
(function () {
  'use strict';
  const PL = window.PaguuLogic;
  const PC = window.PaguuConta;
  const KEY = 'paguu-pilot-v1';
  let BOOK = null;
  let S = null;
  let DRAFT = {};
  let SIG = null;
  let OPEN = { fac: true, ana: true, ope: true, con: true, ver: true, cfg: true };
  let factPage = 1;
  let factQ = '';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = c => PL.eur(c);
  const todayISO = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  function toast(msg, kind) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.className = 'toast ' + (kind || 'ok');
    t.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { if (t) t.remove(); }, 3600);
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('No se pudo guardar en este navegador', 'bad'); }
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.version === 1 && Array.isArray(p.invoices) && p.company) return p;
      }
    } catch (e) { /* semilla nueva */ }
    return PL.prepare(window.PAGUU_SEED);
  }
  function parse() {
    const raw = (location.hash || '#/inicio').replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    return { name: parts[0] || 'inicio', id: parts[1] || '', rest: parts[2] || '', parts, q };
  }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  const client = id => PL.byId(S.clients, id);
  const supplier = id => PL.byId(S.suppliers, id);
  const findDoc = id => PL.byId(S.invoices, id) || PL.byId(S.albaranes, id);
  function statusChip(st) {
    const map = { emitida: ['Emitida', 'emitida'], cobrada: ['Cobrada', 'cobrada'], anulada: ['Anulada', 'anulada'], pendiente: ['Pendiente', 'pend'], pagada: ['Pagada', 'cobrada'] };
    const m = map[st] || [st || '—', 'mut'];
    return '<span class="chip ' + m[1] + '">' + m[0] + '</span>';
  }
  const statusLabel = st => ({ emitida: 'Emitida', cobrada: 'Cobrada', anulada: 'Anulada', pendiente: 'Pendiente', pagada: 'Pagada' }[st] || st);
  function opts(list, sel) {
    return list.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map(x =>
      '<option value="' + esc(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
  }
  function blankLine(rate) {
    const r = String(rate == null ? 0 : rate);
    return { desc: r === '7' ? 'Servicio de gestión' : 'Fruta y verdura', qty: '1', price: r === '7' ? '100,00' : '', rate: r, lot: 'L-' + todayISO().slice(0, 7), origin: 'Gran Canaria', pid: '' };
  }
  function defaultMonth() {
    const dates = S.invoices.map(i => i.date).sort();
    return (dates[dates.length - 1] || todayISO()).slice(0, 7);
  }

  const NAV = [
    { g: null, items: [['inicio', 'Inicio']] },
    { g: 'fac', title: 'FACTURACIÓN', items: [['clientes', 'Clientes'], ['proveedores', 'Proveedores'], ['facturas', 'Facturas'], ['recibidas', 'Recibidas'], ['relacion', 'Relación mensual'], ['cobros', 'Cobros y banco'], ['remesas', 'Remesas']] },
    { g: 'ana', title: 'ANÁLISIS', items: [['beneficios', 'Beneficios'], ['informes', 'Informes']] },
    { g: 'ope', title: 'OPERATIVA', items: [['albaranes', 'Albaranes'], ['fin', 'Fin de mes'], ['stock', 'Stock y cuadre']] },
    { g: 'con', title: 'CONTABILIDAD', items: [['conta', 'Resumen'], ['plan', 'Plan de cuentas'], ['diario', 'Diario'], ['mayor', 'Mayor'], ['sumas', 'Sumas y saldos'], ['balance', 'Balance'], ['pyg', 'Pérdidas y ganancias'], ['tesoreria', 'Flujo de caja'], ['igic', 'Libro de IGIC'], ['amort', 'Amortizaciones'], ['concilia', 'Conciliación'], ['cierre', 'Cierre de ejercicio'], ['existencias', 'Existencias']] },
    { g: 'ver', title: 'VERIFACTU', items: [['verifactu', 'Cadena y registros'], ['actividad', 'Registro de actividad']] },
    { g: 'cfg', title: 'CONFIGURACIÓN', items: [['empresa', 'Empresa'], ['numeracion', 'Numeración'], ['importar', 'Importación']] }
  ];
  function navOn(name, route) {
    if (name === 'facturas' && (route.name === 'factura' || route.name === 'nueva' || route.name === 'firmar')) return true;
    if (name === 'albaranes' && (route.name === 'albaran' || route.name === 'nuevoalbaran')) return true;
    if (name === 'clientes' && route.name === 'cliente') return true;
    if (name === 'proveedores' && route.name === 'proveedor') return true;
    if (name === 'recibidas' && route.name === 'recibida') return true;
    return route.name === name;
  }
  function sidebar(route) {
    const links = NAV.map(group => {
      const inner = group.items.map(([id, label]) => {
        const cls = (id === 'inicio' ? 'nav-home' : '') + (navOn(id, route) ? ' on' : '');
        return '<a class="' + cls + '" href="#/' + id + '">' + label + '</a>';
      }).join('');
      if (!group.g) return '<nav class="nav">' + inner + '</nav>';
      const open = OPEN[group.g];
      return '<div class="navgrp"><button type="button" data-act="toggleGrp" data-g="' + group.g + '">' + group.title + '<span>' + (open ? '▾' : '▸') + '</span></button>'
        + (open ? '<nav class="nav">' + inner + '</nav>' : '') + '</div>';
    }).join('');
    const theme = document.documentElement.dataset.theme === 'light' ? 'Tema oscuro' : 'Tema claro';
    return '<a class="brand" href="#/inicio"><span class="mark">P</span><span>PAGUU<small>Facturación con IGIC</small></span></a>'
      + '<div class="co"><img src="logo-demo.jpg" alt="Logo Empresa Demo"><div><b>Empresa Demo</b><small>Empresa activa</small></div></div>'
      + '<select class="sel" aria-label="Empresa"><option>Empresa Demo · serie DM26</option></select>'
      + links
      + '<div class="side-foot"><button type="button" class="theme" data-act="theme">' + theme + '</button>'
      + '<div class="user"><span class="av">D</span> Usuario demo</div></div>';
  }

  function head(title, sub, actions) {
    return '<div class="page-head"><div><h1>' + title + '</h1>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div><div class="row">' + (actions || '') + '</div></div>';
  }
  function invRow(inv) {
    const cl = client(inv.clientId);
    const t = PL.totals(inv);
    let name = cl ? cl.name : '—';
    if (inv.source === 'importada') name += ' · importada';
    else if (inv.source === 'albaranes') name += ' · relación';
    else if (inv.source === 'demo') name += '';
    const pend = inv.status === 'emitida' ? '<span class="pend">Pendiente ' + money(t.total) + '</span>' : (inv.status === 'cobrada' ? '<span class="pend">Cobrado</span>' : '');
    return '<a class="irow" href="#/factura/' + inv.id + '"><b>' + esc(inv.num) + '</b><span class="mut">' + PL.fd(inv.date) + '</span><span class="who">' + esc(name) + '</span><span class="right">' + statusChip(inv.status) + '<b class="amt">' + money(t.total) + '</b>' + pend + '</span></a>';
  }

  function shareText(doc, who) {
    const t = PL.totals(doc);
    const tipo = doc.num.indexOf(S.company.albSerie) === 0 && doc.num.indexOf(S.company.serie) !== 0 ? 'albarán' : 'factura';
    return 'Hola, te enviamos copia del ' + tipo + ' ' + doc.num + ' de ' + S.company.name + ' con fecha ' + PL.fd(doc.date) + ' por ' + money(t.total)
      + (doc.signed ? '. Firmado por ' + doc.signed.name + '.' : '')
      + ' Piloto PAGUU: documento local, no es un envío a la AEAT.';
  }
  function mailHref(email, subject, body) {
    return 'mailto:' + (email || '') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  function waHref(phone, body) {
    let d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 9) d = '34' + d;
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(body);
  }

  const VIEWS = {};
  VIEWS.inicio = () => {
    const k = PL.kpis(S);
    const last = S.invoices.slice().sort((a, b) => b.n - a.n).slice(0, 5);
    const acts = S.log.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.n || 0) - (a.n || 0)).slice(0, 6);
    return '<div class="page-head"><div><div class="nif">' + esc(S.company.nif) + '</div><h1>' + esc(S.company.name) + '</h1><p class="sub">Próxima factura ' + esc(k.next) + '</p></div>'
      + '<a class="btn" href="#/nueva">Nueva factura</a></div>'
      + '<div class="kpis"><div class="card kpi"><div class="lbl">Por cobrar</div><div class="val">' + money(k.cobrar) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">Por pagar</div><div class="val">' + money(k.pagar) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">Posición neta</div><div class="val">' + money(k.neta) + '</div><div class="hint">Cobros pendientes menos pagos pendientes</div></div></div>'
      + '<div class="sec-head"><h2>Últimas facturas</h2><a href="#/facturas">Ver todas</a></div>'
      + last.map(invRow).join('')
      + '<div class="sec-head"><h2>Actividad</h2><a href="#/actividad">Ver el registro</a></div><ul class="act">'
      + acts.map(a => '<li>' + esc(a.text) + ' · ' + PL.fd(a.date) + '</li>').join('') + '</ul>';
  };

  VIEWS.facturas = () => {
    const k = PL.kpis(S);
    let list = S.invoices.slice().sort((a, b) => b.n - a.n);
    const q = factQ.trim().toLowerCase();
    if (q) list = list.filter(inv => {
      const cl = client(inv.clientId);
      return inv.num.toLowerCase().includes(q) || (cl && cl.name.toLowerCase().includes(q));
    });
    const size = 20;
    const pages = Math.max(1, Math.ceil(list.length / size));
    if (factPage > pages) factPage = pages;
    const slice = list.slice((factPage - 1) * size, factPage * size);
    return head('Facturas emitidas', 'Serie ' + esc(S.company.serie) + ' de Empresa Demo. La siguiente será ' + esc(k.next) + '.', '<a class="btn" href="#/nueva">Nueva factura</a>')
      + '<div class="row" style="margin-bottom:12px"><input id="qfact" type="search" placeholder="Buscar número o cliente" value="' + esc(factQ) + '" data-act-input="factQ" style="max-width:360px"></div>'
      + (slice.map(invRow).join('') || '<p class="muted">No hay facturas con ese filtro.</p>')
      + '<div class="pager"><button class="btn ghost sm" data-act="factPage" data-d="-1"' + (factPage <= 1 ? ' disabled' : '') + '>Anterior</button><span class="muted">' + factPage + ' / ' + pages + '</span><button class="btn ghost sm" data-act="factPage" data-d="1"' + (factPage >= pages ? ' disabled' : '') + '>Siguiente</button></div>';
  };

  function lineTable(doc) {
    const rows = doc.lines.map(ln => {
      const a = PL.lineAmounts(ln);
      const note = [ln.note, ln.lot ? 'Lote: ' + ln.lot : '', ln.origin ? 'Origen: ' + ln.origin : ''].filter(Boolean).join(' · ');
      return '<tr><td>' + esc(ln.desc) + (note ? '<div class="small muted">' + esc(note) + '</div>' : '') + '</td><td class="r">' + PL.qtyText(ln.qtyMilli) + '</td><td class="r">' + money(ln.price) + '</td><td class="r">' + money(a.base) + '</td><td class="r">' + (ln.rate || 0) + ' %</td><td class="r">' + money(a.total) + '</td></tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr><th>Descripción</th><th class="r">Cantidad</th><th class="r">Precio</th><th class="r">Base</th><th class="r">IGIC</th><th class="r">Importe</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  VIEWS.factura = route => {
    const inv = PL.byId(S.invoices, route.id);
    if (!inv) return '<div class="card">Factura no encontrada. <a href="#/facturas">Volver</a></div>';
    const cl = client(inv.clientId) || { name: '—', nif: '', email: '', phone: '' };
    const t = PL.totals(inv);
    const alta = (S.chain || []).find(c => c.invoiceId === inv.id && c.tipo === 'Alta');
    const body = shareText(inv);
    const mail = mailHref(cl.email, S.company.name + ' · factura ' + inv.num, body);
    const wa = waHref(cl.phone, body);
    const groups = (inv.groups || []).map(id => PL.byId(S.albaranes, id)).filter(Boolean);
    const costs = inv.lines.map((ln, i) => '<div class="row"><span class="grow">' + esc(ln.desc) + '</span><input name="cost-' + i + '" placeholder="sin coste" value="' + (ln.cost == null ? '' : esc(PL.eurPlain(ln.cost))) + '" style="max-width:160px" inputmode="decimal"></div>').join('');
    return '<div class="page-head"><div><div class="nif">' + esc(S.company.name) + '</div><div class="hero-num">' + esc(inv.num) + '</div>' + statusChip(inv.status) + '</div>'
      + '<button class="btn" data-act="pdfInv" data-id="' + inv.id + '">Descargar PDF</button></div>'
      + '<div class="card party"><div><div class="small muted">CLIENTE</div><b>' + esc(cl.name) + '</b><div class="small">NIF/CIF ' + esc(cl.nif || '—') + '</div><div class="small muted">' + esc(PL.addr(cl)) + '</div></div>'
      + '<div><div class="small muted" style="text-align:right">Fecha ' + PL.fd(inv.date) + '</div><div class="bigmoney">' + money(t.total) + '</div><div class="small muted" style="text-align:right">Cobrado ' + money(inv.status === 'cobrada' ? t.total : 0) + '</div></div></div>'
      + '<div class="card" style="margin-top:14px">' + lineTable(inv) + '</div>'
      + (groups.length ? '<div class="card"><h3>Relación de albaranes</h3><ul class="act">' + groups.map(a => '<li><a href="#/albaran/' + a.id + '">' + esc(a.num) + '</a> · ' + PL.fd(a.date) + ' · ' + (a.signed ? 'firmado' : 'sin firmar') + '</li>').join('') + '</ul></div>' : '')
      + '<div class="card"><h3>Coste interno</h3><p class="hint">Sirve para Beneficios. Se puede cambiar después de emitir. No modifica el PDF, el IGIC ni la huella Verifactu. Vacío significa sin coste, no coste cero.</p><form data-form="costes" data-id="' + inv.id + '">' + costs + '<div class="row" style="margin-top:10px"><button class="btn" type="submit">Guardar costes</button></div></form></div>'
      + '<div class="card"><h3>Copia cero papel</h3><p class="hint">La firma en pantalla se guarda en este navegador. Correo abre tu programa de email; WhatsApp abre un chat con el texto. No se envía nada solo.</p><div class="row">'
      + (inv.signed ? '<span class="chip cobrada">Firmado · ' + esc(inv.signed.name) + '</span>' : '<a class="btn" href="#/firmar/' + inv.id + '">Firmar</a>')
      + '<a class="btn sec" href="' + esc(mail) + '">Correo</a>'
      + (wa ? '<a class="btn sec" href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>' : '<button class="btn sec" disabled title="Este contacto no tiene teléfono">WhatsApp</button>')
      + '<button class="btn ghost" data-act="printInv" data-id="' + inv.id + '">Imprimir</button></div>'
      + (inv.signed ? '<div class="row" style="margin-top:10px"><svg class="sig" viewBox="0 0 ' + inv.signed.w + ' ' + inv.signed.h + '">' + inv.signed.paths.map(d => '<path d="' + esc(d) + '" fill="none" stroke="#142033" stroke-width="2.4" stroke-linecap="round"/>').join('') + '</svg><div><div class="hash">SHA-256 ' + esc(inv.signed.hash) + '</div><div class="small">' + (PL.verifySign(inv) ? 'Integridad de la firma verificada en local.' : 'La firma no cuadra.') + '</div></div></div>' : '')
      + '</div>'
      + (alta ? '<div class="card"><h3>Registro Verifactu</h3><p class="hint">Huella encadenada en local. El QR apunta al entorno de pruebas de la AEAT y el registro no se ha enviado.</p><div class="row" style="align-items:flex-start"><div class="qrbox" data-qrid="' + inv.id + '"></div><div class="grow"><div>Alta · ' + (alta.aeat === 'simulado' ? 'envío simulado' : 'no enviado') + '</div><div class="hash">Huella ' + esc(alta.hash) + '</div><div class="hash">Anterior ' + esc(alta.prev) + '</div><button class="btn sec sm" data-act="simular" data-id="' + alta.id + '" style="margin-top:8px">Simular envío (no llama a la AEAT)</button></div></div></div>' : '')
      + '<div class="card"><h3>Anular</h3><p class="hint">Una factura emitida no se edita. La anulación deja constancia y alarga la cadena Verifactu. No se puede anular si ya tiene cobros.</p>'
      + (inv.status === 'anulada' ? '<div class="warnbox">Anulada el ' + PL.fd(inv.anulacion.date) + '. Motivo: ' + esc(inv.anulacion.motivo) + '</div>' : '<form data-form="anular" data-id="' + inv.id + '"><textarea name="motivo" placeholder="Motivo de la anulación" required></textarea><div class="row" style="margin-top:8px"><button class="btn bad" type="submit"' + (inv.status === 'cobrada' ? ' disabled' : '') + '>Anular factura</button></div></form>')
      + '</div>';
  };

  function editor(kind) {
    const D = DRAFT[kind];
    if (!D) return '';
    const prod = kind === 'alb';
    const lines = D.lines.map((ln, i) => '<div class="card" style="padding:10px;margin-top:8px"><div class="lrow">'
      + (prod ? '<select data-draft="' + kind + ':pid:' + i + '" aria-label="Producto"><option value="">Sin producto de stock</option>' + S.products.map(p => '<option value="' + p.id + '"' + (ln.pid === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select>' : '')
      + '<input data-draft="' + kind + ':desc:' + i + '" value="' + esc(ln.desc) + '" placeholder="Descripción" aria-label="Descripción">'
      + '<input data-draft="' + kind + ':qty:' + i + '" value="' + esc(ln.qty) + '" placeholder="Cantidad" inputmode="decimal" aria-label="Cantidad">'
      + '<input data-draft="' + kind + ':price:' + i + '" value="' + esc(ln.price) + '" placeholder="Precio €" inputmode="decimal" aria-label="Precio">'
      + '<select data-draft="' + kind + ':rate:' + i + '" aria-label="IGIC"><option value="0"' + (String(ln.rate) === '0' ? ' selected' : '') + '>0 % fruta / verdura</option><option value="7"' + (String(ln.rate) === '7' ? ' selected' : '') + '>7 % servicios</option></select>'
      + '<input data-draft="' + kind + ':lot:' + i + '" value="' + esc(ln.lot) + '" placeholder="Lote">'
      + '<input data-draft="' + kind + ':origin:' + i + '" value="' + esc(ln.origin) + '" placeholder="Origen">'
      + '<button type="button" class="x" data-act="delLine" data-k="' + kind + '" data-i="' + i + '" aria-label="Quitar">×</button></div></div>').join('');
    const tot = draftTotals(kind);
    return lines + '<div class="row" style="margin-top:8px"><button type="button" class="btn sec sm" data-act="addLine" data-k="' + kind + '">Añadir línea</button><button type="button" class="btn ghost sm" data-act="preset" data-k="' + kind + '" data-rate="7">Línea de servicio 7 %</button><button type="button" class="btn ghost sm" data-act="preset" data-k="' + kind + '" data-rate="0">Línea de fruta 0 %</button></div>'
      + '<div id="live" class="card" style="margin-top:10px"><div class="row"><span class="grow muted">Base</span><b>' + money(tot.base) + '</b></div><div class="row"><span class="grow muted">IGIC</span><b>' + money(tot.igic) + '</b></div><div class="row"><span class="grow">Total</span><b>' + money(tot.total) + '</b></div></div>';
  }
  function draftTotals(kind) {
    let base = 0, igic = 0;
    for (const ln of (DRAFT[kind] && DRAFT[kind].lines) || []) {
      const q = PL.parseQty(ln.qty), p = PL.parseEur(ln.price);
      if (q == null || p == null) continue;
      const b = Math.round(q * p / 1000);
      const g = Math.round(b * (Number(ln.rate) || 0) / 100);
      base += b; igic += g;
    }
    return { base, igic, total: base + igic };
  }
  VIEWS.nueva = () => {
    if (!DRAFT.fac) DRAFT.fac = { clientId: (S.clients[0] && S.clients[0].id) || '', date: todayISO(), lines: [blankLine(0)] };
    const D = DRAFT.fac;
    return head('Nueva factura', 'Numeración ' + esc(S.company.serie) + ' + entero, sin ceros a la izquierda. La próxima es ' + esc(S.company.serie + S.nextFac) + '.')
      + '<form class="card" data-form="emitir"><div class="two"><div><label class="f">Cliente</label><select data-draft="fac:client:0">' + opts(S.clients, D.clientId) + '</select></div>'
      + '<div><label class="f">Fecha</label><input type="date" data-draft="fac:date:0" value="' + esc(D.date) + '"></div></div>'
      + '<h3 style="margin:14px 0 6px">Líneas</h3><p class="hint">IGIC: fruta y verdura 0 %. Servicios 7 %. Esta factura no mueve stock; el albarán sí, cuando la línea lleva producto.</p>'
      + editor('fac')
      + '<div class="row" style="margin-top:12px"><button class="btn" type="submit">Emitir factura</button></div></form>';
  };

  VIEWS.clientes = () => head('Clientes', 'Fichas importadas de la configuración de demo. No se guardan datos bancarios.')
    + '<div class="row" style="margin-bottom:10px"><a class="btn" href="#/cliente/nuevo">Nuevo cliente</a></div>'
    + '<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>NIF/CIF</th><th>Población</th><th class="r">Pendiente</th></tr></thead><tbody>'
    + S.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map(c => {
      let pend = 0, n = 0;
      for (const inv of S.invoices) if (inv.clientId === c.id && inv.status === 'emitida') { pend += PL.totals(inv).total; n++; }
      return '<tr><td><a href="#/cliente/' + c.id + '">' + esc(c.name) + '</a></td><td>' + esc(c.nif) + '</td><td>' + esc(c.city) + '</td><td class="r">' + money(pend) + (n ? ' <span class="small muted">(' + n + ')</span>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';

  function contactForm(kind, rec) {
    const isNew = !rec;
    rec = rec || { id: '', name: '', nif: '', address: '', cp: '', city: '', province: 'Las Palmas', country: 'España', email: '', phone: '' };
    const fields = [['name', 'Razón social'], ['nif', 'NIF/CIF'], ['address', 'Dirección'], ['cp', 'Código postal'], ['city', 'Ciudad'], ['province', 'Provincia'], ['country', 'País'], ['email', 'Correo'], ['phone', 'Teléfono']];
    return '<form class="card" data-form="contacto" data-kind="' + kind + '" data-id="' + esc(rec.id) + '"><div class="two">'
      + fields.map(([k, lab]) => '<div><label class="f">' + lab + '</label><input name="' + k + '" value="' + esc(rec[k] || '') + '"' + (k === 'email' ? ' type="email"' : k === 'phone' ? ' type="tel"' : '') + '></div>').join('')
      + '</div><p class="hint">El banco ya tiene los datos de pago: esta ficha no guarda IBAN ni cuentas.</p><div class="row"><button class="btn" type="submit">' + (isNew ? 'Guardar' : 'Actualizar') + '</button>'
      + (isNew ? '' : '<button type="button" class="btn ghost" data-act="delContacto" data-kind="' + kind + '" data-id="' + esc(rec.id) + '">Eliminar</button>')
      + '</div></form>';
  }
  VIEWS.cliente = route => {
    if (route.id === 'nuevo') return head('Nuevo cliente', '') + contactForm('c', null);
    const c = client(route.id);
    if (!c) return '<div class="card">Cliente no encontrado.</div>';
    const docs = S.invoices.filter(i => i.clientId === c.id).sort((a, b) => b.n - a.n).slice(0, 30);
    return head(esc(c.name), esc(c.nif) + ' · ' + esc(PL.addr(c))) + contactForm('c', c)
      + '<div class="sec-head"><h2>Facturas</h2></div>' + (docs.map(invRow).join('') || '<p class="muted">Sin facturas.</p>');
  };
  VIEWS.proveedores = () => head('Proveedores', 'Importados con la ficha de demo. Sin datos bancarios.')
    + '<div class="row" style="margin-bottom:10px"><a class="btn" href="#/proveedor/nuevo">Nuevo proveedor</a></div>'
    + '<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>NIF/CIF</th><th>Población</th><th>Correo</th></tr></thead><tbody>'
    + S.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map(c => '<tr><td><a href="#/proveedor/' + c.id + '">' + esc(c.name) + '</a></td><td>' + esc(c.nif) + '</td><td>' + esc(c.city) + '</td><td>' + esc(c.email || '—') + '</td></tr>').join('')
    + '</tbody></table></div>';
  VIEWS.proveedor = route => {
    if (route.id === 'nuevo') return head('Nuevo proveedor', '') + contactForm('s', null);
    const c = supplier(route.id);
    if (!c) return '<div class="card">Proveedor no encontrado.</div>';
    const docs = (S.received || []).filter(i => i.supplierId === c.id);
    return head(esc(c.name), esc(c.nif)) + contactForm('s', c)
      + '<div class="sec-head"><h2>Facturas recibidas</h2></div>' + (docs.map(r => '<a class="irow" href="#/recibidas"><b>' + esc(r.num) + '</b><span class="mut">' + PL.fd(r.date) + '</span><span></span><span class="right">' + statusChip(r.status) + '<b>' + money(PL.totals(r).total) + '</b></span></a>').join('') || '<p class="muted">Sin facturas recibidas.</p>');
  };

  VIEWS.recibidas = () => head('Facturas recibidas', 'Compras a proveedores. Por pagar solo cuenta las que siguen pendientes.', '<a class="btn" href="#/recibida/nueva">Nueva recibida</a>')
    + ((S.received || []).slice().sort((a, b) => b.n - a.n).map(r => {
      const s = supplier(r.supplierId);
      const t = PL.totals(r);
      return '<a class="irow" href="#/recibidas"><b>' + esc(r.num) + '</b><span class="mut">' + PL.fd(r.date) + '</span><span class="who">' + esc(s ? s.name : '—') + '</span><span class="right">' + statusChip(r.status) + '<b>' + money(t.total) + '</b></span></a>';
    }).join('') || '<p class="muted">No hay facturas recibidas.</p>');

  VIEWS.recibida = () => {
    if (!DRAFT.rec) DRAFT.rec = { supplierId: (S.suppliers[0] && S.suppliers[0].id) || '', date: todayISO(), lines: [blankLine(0)] };
    const D = DRAFT.rec;
    return head('Nueva factura recibida', 'Queda pendiente de pago hasta que un cargo del banco coincida exactamente.')
      + '<form class="card" data-form="recibida"><div class="two"><div><label class="f">Proveedor</label><select data-draft="rec:supplier:0">' + opts(S.suppliers, D.supplierId) + '</select></div>'
      + '<div><label class="f">Fecha</label><input type="date" data-draft="rec:date:0" value="' + esc(D.date) + '"></div></div>'
      + editor('rec') + '<div class="row" style="margin-top:12px"><button class="btn" type="submit">Guardar recibida</button></div></form>';
  };

  function relQuery(route) {
    const ym = route.q.mes || defaultMonth();
    const agro = S.clients.find(c => c.name.indexOf('AGROARCHIPIELAGO') === 0);
    const clientId = route.q.cliente || (agro && agro.id) || (S.clients[0] && S.clients[0].id);
    return { ym, clientId };
  }
  VIEWS.relacion = route => {
    const { ym, clientId } = relQuery(route);
    const rel = PL.relacion(S, ym, clientId);
    const cl = client(clientId);
    const rows = rel.invs.map(inv => {
      const t = PL.totals(inv);
      const note = inv.lines.map(ln => [ln.desc, ln.lot ? 'Lote: ' + ln.lot : '', ln.origin ? 'Origen: ' + ln.origin : ''].filter(Boolean).join(' · ')).join(' / ');
      return '<tr><td><a href="#/factura/' + inv.id + '">' + esc(inv.num) + '</a><div class="small muted">' + esc(note) + '</div></td><td>' + PL.fd(inv.date) + '</td><td class="r">' + money(t.base) + '</td><td class="r">' + money(t.igic) + '</td><td class="r">' + money(t.total) + '</td><td>' + statusLabel(inv.status) + '</td><td class="r">' + money(inv.status === 'emitida' ? t.total : 0) + '</td></tr>';
    }).join('');
    return head('Relación mensual', 'Facturas de Empresa Demo. Un PDF por factura, con el membrete de la empresa. No se envía solo.',
      '<button class="btn ghost" data-act="excelRel">Excel</button><button class="btn" data-act="zipRel">ZIP de PDFs</button>')
      + '<form class="card" data-form="verRel"><div class="filters"><div><label class="f">Mes</label><input type="month" name="mes" value="' + esc(ym) + '"></div>'
      + '<div><label class="f">Relación de</label><select name="tipo"><option>Clientes</option></select></div>'
      + '<div><label class="f">Cliente</label><select name="cliente">' + opts(S.clients, clientId) + '</select></div>'
      + '<div><button class="btn" type="submit">Ver relación</button></div></div></form>'
      + '<div class="card"><div class="party"><div><h2>' + esc(cl ? cl.name : '') + '</h2><div class="small muted">' + esc(cl ? cl.nif : '') + '</div></div><button class="btn ghost sm" data-act="pdfRel">Descargar PDF</button></div>'
      + '<div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Número</th><th>Fecha</th><th class="r">Base</th><th class="r">IGIC</th><th class="r">Total</th><th>Estado</th><th class="r">Pendiente</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="7">Sin facturas en ese mes.</td></tr>') + '</tbody></table></div>'
      + '<div class="party" style="margin-top:12px"><div>Mes: base ' + money(rel.base) + ' · IGIC ' + money(rel.igic) + ' · total ' + money(rel.total) + ' · pendiente ' + money(rel.pendiente) + '</div><b>Saldo acumulado ' + money(rel.saldo) + '</b></div></div>';
  };

  VIEWS.cobros = () => {
    const libres = S.bank.filter(b => !b.invoiceId && !b.receivedId);
    const ingresos = libres.filter(b => b.amount > 0);
    const cargos = libres.filter(b => b.amount < 0);
    const emitidas = S.invoices.filter(i => i.status === 'emitida').sort((a, b) => b.n - a.n);
    const pendientes = (S.received || []).filter(r => r.status === 'pendiente');
    const casados = S.bank.filter(b => b.invoiceId || b.receivedId).slice(0, 40);
    const optB = ingresos.map(b => '<option value="' + b.id + '">' + PL.fd(b.date) + ' · ' + money(b.amount) + ' · ' + esc(b.concept) + '</option>').join('');
    const optI = emitidas.map(i => '<option value="' + i.id + '">' + esc(i.num) + ' · ' + money(PL.totals(i).total) + ' · ' + esc((client(i.clientId) || {}).name || '') + '</option>').join('');
    return head('Cobros y banco', 'Una factura pasa a cobrada solo si el ingreso del banco coincide en céntimos con el total.')
      + '<div class="two"><form class="card" data-form="casar"><h3>Casar cobro</h3><label class="f">Movimiento de ingreso</label><select name="bank">' + (optB || '<option value="">Sin ingresos libres</option>') + '</select>'
      + '<label class="f">Factura emitida</label><select name="inv">' + (optI || '<option value="">Sin facturas pendientes</option>') + '</select>'
      + '<button class="btn" type="submit" style="margin-top:10px">Casar si cuadra</button></form>'
      + '<form class="card" data-form="bank"><h3>Añadir movimiento simulado</h3><label class="f">Fecha</label><input type="date" name="date" value="' + todayISO() + '">'
      + '<label class="f">Concepto</label><input name="concept" placeholder="Transferencia…">'
      + '<label class="f">Importe €</label><input name="amount" inputmode="decimal" placeholder="107,00">'
      + '<label class="f">Tipo</label><select name="tipo"><option value="ingreso">Ingreso (cobro)</option><option value="pago">Cargo (pago a proveedor)</option></select>'
      + '<button class="btn sec" type="submit" style="margin-top:10px">Añadir al banco</button></form></div>'
      + (cargos.length && pendientes.length ? '<form class="card" data-form="casarPago"><h3>Casar pago a proveedor</h3><div class="two"><div><label class="f">Cargo</label><select name="bank">' + cargos.map(b => '<option value="' + b.id + '">' + money(b.amount) + ' · ' + esc(b.concept) + '</option>').join('') + '</select></div><div><label class="f">Recibida</label><select name="rec">' + pendientes.map(r => '<option value="' + r.id + '">' + esc(r.num) + ' · ' + money(PL.totals(r).total) + '</option>').join('') + '</select></div></div><button class="btn sec" style="margin-top:10px">Casar pago</button></form>' : '')
      + '<div class="card"><h3>Movimientos</h3><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="r">Importe</th><th>Casado</th><th></th></tr></thead><tbody>'
      + S.bank.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80).map(b => {
        const inv = b.invoiceId ? PL.byId(S.invoices, b.invoiceId) : null;
        const rec = b.receivedId ? PL.byId(S.received, b.receivedId) : null;
        const link = inv ? '<a href="#/factura/' + inv.id + '">' + esc(inv.num) + '</a>' : (rec ? esc(rec.num) : '<span class="chip pend">Sin casar</span>');
        return '<tr><td>' + PL.fd(b.date) + '</td><td>' + esc(b.concept) + '</td><td class="r">' + money(b.amount) + '</td><td>' + link + '</td><td>' + (inv ? '<button class="btn ghost sm" data-act="descasar" data-id="' + b.id + '">Deshacer</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="hint">Hay un ingreso simulado de 6,85 € que cuadra con DM26119, y otro de 250,00 € que no cuadra con ninguna factura.</p></div>';
  };

  VIEWS.remesas = () => {
    const emitidas = S.invoices.filter(i => i.status === 'emitida').sort((a, b) => b.n - a.n).slice(0, 40);
    return head('Remesas', 'Agrupa facturas pendientes en una remesa de cheques. No marca el cobro: eso solo ocurre si el banco cuadra el importe.')
      + '<form class="card" data-form="remesa"><label class="f">Concepto</label><input name="concept" value="Remesa de cheques">'
      + '<div style="margin-top:8px;max-height:320px;overflow:auto">' + emitidas.map(i => '<label class="check"><input type="checkbox" name="ids" value="' + i.id + '"><span>' + esc(i.num) + ' · ' + esc((client(i.clientId) || {}).name || '') + ' · ' + money(PL.totals(i).total) + '</span></label>').join('') + '</div>'
      + '<button class="btn" style="margin-top:8px">Preparar remesa</button></form>'
      + '<div class="card"><h3>Remesas preparadas</h3>' + ((S.remesas || []).map(r => '<div class="irow"><b>' + esc(r.id) + '</b><span class="mut">' + PL.fd(r.date) + '</span><span>' + esc(r.concept) + ' · ' + r.invoiceIds.length + ' facturas</span><span class="right"><span class="chip mut">preparada</span><b>' + money(r.total) + '</b></span></div>').join('') || '<p class="muted">Todavía no hay remesas.</p>') + '</div>';
  };

  function costCell(known, missing, cost) {
    if (!known) return 'sin coste';
    return money(cost) + (missing ? ' · parcial' : '');
  }
  function profitCell(base, known, missing, cost) {
    if (!known) return 'sin coste';
    return money(base - cost) + (missing ? ' · parcial' : '');
  }
  function marginCell(base, known, missing, cost) {
    if (!known || missing || !base) return known && !missing && base ? '0 %' : 'sin coste';
    return ((base - cost) / base * 100).toFixed(1).replace('.', ',') + ' %';
  }
  VIEWS.beneficios = route => {
    const desde = route.q.desde || (defaultMonth() + '-01');
    const hasta = route.q.hasta || PL.monthEnd(defaultMonth());
    const orden = route.q.orden || 'beneficio';
    const b = PL.beneficios(S, desde, hasta);
    let clients = b.byClient.slice();
    const nameOf = id => (client(id) || {}).name || '';
    if (orden === 'cliente') clients.sort((a, c) => nameOf(a.clientId).localeCompare(nameOf(c.clientId), 'es'));
    else if (orden === 'ventas') clients.sort((a, c) => c.base - a.base);
    else clients.sort((a, c) => (c.base - (c.known ? c.cost : 0)) - (a.base - (a.known ? a.cost : 0)));
    const big = v => '<div class="val">' + v + '</div>';
    return head('Beneficios', 'Ventas por la base imponible, coste interno y margen. Una línea sin coste no cuenta como coste cero: queda fuera del porcentaje.', '<button class="btn ghost" data-act="excelBen">Excel</button>')
      + '<form class="card" data-form="verBen"><div class="filters"><div><label class="f">Desde</label><input type="date" name="desde" value="' + esc(desde) + '"></div>'
      + '<div><label class="f">Hasta</label><input type="date" name="hasta" value="' + esc(hasta) + '"></div>'
      + '<div><label class="f">Empresas</label><select><option>Empresa Demo</option></select></div>'
      + '<div><label class="f">Orden</label><select name="orden"><option value="beneficio"' + (orden === 'beneficio' ? ' selected' : '') + '>Beneficio</option><option value="ventas"' + (orden === 'ventas' ? ' selected' : '') + '>Ventas</option><option value="cliente"' + (orden === 'cliente' ? ' selected' : '') + '>Cliente</option></select></div></div>'
      + '<button class="btn" style="margin-top:10px">Calcular</button></form>'
      + '<div class="kpis k4"><div class="card kpi"><div class="lbl">VENTAS (BASE)</div>' + big(money(b.base)) + '</div>'
      + '<div class="card kpi"><div class="lbl">COSTE</div>' + big(b.none ? 'sin coste' : money(b.cost)) + '</div>'
      + '<div class="card kpi"><div class="lbl">BENEFICIO</div>' + big(b.none ? 'sin coste' : money(b.profit)) + '</div>'
      + '<div class="card kpi"><div class="lbl">MARGEN</div>' + big(b.none ? 'sin coste' : (b.margin == null ? 'parcial' : (b.margin.toFixed(1).replace('.', ',') + ' %'))) + '<div class="hint">' + (b.none ? money(b.base) + ' sin coste, fuera del %' : (b.full ? '' : 'Hay líneas sin coste')) + '</div></div></div>'
      + '<div class="sec-head"><h2>Por cliente</h2></div><div class="table-wrap"><table><thead><tr><th>Cliente</th><th class="r">Ventas</th><th class="r">Coste</th><th class="r">Beneficio</th><th class="r">Margen</th></tr></thead><tbody>'
      + clients.map(g => '<tr><td>' + esc(nameOf(g.clientId)) + '<div class="small muted">' + g.n + (g.n === 1 ? ' factura' : ' facturas') + '</div></td><td class="r">' + money(g.base) + '</td><td class="r">' + costCell(g.known, g.missing, g.cost) + '</td><td class="r">' + profitCell(g.base, g.known, g.missing, g.cost) + '</td><td class="r">' + marginCell(g.base, g.known, g.missing, g.cost) + '</td></tr>').join('')
      + '</tbody></table></div>'
      + '<div class="sec-head"><h2>Por factura</h2></div><div class="table-wrap"><table><thead><tr><th>Número</th><th>Cliente</th><th class="r">Base</th><th class="r">Coste</th><th class="r">Beneficio</th><th class="r">Margen</th></tr></thead><tbody>'
      + b.perInv.slice().sort((a, c) => c.t.base - a.t.base).map(row => '<tr><td><a href="#/factura/' + row.inv.id + '">' + esc(row.inv.num) + '</a></td><td>' + esc(nameOf(row.inv.clientId)) + '</td><td class="r">' + money(row.t.base) + '</td><td class="r">' + costCell(row.c.known, row.c.missing, row.c.cost) + '</td><td class="r">' + profitCell(row.t.base, row.c.known, row.c.missing, row.c.cost) + '</td><td class="r">' + marginCell(row.t.base, row.c.known, row.c.missing, row.c.cost) + '</td></tr>').join('')
      + '</tbody></table></div>';
  };

  VIEWS.informes = () => {
    const today = todayISO();
    const age = PL.aging(S, today);
    const ym = defaultMonth();
    const ig = PL.igicPeriod(S, ym + '-01', PL.monthEnd(ym));
    const tot = age.reduce((s, r) => s + r.total, 0);
    return head('Informes', 'Deuda de clientes e IGIC del mes con más facturas. Cálculo orientativo del piloto, no una liquidación presentada.')
      + '<div class="kpis"><div class="card kpi"><div class="lbl">Deuda viva</div><div class="val">' + money(tot) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">IGIC repercutido ' + esc(ym) + '</div><div class="val">' + money(ig.rep) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">Cuota orientativa</div><div class="val">' + money(ig.cuota) + '</div><div class="hint">Repercutido menos soportado</div></div></div>'
      + '<div class="card"><div class="row"><h3 class="grow">Antigüedad de deuda a ' + PL.fd(today) + '</h3><button class="btn ghost sm" data-act="excelDeuda">Excel</button></div>'
      + '<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Cliente</th><th class="r">Facturas</th><th class="r">0-30</th><th class="r">31-60</th><th class="r">61-90</th><th class="r">+90</th><th class="r">Total</th></tr></thead><tbody>'
      + age.slice(0, 25).map(r => '<tr><td>' + esc((client(r.clientId) || {}).name || '') + '</td><td class="r">' + r.n + '</td><td class="r">' + money(r.b0) + '</td><td class="r">' + money(r.b30) + '</td><td class="r">' + money(r.b60) + '</td><td class="r">' + money(r.b90) + '</td><td class="r">' + money(r.total) + '</td></tr>').join('')
      + '</tbody></table></div></div>';
  };

  VIEWS.verifactu = () => {
    const v = PL.verifyChain(S);
    const rows = S.chain.slice().reverse().slice(0, 40);
    return head('Cadena y registros', 'Cada alta y cada anulación alarga una cadena SHA-256 en este navegador. El envío a la AEAT es simulado.')
      + '<div class="' + (v.ok ? 'okbox' : 'badbox') + '">' + (v.ok ? 'Cadena íntegra · ' + v.count + ' registros.' : 'La cadena no cuadra (' + esc(v.reason || '') + ').') + ' <span class="hash">' + esc((v.head || '').slice(0, 24)) + '…</span></div>'
      + '<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Número</th><th>Fecha</th><th>Tipo</th><th>Total</th><th>AEAT</th><th>Huella</th></tr></thead><tbody>'
      + rows.map(r => '<tr><td>' + esc(r.num) + '</td><td>' + PL.fd(r.date) + '</td><td>' + esc(r.tipo) + '</td><td class="r">' + money(r.total) + '</td><td>' + (r.aeat === 'simulado' ? 'simulado' : 'no enviado') + '</td><td class="hash">' + esc(r.hash.slice(0, 18)) + '…</td></tr>').join('')
      + '</tbody></table></div><p class="hint">Se muestran los 40 registros más recientes. La verificación recorre la cadena entera.</p>';
  };
  VIEWS.actividad = () => head('Registro de actividad', 'Hechos guardados en este navegador.')
    + '<ul class="act">' + S.log.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.n || 0) - (a.n || 0)).slice(0, 200).map(a => '<li>' + esc(a.text) + ' · ' + PL.fd(a.date) + (a.ref ? ' · ' + esc(a.ref) : '') + '</li>').join('') + '</ul>';

  VIEWS.empresa = () => {
    const c = S.company;
    const fields = [['name', 'Razón social'], ['nif', 'NIF/CIF'], ['address', 'Dirección'], ['cp', 'CP'], ['city', 'Ciudad'], ['province', 'Provincia'], ['email', 'Correo'], ['phone', 'Teléfono'], ['mercantile', 'Registro mercantil'], ['iae', 'IAE'], ['iban', 'IBAN'], ['ibanBank', 'Banco del IBAN']];
    return head('Empresa', 'Este piloto carga solo Empresa Demo PAGUU SL (ficticia).')
      + '<form class="card" data-form="empresa"><div class="two">' + fields.map(([k, lab]) => '<div><label class="f">' + lab + '</label><input name="' + k + '" value="' + esc(c[k] || '') + '"></div>').join('') + '</div>'
      + '<p class="hint">El IAE figura como pendiente de confirmar. Cambiar el NIF no reescribe las huellas ya generadas: cada registro guarda el NIF usado en ese momento.</p><button class="btn">Guardar</button></form>'
      + '<div class="card"><img src="logo-demo.jpg" alt="Logo Empresa Demo" style="width:120px;height:120px;border-radius:50%;background:#fff"></div>';
  };
  VIEWS.numeracion = () => {
    const max = S.invoices.reduce((m, i) => Math.max(m, i.n), 0);
    const series = (S.seriesInfo || []).map(s => '<li>' + esc(s.nombre) + ' · ' + esc(s.tipo) + ' · próxima en origen ' + esc(String(s.proxima_numeracion)) + '</li>').join('');
    return head('Numeración', 'La serie viva es DM26 + el entero, sin ceros a la izquierda. Ejemplo: DM26154.')
      + '<div class="card"><p>Última factura en datos: <b>DM26' + max + '</b>. Siguiente emisión: <b>' + esc(S.company.serie + S.nextFac) + '</b>.</p>'
      + '<p class="hint">DM26154 a DM26158 son facturas de demostración (servicio de gestión, 100 € + IGIC 7 %). Por eso la siguiente no vuelve a 154. El histórico importado ocupa DM261 a DM26153, sin huecos.</p>'
      + '<form data-form="nextNum" class="row"><input name="next" inputmode="numeric" value="' + S.nextFac + '" style="max-width:140px" aria-label="Siguiente número"><button class="btn sec">Fijar siguiente</button></form></div>'
      + '<div class="card"><h3>Otras series leídas de la configuración</h3><p class="hint">Este piloto emite solo en DM26. El resto se muestra como referencia y no se usa.</p><ul class="act">' + series + '</ul></div>';
  };
  VIEWS.importar = () => head('Importación', 'Los clientes, proveedores y la serie salen de la configuración de demo. Las facturas DM261–DM26153 salen del histórico. DM26154–DM26158 son solo demo.')
    + '<div class="card"><p>En este navegador: <b>' + S.clients.length + '</b> clientes, <b>' + S.suppliers.length + '</b> proveedores, <b>' + S.invoices.length + '</b> facturas emitidas.</p>'
      + '<p class="hint">El histórico no trae desglose de IGIC: se importa como fruta y verdura al 0 % (base = total). Las de demo son servicio al 7 %.</p>'
      + '<div class="row"><label class="btn sec">Subir JSON o CSV<input type="file" accept=".json,.csv,text/csv,application/json" data-act-change="importFile" hidden></label>'
      + '<button class="btn bad" data-act="restore">Restaurar piloto demo</button></div>'
      + '<p class="hint">JSON con clientes/proveedores (como la exportación de fichas) añade contactos por NIF. CSV con columnas numero;fecha;cliente;base;igic;total;estado añade facturas que aún no existan y las encadena al final.</p></div>';

  VIEWS.albaranes = () => head('Albaranes', 'Se firman en pantalla y, a fin de mes, los firmados del mismo cliente pasan a una factura con relación.', '<a class="btn" href="#/nuevoalbaran">Nuevo albarán</a>')
    + (S.albaranes.slice().sort((a, b) => b.n - a.n).map(a => {
      const cl = client(a.clientId);
      const t = PL.totals(a);
      const st = a.invoicedIn ? 'facturado' : (a.signed ? 'firmado' : 'sin firmar');
      return '<a class="irow" href="#/albaran/' + a.id + '"><b>' + esc(a.num) + '</b><span class="mut">' + PL.fd(a.date) + '</span><span class="who">' + esc(cl ? cl.name : '') + '</span><span class="right"><span class="chip ' + (a.signed ? 'cobrada' : 'pend') + '">' + st + '</span><b>' + money(t.total) + '</b></span></a>';
    }).join('') || '<p class="muted">No hay albaranes.</p>');

  VIEWS.albaran = route => {
    const a = PL.byId(S.albaranes, route.id);
    if (!a) return '<div class="card">Albarán no encontrado.</div>';
    const cl = client(a.clientId) || { name: '', email: '', phone: '', nif: '' };
    const body = shareText(a);
    const inv = a.invoicedIn ? PL.byId(S.invoices, a.invoicedIn) : null;
    return head('Albarán ' + esc(a.num), esc(cl.name) + ' · ' + PL.fd(a.date), '<button class="btn" data-act="printAlb" data-id="' + a.id + '">Imprimir</button>')
      + '<p class="hint">El albarán no entra en la cadena Verifactu. La factura de fin de mes sí.</p>'
      + '<div class="card">' + lineTable(a) + '<div class="row" style="margin-top:8px"><b>Total ' + money(PL.totals(a).total) + '</b></div></div>'
      + '<div class="card"><div class="row">' + (a.signed ? '<span class="chip cobrada">Firmado · ' + esc(a.signed.name) + '</span>' : '<a class="btn" href="#/firmar/' + a.id + '">Firmar</a>')
      + '<a class="btn sec" href="' + esc(mailHref(cl.email, 'Albarán ' + a.num, body)) + '">Correo</a>'
      + (waHref(cl.phone, body) ? '<a class="btn sec" target="_blank" rel="noopener" href="' + esc(waHref(cl.phone, body)) + '">WhatsApp</a>' : '')
      + (inv ? '<a class="btn ghost" href="#/factura/' + inv.id + '">Facturado en ' + esc(inv.num) + '</a>' : '')
      + '</div>' + (a.signed ? '<div class="hash" style="margin-top:8px">' + esc(a.signed.hash) + '</div>' : '') + '</div>';
  };
  VIEWS.nuevoalbaran = () => {
    if (!DRAFT.alb) DRAFT.alb = { clientId: (S.clients.find(c => c.name.indexOf('FLEITAS') >= 0) || S.clients[0] || {}).id || '', date: todayISO(), lines: [Object.assign(blankLine(0), { desc: 'Plátano', pid: 'platano', price: '1,40', qty: '10' })] };
    const D = DRAFT.alb;
    return head('Nuevo albarán', 'Si la línea lleva producto, descuenta stock al guardarlo.')
      + '<form class="card" data-form="albaran"><div class="two"><div><label class="f">Cliente</label><select data-draft="alb:client:0">' + opts(S.clients, D.clientId) + '</select></div>'
      + '<div><label class="f">Fecha</label><input type="date" data-draft="alb:date:0" value="' + esc(D.date) + '"></div></div>' + editor('alb')
      + '<button class="btn" style="margin-top:12px">Crear albarán</button></form>';
  };
  VIEWS.fin = () => {
    const pending = S.albaranes.filter(a => a.signed && !a.invoicedIn);
    const unsigned = S.albaranes.filter(a => !a.signed && !a.invoicedIn);
    const by = new Map();
    for (const a of pending) { if (!by.has(a.clientId)) by.set(a.clientId, []); by.get(a.clientId).push(a); }
    let blocks = '';
    for (const [cid, list] of by) {
      const cl = client(cid);
      blocks += '<form class="card" data-form="finmes"><h3>' + esc(cl ? cl.name : cid) + '</h3><input type="hidden" name="date" value="' + todayISO() + '">'
        + list.map(a => '<label class="check"><input type="checkbox" name="ids" value="' + a.id + '" checked><span>' + esc(a.num) + ' · ' + PL.fd(a.date) + ' · ' + money(PL.totals(a).total) + '</span></label>').join('')
        + '<button class="btn" style="margin-top:8px">Facturar seleccionados</button></form>';
    }
    return head('Fin de mes', 'Agrupa albaranes firmados del mismo cliente en una factura con relación. Los no firmados se quedan fuera.')
      + (blocks || '<div class="card">No hay albaranes firmados pendientes de facturar.</div>')
      + (unsigned.length ? '<div class="card"><h3>Sin firmar</h3><ul class="act">' + unsigned.map(a => '<li><a href="#/albaran/' + a.id + '">' + esc(a.num) + '</a> · falta la firma</li>').join('') + '</ul></div>' : '');
  };

  VIEWS.stock = () => {
    const rows = PL.cuadre(S);
    return head('Stock y cuadre', 'Existencias por lote (FIFO). El contado del plátano viene 3 kg por debajo a propósito, para ver la diferencia.')
      + '<div class="table-wrap"><table><thead><tr><th>Producto</th><th class="r">Entradas</th><th class="r">Salidas</th><th class="r">Teórico</th><th class="r">Contado</th><th class="r">Diferencia</th><th class="r">Valor</th></tr></thead><tbody>'
      + rows.map(r => '<tr><td>' + esc(r.p.name) + '<div class="small muted">' + r.lots.map(l => esc(l.lot) + ' · ' + esc(l.origin) + ' · queda ' + PL.qtyText(l.left)).join('<br>') + '</div></td><td class="r">' + PL.qtyText(r.entradas) + '</td><td class="r">' + PL.qtyText(r.salidas) + '</td><td class="r">' + PL.qtyText(r.left) + '</td><td class="r"><input data-count="' + r.p.id + '" value="' + (r.counted == null ? '' : esc(PL.qtyText(r.counted))) + '" style="max-width:90px" aria-label="Contado ' + esc(r.p.name) + '"></td><td class="r">' + (r.diff == null ? '—' : PL.qtyText(r.diff)) + '</td><td class="r">' + money(r.value) + '</td></tr>').join('')
      + '</tbody></table></div><div class="row" style="margin-top:8px"><button class="btn sec" data-act="saveCounts">Guardar conteo</button></div>'
      + '<form class="card" data-form="entrada"><h3>Entrada de mercancía</h3><div class="filters"><div><label class="f">Producto</label><select name="pid">' + S.products.map(p => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('') + '</select></div>'
      + '<div><label class="f">Cantidad</label><input name="qty" placeholder="50"></div><div><label class="f">Coste €/ud</label><input name="cost" placeholder="0,95"></div><div><label class="f">Lote</label><input name="lot" placeholder="L-2026-10"></div></div>'
      + '<div class="two" style="margin-top:8px"><div><label class="f">Origen</label><input name="origin" value="Gran Canaria"></div><div><label class="f">Fecha</label><input type="date" name="date" value="' + todayISO() + '"></div></div>'
      + '<button class="btn" style="margin-top:10px">Dar entrada</button></form>';
  };
const CONTA_LINKS = [
    ['conta', 'Resumen'], ['plan', 'Plan'], ['diario', 'Diario'], ['mayor', 'Mayor'], ['sumas', 'Sumas y saldos'],
    ['balance', 'Balance'], ['pyg', 'PyG'], ['tesoreria', 'Tesorería'], ['igic', 'IGIC'], ['amort', 'Amortizaciones'],
    ['concilia', 'Conciliación'], ['cierre', 'Cierre'], ['existencias', 'Existencias']
  ];
  const CONTA_MENU = [
    ['plan', 'Plan de cuentas', 'PGC pyme editable, con cuentas de IGIC canario'],
    ['diario', 'Diario', 'Factura, albarán, cobro, pago, stock y asientos manuales'],
    ['mayor', 'Mayor', 'Movimientos y saldo de una cuenta'],
    ['sumas', 'Sumas y saldos', 'Balance de comprobación del periodo'],
    ['balance', 'Balance de situación', 'Activo, pasivo y patrimonio neto'],
    ['pyg', 'Pérdidas y ganancias', 'Ingresos, gastos y resultado'],
    ['tesoreria', 'Flujo de caja', 'Cobros, pagos y saldo de bancos'],
    ['igic', 'Libro de IGIC', 'Modelo 420 orientativo, por validar con asesor'],
    ['amort', 'Amortizaciones', 'Tabla lineal y asiento de cuota'],
    ['concilia', 'Conciliación bancaria', 'Importar CSV y casar solo si cuadra'],
    ['cierre', 'Cierre de ejercicio', 'Regularización, cierre y apertura'],
    ['existencias', 'Existencias', 'Valor de stock enlazado a la 300 y la 610']
  ];
  function defaultYear() { return defaultMonth().slice(0, 4); }
  function yearBounds(route) {
    const ano = String(route.q.ano || defaultYear()).replace(/[^\d]/g, '').slice(0, 4) || defaultYear();
    return { ano, desde: route.q.desde || (ano + '-01-01'), hasta: route.q.hasta || (ano + '-12-31') };
  }
  function contaNav(name) {
    return '<nav class="subnav" aria-label="Contabilidad">' + CONTA_LINKS.map(([id, label]) =>
      '<a href="#/' + id + '"' + (id === name ? ' class="on" aria-current="page"' : '') + '>' + label + '</a>').join('') + '</nav>';
  }
  function contaHead(name, title, sub, actions) {
    return contaNav(name) + head(title, sub, actions);
  }
  function periodBar(route, path) {
    const b = yearBounds(route);
    const q = route.q.q ? '<input type="hidden" name="q" value="' + esc(route.q.q) + '">' : '';
    const cuenta = route.q.cuenta ? '<input type="hidden" name="cuenta" value="' + esc(route.q.cuenta) + '">' : '';
    return '<form class="card" data-form="periodo" data-path="' + path + '"><div class="filters">'
      + '<div><label class="f">Ejercicio</label><input name="ano" inputmode="numeric" value="' + esc(b.ano) + '" aria-label="Ejercicio"></div>'
      + '<div><label class="f">Desde</label><input type="date" name="desde" value="' + esc(b.desde) + '"></div>'
      + '<div><label class="f">Hasta</label><input type="date" name="hasta" value="' + esc(b.hasta) + '"></div>'
      + '<div><label class="f">Aplicar</label><button class="btn">Ver periodo</button></div></div>' + q + cuenta + '</form>';
  }
  function bookBtns() {
    return '<button class="btn ghost sm" type="button" data-act="bookCsv">CSV</button><button class="btn ghost sm" type="button" data-act="bookPdf">PDF</button>';
  }
  function setBook(file, title, headers, rows, numericFrom) {
    BOOK = { file, title, headers, rows, numericFrom: numericFrom == null ? headers.length : numericFrom, subtitle: S.company.name + ' · CIF ' + S.company.nif };
  }
  function srcLabel(src) {
    return {
      'auto-factura': 'Factura', 'auto-cobro': 'Cobro', 'auto-compra': 'Compra', 'auto-pago': 'Pago',
      'auto-albaran': 'Albarán', 'auto-stock': 'Stock', manual: 'Manual', amort: 'Amortización',
      cuadre: 'Cuadre', regularizacion: 'Regularización', cierre: 'Cierre', apertura: 'Apertura'
    }[src] || src;
  }
  function accOpts(sel) {
    return PC.chart(S).map(a => '<option value="' + esc(a.code) + '"' + (a.code === sel ? ' selected' : '') + '>' + esc(a.code + ' · ' + a.name) + '</option>').join('');
  }
  function periodQuery(route, extra) {
    const b = yearBounds(route);
    let s = 'ano=' + encodeURIComponent(b.ano) + '&desde=' + encodeURIComponent(b.desde) + '&hasta=' + encodeURIComponent(b.hasta);
    if (extra) s += extra;
    return s;
  }
  function balAmount(R, code) {
    const bags = [R.balance.activo.anc, R.balance.activo.ex, R.balance.activo.deud, R.balance.activo.tes, R.balance.pasivo.pn, R.balance.pasivo.pnc, R.balance.pasivo.pc];
    for (const bag of bags) {
      const hit = bag.lines.find(l => l.code === code);
      if (hit) return hit.amount;
    }
    return 0;
  }
  function balTable(title, bag, q) {
    if (!bag || !bag.lines.length) return '';
    return '<h3 style="margin:14px 0 6px">' + title + '</h3><div class="table-wrap"><table><thead><tr><th>Cuenta</th><th class="r">Importe</th></tr></thead><tbody>'
      + bag.lines.map(l => '<tr><td>' + (l.code && l.code !== 'PyG' ? '<a href="#/mayor?cuenta=' + encodeURIComponent(l.code) + '&' + q + '">' + esc(l.code) + '</a> ' : '') + esc(l.name) + '</td><td class="r">' + money(l.amount) + '</td></tr>').join('')
      + '<tr><td><b>Total</b></td><td class="r"><b>' + money(bag.total) + '</b></td></tr></tbody></table></div>';
  }
  function pager(route, path, page, pages, extra) {
    if (pages <= 1) return '';
    const b = yearBounds(route);
    const q = route.q.q ? '&q=' + encodeURIComponent(route.q.q) : '';
    const href = p => '#/' + path + '?ano=' + b.ano + '&desde=' + b.desde + '&hasta=' + b.hasta + q + (extra || '') + '&pag=' + p;
    return '<div class="pager"><a class="btn ghost sm" href="' + href(Math.max(1, page - 1)) + '">Anterior</a><span class="muted">' + page + ' / ' + pages + '</span><a class="btn ghost sm" href="' + href(Math.min(pages, page + 1)) + '">Siguiente</a></div>';
  }

  VIEWS.conta = route => {
    const b = yearBounds(route);
    const R = PC.report(S, b.desde, b.hasta);
    const mes = Number(b.hasta.slice(5, 7)) || 10;
    const ig = PC.igic(S, PC.quarterRange(b.ano, Math.ceil(mes / 3)).from, PC.quarterRange(b.ano, Math.ceil(mes / 3)).to);
    const ql = PC.quarterRange(b.ano, Math.ceil(mes / 3)).label;
    return contaHead('conta', 'Contabilidad', 'Módulo completo de demo para una pyme canaria (IGIC). Partida doble sobre el PGC pyme. No son libros oficiales.')
      + periodBar(route, 'conta')
      + '<div class="kpis k4"><div class="card kpi"><div class="lbl">Resultado del periodo</div><div class="val">' + money(R.pyg.resultado) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">Clientes</div><div class="val">' + money(balAmount(R, '430')) + '</div><div class="hint">Saldo 430 a ' + PL.fd(b.hasta) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">Bancos</div><div class="val">' + money(balAmount(R, '572')) + '</div><div class="hint">Saldo 572</div></div>'
      + '<div class="card kpi"><div class="lbl">IGIC ' + esc(ql) + '</div><div class="val">' + money(ig.cuota) + '</div><div class="hint">Orientativo · por validar con asesor</div></div></div>'
      + '<div class="cards" style="margin-top:14px">' + CONTA_MENU.map(([id, t, d]) => '<a class="card" href="#/' + id + '?' + periodQuery(route) + '"><b>' + t + '</b><span class="muted small">' + d + '</span></a>').join('') + '</div>'
      + (R.sumas.cuadra && R.balance.cuadra ? '<p class="hint">En este periodo las sumas cuadran y el balance de situación cuadra.</p>' : '<div class="badbox">Revisa el periodo: las sumas o el balance no cuadran.</div>');
  };

  VIEWS.plan = () => {
    const rows = PC.allAccounts(S);
    setBook('plan-cuentas', 'Plan de cuentas', ['Código', 'Nombre', 'Grupo', 'Activa'], rows.map(a => [a.code, a.name, a.group, a.active === false ? 'no' : 'sí']), 4);
    return contaHead('plan', 'Plan de cuentas', 'PGC de pymes con subcuentas de IGIC (Canarias). Puedes renombrar, dar de alta y desactivar.', bookBtns())
      + '<div class="table-wrap"><table><thead><tr><th>Código</th><th>Nombre</th><th></th></tr></thead><tbody>'
      + rows.map(a => '<tr><td><b>' + esc(a.code) + '</b></td><td><form data-form="renCuenta" class="row"><input type="hidden" name="code" value="' + esc(a.code) + '"><input name="name" value="' + esc(a.name) + '" aria-label="Nombre ' + esc(a.code) + '"><button class="btn sec sm" type="submit">Guardar</button></form></td><td>'
      + (a.active === false
        ? '<button class="btn ghost sm" type="button" data-act="cuentaActiva" data-code="' + esc(a.code) + '" data-on="1">Activar</button>'
        : '<button class="btn ghost sm" type="button" data-act="cuentaActiva" data-code="' + esc(a.code) + '" data-on="0">Desactivar</button>')
      + '</td></tr>').join('')
      + '</tbody></table></div>'
      + '<form class="card" data-form="nuevaCuenta"><h3>Nueva cuenta</h3><div class="filters"><div><label class="f">Código</label><input name="code" placeholder="6291" inputmode="numeric"></div><div><label class="f">Nombre</label><input name="name" placeholder="Otros servicios · mensajería"></div><div><label class="f">Alta</label><button class="btn">Añadir al plan</button></div></div>'
      + '<p class="hint">Grupo 1 a 7, mínimo 3 dígitos. 472 y 477 son IGIC soportado y repercutido. 4700 y 4750 son la Hacienda deudora y acreedora por IGIC.</p></form>';
  };

  VIEWS.diario = route => {
    const b = yearBounds(route);
    const R = PC.report(S, b.desde, b.hasta);
    const q = (route.q.q || '').trim().toLowerCase();
    const filtered = R.entries.filter(e => {
      if (!q) return true;
      if (e.concept.toLowerCase().indexOf(q) >= 0) return true;
      if (srcLabel(e.source).toLowerCase().indexOf(q) >= 0) return true;
      if (String(e.n) === q) return true;
      return e.lines.some(l => l.code.indexOf(q) === 0 || PC.accName(S, l.code).toLowerCase().indexOf(q) >= 0);
    });
    const flat = [];
    for (const e of filtered) {
      e.lines.forEach((ln, i) => flat.push([
        i ? '' : PL.fd(e.date),
        i ? '' : String(e.n),
        i ? '' : e.concept,
        ln.code + ' ' + PC.accName(S, ln.code),
        ln.debe ? PL.eurPlain(ln.debe) : '',
        ln.haber ? PL.eurPlain(ln.haber) : '',
        i ? '' : srcLabel(e.source)
      ]));
    }
    setBook('diario-' + b.ano, 'Libro diario ' + PL.fd(b.desde) + ' a ' + PL.fd(b.hasta), ['Fecha', 'Asiento', 'Concepto', 'Cuenta', 'Debe', 'Haber', 'Origen'], flat, 4);
    const per = 12;
    const pages = Math.max(1, Math.ceil(filtered.length / per));
    const page = Math.min(pages, Math.max(1, Number(route.q.pag) || 1));
    const slice = filtered.slice((page - 1) * per, page * per);
    if (!DRAFT.ast) DRAFT.ast = { date: todayISO(), concept: '', lines: [{ code: '629', debe: '', haber: '' }, { code: '572', debe: '', haber: '' }] };
    const D = DRAFT.ast;
    let debe = 0, haber = 0;
    D.lines.forEach(ln => { debe += PL.parseEur(ln.debe) || 0; haber += PL.parseEur(ln.haber) || 0; });
    const astEstado = !debe && !haber ? 'Sin importes' : ((debe === haber ? 'Cuadra · ' : 'No cuadra · ') + money(debe) + ' / ' + money(haber));
    const body = slice.map(e => {
      const link = e.source === 'auto-factura' ? ' <a href="#/factura/' + esc(e.ref) + '">ver</a>'
        : (e.source === 'auto-albaran' ? ' <a href="#/albaran/' + esc(e.ref) + '">ver</a>' : '');
      const del = (e.source === 'manual' || e.source === 'amort' || e.source === 'cuadre')
        ? ' <button class="btn ghost sm" type="button" data-act="delAsiento" data-id="' + esc(e.id) + '">Eliminar</button>' : '';
      const headRow = '<tr><td>' + PL.fd(e.date) + '</td><td>' + e.n + '</td><td>' + esc(e.concept) + link + '</td><td>' + esc(e.lines[0].code) + ' ' + esc(PC.accName(S, e.lines[0].code)) + '</td><td class="r">' + (e.lines[0].debe ? money(e.lines[0].debe) : '') + '</td><td class="r">' + (e.lines[0].haber ? money(e.lines[0].haber) : '') + '</td><td><span class="chip mut">' + esc(srcLabel(e.source)) + '</span>' + del + '</td></tr>';
      return headRow + e.lines.slice(1).map(ln => '<tr><td></td><td></td><td></td><td>' + esc(ln.code) + ' ' + esc(PC.accName(S, ln.code)) + '</td><td class="r">' + (ln.debe ? money(ln.debe) : '') + '</td><td class="r">' + (ln.haber ? money(ln.haber) : '') + '</td><td></td></tr>').join('');
    }).join('');
    return contaHead('diario', 'Diario', 'Los asientos de factura, cobro, compra, pago, albarán y stock se recalculan solos. El manual, la amortización y el cuadre se guardan en este navegador.', bookBtns())
      + periodBar(route, 'diario')
      + '<form class="card" data-form="buscaDiario" data-path="diario"><div class="row"><input name="q" value="' + esc(route.q.q || '') + '" placeholder="Buscar concepto, cuenta o número" aria-label="Buscar en el diario"><button class="btn sec">Buscar</button></div></form>'
      + '<div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Fecha</th><th>Nº</th><th>Concepto</th><th>Cuenta</th><th class="r">Debe</th><th class="r">Haber</th><th>Origen</th></tr></thead><tbody>'
      + (body || '<tr><td colspan="7">No hay asientos en el periodo.</td></tr>') + '</tbody></table></div>'
      + pager(route, 'diario', page, pages)
      + '<p class="hint">' + filtered.length + ' asientos. Se muestran ' + per + ' por página. El CSV y el PDF llevan el diario filtrado entero.</p>'
      + '<form class="card" data-form="asiento"><h3>Asiento manual</h3><div class="two"><div><label class="f">Fecha</label><input type="date" data-ast="date" value="' + esc(D.date) + '"></div><div><label class="f">Concepto</label><input data-ast="concept" value="' + esc(D.concept) + '" placeholder="Alquiler de octubre"></div></div>'
      + D.lines.map((ln, i) => '<div class="ast"><select data-ast="code:' + i + '" aria-label="Cuenta">' + accOpts(ln.code) + '</select><input data-ast="debe:' + i + '" value="' + esc(ln.debe) + '" placeholder="Debe" inputmode="decimal" aria-label="Debe"><input data-ast="haber:' + i + '" value="' + esc(ln.haber) + '" placeholder="Haber" inputmode="decimal" aria-label="Haber"><button class="x" type="button" data-act="delAst" data-i="' + i + '" aria-label="Quitar línea">×</button></div>').join('')
      + '<div class="row" style="margin-top:8px"><button class="btn ghost" type="button" data-act="addAst">Añadir línea</button><span id="ast-bal" class="muted">' + astEstado + '</span><button class="btn">Guardar asiento</button></div>'
      + '<p class="hint">Tiene que cuadrar al céntimo. No se guarda en un ejercicio cerrado.</p></form>';
  };

  VIEWS.mayor = route => {
    const b = yearBounds(route);
    const code = route.q.cuenta || '430';
    const M = PC.mayor(S, code, b.desde, b.hasta);
    setBook('mayor-' + code, 'Mayor ' + code + ' ' + M.name, ['Fecha', 'Asiento', 'Concepto', 'Debe', 'Haber', 'Saldo'],
      [['', '', 'Saldo anterior', '', '', PL.eurPlain(M.anterior)]].concat(M.rows.map(r => [PL.fd(r.date), r.n, r.concept, r.debe ? PL.eurPlain(r.debe) : '', r.haber ? PL.eurPlain(r.haber) : '', PL.eurPlain(r.saldo)])), 3);
    return contaHead('mayor', 'Mayor', M.code + ' · ' + M.name, bookBtns())
      + periodBar(route, 'mayor')
      + '<form class="card" data-form="eligeCuenta"><label class="f">Cuenta</label><div class="row"><select name="cuenta">' + accOpts(code) + '</select><button class="btn sec">Ver mayor</button></div></form>'
      + '<div class="kpis"><div class="card kpi"><div class="lbl">Saldo anterior</div><div class="val">' + money(M.anterior) + '</div></div><div class="card kpi"><div class="lbl">Saldo final</div><div class="val">' + money(M.saldo) + '</div></div><div class="card kpi"><div class="lbl">Apuntes</div><div class="val">' + M.rows.length + '</div></div></div>'
      + '<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Fecha</th><th>Nº</th><th>Concepto</th><th class="r">Debe</th><th class="r">Haber</th><th class="r">Saldo</th></tr></thead><tbody>'
      + '<tr><td colspan="3">Saldo anterior</td><td></td><td></td><td class="r">' + money(M.anterior) + '</td></tr>'
      + (M.rows.map(r => '<tr><td>' + PL.fd(r.date) + '</td><td>' + r.n + '</td><td>' + esc(r.concept) + '</td><td class="r">' + (r.debe ? money(r.debe) : '') + '</td><td class="r">' + (r.haber ? money(r.haber) : '') + '</td><td class="r">' + money(r.saldo) + '</td></tr>').join('') || '<tr><td colspan="6">Sin movimientos en el periodo.</td></tr>')
      + '</tbody></table></div>';
  };

  VIEWS.sumas = route => {
    const b = yearBounds(route);
    const R = PC.report(S, b.desde, b.hasta);
    const q = periodQuery(route);
    setBook('sumas-saldos-' + b.ano, 'Sumas y saldos ' + PL.fd(b.desde) + ' a ' + PL.fd(b.hasta),
      ['Cuenta', 'Nombre', 'Debe', 'Haber', 'Saldo deudor', 'Saldo acreedor'],
      R.sumas.list.map(a => [a.code, a.name, PL.eurPlain(a.debe), PL.eurPlain(a.haber), PL.eurPlain(a.saldoDebe), PL.eurPlain(a.saldoHaber)])
        .concat([['', 'Sumas', PL.eurPlain(R.sumas.debe), PL.eurPlain(R.sumas.haber), PL.eurPlain(R.sumas.saldoDebe), PL.eurPlain(R.sumas.saldoHaber)]]), 2);
    return contaHead('sumas', 'Sumas y saldos', 'Movimientos del ' + PL.fd(b.desde) + ' al ' + PL.fd(b.hasta) + '. El cierre y la regularización no entran aquí: se ven en el diario.', bookBtns())
      + periodBar(route, 'sumas')
      + (R.sumas.cuadra ? '<div class="okbox">Sumas del debe y del haber iguales: ' + money(R.sumas.debe) + '. Saldos también cuadran.</div>' : '<div class="badbox">Las sumas no cuadran.</div>')
      + '<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Cuenta</th><th class="r">Debe</th><th class="r">Haber</th><th class="r">Saldo deudor</th><th class="r">Saldo acreedor</th></tr></thead><tbody>'
      + R.sumas.list.map(a => '<tr><td><a href="#/mayor?cuenta=' + encodeURIComponent(a.code) + '&' + q + '">' + esc(a.code) + '</a> ' + esc(a.name) + '</td><td class="r">' + money(a.debe) + '</td><td class="r">' + money(a.haber) + '</td><td class="r">' + money(a.saldoDebe) + '</td><td class="r">' + money(a.saldoHaber) + '</td></tr>').join('')
      + '<tr><td><b>Totales</b></td><td class="r"><b>' + money(R.sumas.debe) + '</b></td><td class="r"><b>' + money(R.sumas.haber) + '</b></td><td class="r"><b>' + money(R.sumas.saldoDebe) + '</b></td><td class="r"><b>' + money(R.sumas.saldoHaber) + '</b></td></tr></tbody></table></div>';
  };

  VIEWS.balance = route => {
    const b = yearBounds(route);
    const R = PC.report(S, b.desde, b.hasta);
    const q = periodQuery(route);
    const A = R.balance.activo, P = R.balance.pasivo;
    const rows = [];
    const push = (sec, bag) => bag.lines.forEach(l => rows.push([sec, (l.code ? l.code + ' ' : '') + l.name, PL.eurPlain(l.amount)]));
    push('Activo no corriente', A.anc); push('Existencias', A.ex); push('Deudores', A.deud); push('Tesorería', A.tes);
    push('Patrimonio neto', P.pn); push('Pasivo no corriente', P.pnc); push('Pasivo corriente', P.pc);
    rows.push(['', 'Total activo', PL.eurPlain(A.total)]);
    rows.push(['', 'Total patrimonio y pasivo', PL.eurPlain(P.total)]);
    setBook('balance-' + b.hasta, 'Balance de situación a ' + PL.fd(b.hasta), ['Sección', 'Cuenta', 'Importe'], rows, 2);
    return contaHead('balance', 'Balance de situación', 'Saldos a ' + PL.fd(b.hasta) + '. El resultado del periodo entra en el patrimonio para que el balance cuadre antes del cierre.', bookBtns())
      + periodBar(route, 'balance')
      + (R.balance.cuadra ? '<div class="okbox">Activo ' + money(A.total) + ' = patrimonio y pasivo ' + money(P.total) + '.</div>' : '<div class="badbox">El balance no cuadra.</div>')
      + '<div class="two" style="margin-top:12px"><div class="card"><h2>Activo</h2>' + balTable('Activo no corriente', A.anc, q) + balTable('Existencias', A.ex, q) + balTable('Deudores', A.deud, q) + balTable('Tesorería', A.tes, q) + '<p class="bigmoney">' + money(A.total) + '</p></div>'
      + '<div class="card"><h2>Patrimonio neto y pasivo</h2>' + balTable('Patrimonio neto', P.pn, q) + balTable('Pasivo no corriente', P.pnc, q) + balTable('Pasivo corriente', P.pc, q) + '<p class="bigmoney">' + money(P.total) + '</p></div></div>';
  };

  VIEWS.pyg = route => {
    const b = yearBounds(route);
    const R = PC.report(S, b.desde, b.hasta);
    const q = periodQuery(route);
    const rows = [['Ingresos', '', '']].concat(R.pyg.ingresos.map(a => [a.code, a.name, PL.eurPlain(a.amount)]), [['', 'Total ingresos', PL.eurPlain(R.pyg.totalIng)]], [['Gastos', '', '']], R.pyg.gastos.map(a => [a.code, a.name, PL.eurPlain(a.amount)]), [['', 'Total gastos', PL.eurPlain(R.pyg.totalGas)]], [['', 'Resultado', PL.eurPlain(R.pyg.resultado)]]);
    setBook('pyg-' + b.ano, 'Cuenta de pérdidas y ganancias ' + PL.fd(b.desde) + ' a ' + PL.fd(b.hasta), ['Cuenta', 'Nombre', 'Importe'], rows, 2);
    const lineRow = a => '<tr><td><a href="#/mayor?cuenta=' + encodeURIComponent(a.code) + '&' + q + '">' + esc(a.code) + '</a> ' + esc(a.name) + '</td><td class="r">' + money(a.amount) + '</td></tr>';
    return contaHead('pyg', 'Pérdidas y ganancias', 'Del ' + PL.fd(b.desde) + ' al ' + PL.fd(b.hasta) + '. Una variación de existencias negativa es aumento de stock y mejora el resultado.', bookBtns())
      + periodBar(route, 'pyg')
      + '<div class="kpis"><div class="card kpi"><div class="lbl">Ingresos</div><div class="val">' + money(R.pyg.totalIng) + '</div></div><div class="card kpi"><div class="lbl">Gastos</div><div class="val">' + money(R.pyg.totalGas) + '</div></div><div class="card kpi"><div class="lbl">Resultado</div><div class="val">' + money(R.pyg.resultado) + '</div></div></div>'
      + '<div class="two" style="margin-top:14px"><div class="card"><h3>Ingresos</h3><div class="table-wrap" style="margin-top:8px"><table><tbody>' + (R.pyg.ingresos.map(lineRow).join('') || '<tr><td>Sin ingresos</td><td></td></tr>') + '<tr><td><b>Total</b></td><td class="r"><b>' + money(R.pyg.totalIng) + '</b></td></tr></tbody></table></div></div>'
      + '<div class="card"><h3>Gastos</h3><div class="table-wrap" style="margin-top:8px"><table><tbody>' + (R.pyg.gastos.map(lineRow).join('') || '<tr><td>Sin gastos</td><td></td></tr>') + '<tr><td><b>Total</b></td><td class="r"><b>' + money(R.pyg.totalGas) + '</b></td></tr></tbody></table></div></div></div>';
  };

  VIEWS.tesoreria = route => {
    const b = yearBounds(route);
    const R = PC.report(S, b.desde, b.hasta);
    const C = R.cash;
    setBook('flujo-caja-' + b.ano, 'Flujo de caja ' + PL.fd(b.desde) + ' a ' + PL.fd(b.hasta),
      ['Fecha', 'Concepto', 'Cuenta', 'Contrapartida', 'Entrada', 'Salida'],
      C.rows.map(r => [PL.fd(r.date), r.concept, r.code, r.contra, r.entra ? PL.eurPlain(r.entra) : '', r.sale ? PL.eurPlain(r.sale) : '']), 4);
    const bankRows = (S.bank || []).filter(x => x.date >= b.desde && x.date <= b.hasta);
    const extIn = bankRows.filter(x => x.amount > 0).reduce((s, x) => s + x.amount, 0);
    const extOut = bankRows.filter(x => x.amount < 0).reduce((s, x) => s + -x.amount, 0);
    return contaHead('tesoreria', 'Flujo de caja', 'Tesorería según el mayor de las cuentas 570 y 572. El extracto incluye movimientos aún no casados.', bookBtns())
      + periodBar(route, 'tesoreria')
      + '<div class="kpis k4"><div class="card kpi"><div class="lbl">Saldo inicial</div><div class="val">' + money(C.inicial) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">Entradas</div><div class="val">' + money(C.entradas) + '</div><div class="hint">Cobros de clientes ' + money(C.tipo.cobros) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">Salidas</div><div class="val">' + money(C.salidas) + '</div><div class="hint">Pagos a proveedores ' + money(C.tipo.pagos) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">Saldo final</div><div class="val">' + money(C.final) + '</div></div></div>'
      + '<div class="card"><p>Extracto del periodo (cuenta operativa de banco, casada o no): entradas ' + money(extIn) + ' · salidas ' + money(extOut) + ' · neto ' + money(extIn - extOut) + '.</p>'
      + '<p class="hint">La diferencia con el mayor son partidas sin casar o asientos manuales a banco. Se revisan en Conciliación. Un cobro solo pasa al mayor cuando el importe cuadra.</p></div>'
      + '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Cuenta</th><th>Contra</th><th class="r">Entrada</th><th class="r">Salida</th></tr></thead><tbody>'
      + (C.rows.map(r => '<tr><td>' + PL.fd(r.date) + '</td><td>' + esc(r.concept) + '</td><td>' + esc(r.code) + '</td><td>' + esc(r.contra) + '</td><td class="r">' + (r.entra ? money(r.entra) : '') + '</td><td class="r">' + (r.sale ? money(r.sale) : '') + '</td></tr>').join('') || '<tr><td colspan="6">Sin movimientos de tesorería en el periodo.</td></tr>')
      + '</tbody></table></div>';
  };

  VIEWS.igic = route => {
    const ano = (route.q.ano || defaultYear()).replace(/[^\d]/g, '').slice(0, 4) || defaultYear();
    const t = String(route.q.t || '4');
    const range = t === '0' ? { from: ano + '-01-01', to: ano + '-12-31', label: 'Ejercicio ' + ano, q: 0 } : PC.quarterRange(ano, t);
    const G = PC.igic(S, range.from, range.to);
    const rows = [['Expedida', '', '', '', '', '', '', '', '']].concat(G.expedidas.map(r => ['Expedida', PL.fd(r.date), r.num, r.name, r.nif, PL.eurPlain(r.b0), PL.eurPlain(r.b7), PL.eurPlain(r.cuota), PL.eurPlain(r.total)]))
      .concat([['Recibida', '', '', '', '', '', '', '', '']], G.recibidas.map(r => ['Recibida', PL.fd(r.date), r.num, r.name, r.nif, PL.eurPlain(r.b0), PL.eurPlain(r.b7), PL.eurPlain(r.cuota), PL.eurPlain(r.total)]),
        [['', '', '', 'Cuota repercutida', '', '', '', PL.eurPlain(G.rep), ''], ['', '', '', 'Cuota soportada', '', '', '', PL.eurPlain(G.sop), ''], ['', '', '', 'Resultado', '', '', '', PL.eurPlain(G.cuota), '']]);
    setBook('libro-igic-' + range.label.replace(/\s/g, ''), 'Libro de IGIC ' + range.label, ['Libro', 'Fecha', 'Número', 'Tercero', 'NIF', 'Base 0%', 'Base 7%', 'Cuota', 'Total'], rows, 5);
    const opt = ['1', '2', '3', '4', '0'].map(n => '<option value="' + n + '"' + (t === n ? ' selected' : '') + '>' + (n === '0' ? 'Año completo' : n + 'T') + '</option>').join('');
    const libro = (title, list) => '<div class="card"><h3>' + title + '</h3><div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Fecha</th><th>Número</th><th>Tercero</th><th>NIF</th><th class="r">Base 0 %</th><th class="r">Base 7 %</th><th class="r">Cuota</th><th class="r">Total</th></tr></thead><tbody>'
      + (list.map(r => '<tr><td>' + PL.fd(r.date) + '</td><td>' + esc(r.num) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.nif) + '</td><td class="r">' + money(r.b0) + '</td><td class="r">' + money(r.b7) + '</td><td class="r">' + money(r.cuota) + '</td><td class="r">' + money(r.total) + '</td></tr>').join('') || '<tr><td colspan="8">Sin facturas en el periodo.</td></tr>')
      + '</tbody></table></div></div>';
    return contaHead('igic', 'Libro de IGIC', 'Liquidación orientativa del modelo 420 (régimen general, IGIC).', bookBtns())
      + '<div class="warnbox">' + esc(G.aviso) + ' El resumen anual equivalente sería el modelo 415 y tampoco se presenta desde este piloto.</div>'
      + '<form class="card" data-form="igicPeriod"><div class="filters"><div><label class="f">Ejercicio</label><input name="ano" value="' + esc(ano) + '" inputmode="numeric"></div><div><label class="f">Periodo</label><select name="t">' + opt + '</select></div><div><label class="f">Ver</label><button class="btn">Calcular</button></div></div></form>'
      + '<div class="kpis k4"><div class="card kpi"><div class="lbl">IGIC repercutido</div><div class="val">' + money(G.rep) + '</div></div><div class="card kpi"><div class="lbl">IGIC soportado</div><div class="val">' + money(G.sop) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">' + (G.cuota >= 0 ? 'A ingresar' : 'A compensar') + '</div><div class="val">' + money(G.cuota >= 0 ? G.aIngresar : G.aCompensar) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">Resultado ' + esc(range.label) + '</div><div class="val">' + money(G.cuota) + '</div><div class="hint">Repercutido menos soportado</div></div></div>'
      + '<div class="card"><h3>Desglose por tipo</h3><div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Tipo</th><th class="r">Base ventas</th><th class="r">Cuota repercutida</th><th class="r">Base compras</th><th class="r">Cuota soportada</th></tr></thead><tbody>'
      + (function () {
        const rates = new Set(G.tasasE.map(x => x.rate).concat(G.tasasR.map(x => x.rate)));
        const list = [...rates].sort((a, c) => a - c);
        if (!list.length) return '<tr><td colspan="5">Sin bases en el periodo.</td></tr>';
        return list.map(rate => {
          const e = G.tasasE.find(x => x.rate === rate) || { base: 0, cuota: 0 };
          const r = G.tasasR.find(x => x.rate === rate) || { base: 0, cuota: 0 };
          const name = rate === 0 ? 'Tipo cero 0 % (fruta y verdura)' : (rate === 7 ? 'Tipo general 7 %' : ('Tipo ' + rate + ' %'));
          return '<tr><td>' + name + '</td><td class="r">' + money(e.base) + '</td><td class="r">' + money(e.cuota) + '</td><td class="r">' + money(r.base) + '</td><td class="r">' + money(r.cuota) + '</td></tr>';
        }).join('');
      })()
      + '</tbody></table></div><p class="hint">Casillas orientativas del 420: base y cuota devengadas, IGIC deducible y resultado. Por validar con asesor antes de cualquier presentación.</p></div>'
      + libro('Facturas expedidas', G.expedidas) + libro('Facturas recibidas', G.recibidas);
  };

  VIEWS.amort = route => {
    PC.ensure(S);
    const ano = (route.q.ano || defaultYear()).replace(/[^\d]/g, '').slice(0, 4) || defaultYear();
    const rows = S.activos.map(a => {
      const q = PC.cuota(S, a, ano);
      const hecho = (S.asientos || []).some(x => x.source === 'amort' && x.ref === a.id && String(x.date).slice(0, 4) === ano);
      return { a, q, hecho };
    });
    setBook('amortizaciones-' + ano, 'Cuadro de amortización ' + ano, ['Bien', 'Alta', 'Valor', 'Residual', 'Años', 'Cuenta', 'Cuota ' + ano, 'Estado'],
      rows.map(r => [r.a.name, PL.fd(r.a.fecha), PL.eurPlain(r.a.valor), PL.eurPlain(r.a.residual || 0), r.a.anos, r.a.cuenta + ' / ' + r.a.acum + ' / ' + r.a.gasto, PL.eurPlain(r.q), r.hecho ? 'contabilizada' : 'pendiente']), 6);
    return contaHead('amort', 'Amortizaciones', 'Método lineal. El año de alta se prorratea por meses, incluido el mes de compra.', bookBtns())
      + '<form class="card" data-form="amortAno"><div class="row"><label class="f">Ejercicio</label><input name="ano" value="' + esc(ano) + '" style="max-width:120px" inputmode="numeric"><button class="btn sec">Ver cuotas</button></div></form>'
      + '<div class="table-wrap"><table><thead><tr><th>Bien</th><th>Alta</th><th class="r">Valor</th><th class="r">Vida</th><th class="r">Cuota ' + esc(ano) + '</th><th>Cuentas</th><th></th></tr></thead><tbody>'
      + (rows.map(r => '<tr><td>' + esc(r.a.name) + '</td><td>' + PL.fd(r.a.fecha) + '</td><td class="r">' + money(r.a.valor) + '</td><td class="r">' + r.a.anos + ' años</td><td class="r">' + money(r.q) + '</td><td class="small">' + esc(r.a.gasto) + ' / ' + esc(r.a.acum) + '</td><td>'
        + (r.hecho ? '<span class="chip cobrada">Contabilizada</span>' : '<button class="btn sm" type="button" data-act="postAmort" data-id="' + esc(r.a.id) + '" data-ano="' + esc(ano) + '">Asiento</button>')
        + ' <button class="btn ghost sm" type="button" data-act="delActivo" data-id="' + esc(r.a.id) + '">Quitar</button></td></tr>').join('') || '<tr><td colspan="7">No hay bienes.</td></tr>')
      + '</tbody></table></div>'
      + '<form class="card" data-form="nuevoActivo"><h3>Nuevo bien</h3><div class="filters"><div><label class="f">Descripción</label><input name="name" placeholder="Furgoneta reparto"></div><div><label class="f">Fecha de alta</label><input type="date" name="fecha" value="' + todayISO() + '"></div><div><label class="f">Valor €</label><input name="valor" placeholder="18000,00" inputmode="decimal"></div><div><label class="f">Años</label><input name="anos" value="6" inputmode="numeric"></div></div>'
      + '<div class="filters" style="margin-top:8px"><div><label class="f">Residual €</label><input name="residual" value="0"></div><div><label class="f">Cuenta inmovilizado</label><select name="cuenta">' + accOpts('218') + '</select></div><div><label class="f">Amortización acumulada</label><select name="acum">' + accOpts('281') + '</select></div><div><label class="f">Gasto</label><select name="gasto">' + accOpts('681') + '</select></div></div>'
      + '<button class="btn" style="margin-top:10px">Añadir a la tabla</button></form>';
  };

  VIEWS.concilia = route => {
    const b = yearBounds(route);
    const R = PC.report(S, '2000-01-01', b.hasta);
    const sug = PC.sugerencias(S).filter(s => s.bank.date >= b.desde && s.bank.date <= b.hasta);
    const libro = R.cash.final;
    const extracto = (S.bank || []).filter(x => x.date <= b.hasta).reduce((s, x) => s + x.amount, 0);
    const rows = (S.bank || []).filter(x => x.date >= b.desde && x.date <= b.hasta).slice().sort((a, c) => a.date < c.date ? -1 : 1);
    setBook('conciliacion-' + b.ano, 'Conciliación bancaria ' + PL.fd(b.desde) + ' a ' + PL.fd(b.hasta),
      ['Fecha', 'Concepto', 'Importe', 'Estado'],
      rows.map(x => {
        const inv = x.invoiceId ? PL.byId(S.invoices, x.invoiceId) : null;
        const rec = x.receivedId ? PL.byId(S.received, x.receivedId) : null;
        return [PL.fd(x.date), x.concept, PL.eurPlain(x.amount), inv ? ('Cobro ' + inv.num) : (rec ? ('Pago ' + rec.num) : 'Sin casar')];
      }), 2);
    return contaHead('concilia', 'Conciliación bancaria', 'Regla del piloto: una factura queda cobrada solo si el ingreso cuadra al céntimo con el total.', bookBtns())
      + '<div class="warnbox">Cobrado solo si cuadra. Si el importe del banco no coincide, la factura sigue emitida. Lo mismo para el pago a proveedor.</div>'
      + periodBar(route, 'concilia')
      + '<div class="kpis"><div class="card kpi"><div class="lbl">Saldo mayor 570+572</div><div class="val">' + money(libro) + '</div><div class="hint">A ' + PL.fd(b.hasta) + '</div></div>'
      + '<div class="card kpi"><div class="lbl">Saldo extracto</div><div class="val">' + money(extracto) + '</div><div class="hint">Suma de movimientos hasta esa fecha</div></div>'
      + '<div class="card kpi"><div class="lbl">Diferencia</div><div class="val">' + money(extracto - libro) + '</div><div class="hint">Pendiente de casar o asiento manual</div></div></div>'
      + '<div class="two"><form class="card" data-form="importExtracto"><h3>Importar CSV</h3><p class="hint">Columnas fecha;concepto;importe (o debe y haber). El importe negativo es un cargo. Importar no marca nada como cobrado.</p><input type="file" name="file" accept=".csv,text/csv" required><button class="btn" style="margin-top:8px">Cargar extracto</button> <button class="btn ghost" type="button" data-act="plantillaCsv">Plantilla</button></form>'
      + '<div class="card"><h3>Casar importes exactos</h3><p class="hint">Solo empareja cuando hay una sola factura emitida (o una sola recibida) con el mismo importe en céntimos.</p><button class="btn" type="button" data-act="casarExactos">Casar los que cuadran</button></div></div>'
      + '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="r">Importe</th><th>Casación</th></tr></thead><tbody>'
      + (rows.map(x => {
        const inv = x.invoiceId ? PL.byId(S.invoices, x.invoiceId) : null;
        const rec = x.receivedId ? PL.byId(S.received, x.receivedId) : null;
        const s = sug.find(g => g.bank.id === x.id);
        let estado = '<span class="chip pend">Sin casar</span>';
        if (inv) estado = '<a href="#/factura/' + inv.id + '">Cobro ' + esc(inv.num) + '</a>';
        else if (rec) estado = 'Pago ' + esc(rec.num);
        else if (s && s.cuadra) estado = '<span class="chip cobrada">Cuadra con ' + esc(s.docs[0].num) + '</span>';
        else if (s && s.docs.length > 1) estado = '<span class="chip pend">' + s.docs.length + ' documentos con el mismo importe</span>';
        else estado = '<span class="chip mut">No cuadra · no se cobra</span>';
        return '<tr><td>' + PL.fd(x.date) + '</td><td>' + esc(x.concept) + '</td><td class="r">' + money(x.amount) + '</td><td>' + estado + '</td></tr>';
      }).join('') || '<tr><td colspan="4">No hay movimientos en el periodo.</td></tr>')
      + '</tbody></table></div>'
      + '<p class="hint">También puedes casar a mano en Cobros y banco. Deshacer un cobro devuelve la factura a emitida y quita el asiento de cobro.</p>';
  };

  VIEWS.cierre = route => {
    const ano = (route.q.ano || defaultYear()).replace(/[^\d]/g, '').slice(0, 4) || defaultYear();
    const cerrado = PC.yearClosed(S, ano);
    let prev = null, err = '';
    try { prev = PC.previewCierre(S, ano); } catch (e) { err = e.message; }
    const stale = cerrado && PC.cierreStale(S, ano);
    const rows = prev ? [['Resultado', PL.eurPlain(prev.resultado)], ['Líneas de regularización', String(prev.regularizacion.length)], ['Líneas de cierre', String(prev.cierre.length)]] : [];
    setBook('cierre-' + ano, 'Cierre de ejercicio ' + ano, ['Concepto', 'Importe'], rows, 1);
    return contaHead('cierre', 'Cierre y apertura', 'Regulariza los grupos 6 y 7 contra la 129, cierra el balance a 31 de diciembre y abre el ejercicio siguiente.', bookBtns())
      + '<form class="card" data-form="cierreAno"><div class="row"><label class="f">Ejercicio</label><input name="ano" value="' + esc(ano) + '" style="max-width:120px" inputmode="numeric"><button class="btn sec">Calcular</button></div></form>'
      + (cerrado ? '<div class="okbox">El ejercicio ' + esc(ano) + ' está cerrado. En el diario de esa fecha están la regularización y el cierre. El 1 de enero siguiente está la apertura.</div>' : '<div class="warnbox">El ejercicio ' + esc(ano) + ' sigue abierto. El balance ya muestra el resultado, pero todavía no hay asiento de cierre.</div>')
      + (stale ? '<div class="badbox">Hay movimientos nuevos después del cierre. Reabre el ejercicio y vuelve a cerrarlo para actualizar la regularización.</div>' : '')
      + (err ? '<div class="badbox">' + esc(err) + '</div>' : '')
      + (prev ? '<div class="kpis"><div class="card kpi"><div class="lbl">Resultado a regularizar</div><div class="val">' + money(prev.resultado) + '</div></div><div class="card kpi"><div class="lbl">Cuentas con saldo</div><div class="val">' + prev.movimientos + '</div></div><div class="card kpi"><div class="lbl">Asiento de cierre</div><div class="val">' + prev.cierre.length + '</div><div class="hint">líneas</div></div></div>' : '')
      + '<div class="card"><div class="row">'
      + (cerrado ? '<button class="btn bad" type="button" data-act="reabrir" data-ano="' + esc(ano) + '">Reabrir ejercicio</button>' : '<button class="btn" type="button" data-act="cerrarEj" data-ano="' + esc(ano) + '">Cerrar ejercicio ' + esc(ano) + '</button>')
      + '<a class="btn ghost" href="#/diario?ano=' + esc(ano) + '&desde=' + esc(ano) + '-12-01&hasta=' + esc(ano) + '-12-31">Ver diario de diciembre</a></div>'
      + '<p class="hint">Cerrar no borra facturas ni la cadena Verifactu. Solo añade los tres asientos. Reabrir los quita.</p></div>';
  };

  VIEWS.existencias = route => {
    const b = yearBounds(route);
    const R = PC.report(S, b.desde, b.hasta);
    const I = R.inventario;
    setBook('existencias-' + b.hasta, 'Inventario a ' + PL.fd(b.hasta), ['Producto', 'Teórico', 'Contado', 'Diferencia', 'Valor'],
      I.rows.map(r => [r.p.name, PL.qtyText(r.left), r.counted == null ? '' : PL.qtyText(r.counted), r.diff == null ? '' : PL.qtyText(r.diff), PL.eurPlain(r.value)])
        .concat([['', '', '', 'Valor stock', PL.eurPlain(I.valor)], ['300', 'Mercaderías', '', '', PL.eurPlain(I.saldo300)], ['610', 'Variación (haber menos debe)', '', '', PL.eurPlain(I.saldo610)]]), 4);
    return contaHead('existencias', 'Inventario y variación', 'Cada entrada de lote carga la 300 con abono a la 610. Cada salida de albarán o factura con producto hace el asiento contrario, al coste del lote.', bookBtns())
      + periodBar(route, 'existencias')
      + (I.cuadra ? '<div class="okbox">El saldo de la cuenta 300 (' + money(I.saldo300) + ') coincide con el valor teórico del stock (' + money(I.valor) + ').</div>' : '<div class="warnbox">La 300 vale ' + money(I.saldo300) + ' y el stock teórico ' + money(I.valor) + '. Si generaste un ajuste de cuadre, la diferencia es ese asiento.</div>')
      + '<div class="kpis"><div class="card kpi"><div class="lbl">Valor teórico</div><div class="val">' + money(I.valor) + '</div></div><div class="card kpi"><div class="lbl">Saldo 300</div><div class="val">' + money(I.saldo300) + '</div></div><div class="card kpi"><div class="lbl">Variación neta 610</div><div class="val">' + money(I.saldo610) + '</div><div class="hint">Haber menos debe. Positivo = aumento de existencias</div></div></div>'
      + '<div class="table-wrap"><table><thead><tr><th>Producto</th><th class="r">Teórico</th><th class="r">Contado</th><th class="r">Diferencia</th><th class="r">Valor</th></tr></thead><tbody>'
      + I.rows.map(r => '<tr><td>' + esc(r.p.name) + '</td><td class="r">' + PL.qtyText(r.left) + '</td><td class="r">' + (r.counted == null ? '—' : PL.qtyText(r.counted)) + '</td><td class="r">' + (r.diff == null ? '—' : PL.qtyText(r.diff)) + '</td><td class="r">' + money(r.value) + '</td></tr>').join('')
      + '</tbody></table></div>'
      + '<div class="card"><p>El conteo se edita en <a href="#/stock">Stock y cuadre</a>. El plátano de demo está 3 kg por debajo a propósito.</p><button class="btn" type="button" data-act="postCuadre" data-date="' + esc(b.hasta) + '">Asiento de la diferencia de cuadre</button>'
      + '<p class="hint">Ese asiento ajusta la 300 y la 610 al coste del lote. Solo puede haber uno: si repites, elimina el anterior en el diario.</p></div>';
  };

  VIEWS.firmar = route => {
    const doc = findDoc(route.id);
    if (!doc) return '<div class="card">Documento no encontrado.</div>';
    if (doc.signed) return '<div class="card">Ya está firmado. <a href="#' + (PL.byId(S.invoices, doc.id) ? '/factura/' : '/albaran/') + doc.id + '">Volver</a></div>';
    const who = client(doc.clientId);
    return head('Firmar', esc(doc.num) + ' · ' + esc(who ? who.name : '') + ' · ' + money(PL.totals(doc).total))
      + '<div class="card"><label class="f">Nombre de quien firma</label><input id="signer" placeholder="Nombre y apellidos" autocomplete="off">'
      + '<label class="f" style="margin-top:10px">Firma con el dedo o el ratón</label><canvas class="sign" id="sigcv"></canvas>'
      + '<div class="row" style="margin-top:10px"><button class="btn ghost" type="button" data-act="sigClear">Borrar</button><button class="btn" id="sigok" data-act="sigDo" data-id="' + doc.id + '" disabled>Guardar firma</button></div>'
      + '<p class="hint">Se guarda el trazo en este navegador y un hash del documento. No es una firma electrónica cualificada.</p></div>';
  };

  function sheetInvoice(inv) {
    const cl = client(inv.clientId) || {};
    const t = PL.totals(inv);
    const lines = inv.lines.map(ln => {
      const a = PL.lineAmounts(ln);
      const note = [ln.note, ln.lot ? 'Lote: ' + ln.lot : '', ln.origin ? 'Origen: ' + ln.origin : ''].filter(Boolean).join(' · ');
      return '<tr><td>' + esc(ln.desc) + (note ? '<div class="small">' + esc(note) + '</div>' : '') + '</td><td class="r">' + PL.qtyText(ln.qtyMilli) + '</td><td class="r">' + PL.eurPlain(ln.price) + ' €</td><td class="r">' + PL.eurPlain(a.base) + ' €</td><td class="r">' + (ln.rate || 0) + ' %</td><td class="r">' + PL.eurPlain(a.total) + ' €</td></tr>';
    }).join('');
    return '<article class="sheet"><div class="top"><img class="logo" src="logo-demo.jpg" alt=""><div class="who"><h2 style="font-size:18px;color:#142033">' + esc(S.company.name) + '</h2><div>CIF ' + esc(S.company.nif) + '</div><div>' + esc(S.company.address) + '</div><div>' + esc(S.company.cp) + ' ' + esc(S.company.city) + '</div><div>' + esc(S.company.email) + '</div></div><div class="doc"><h2>FACTURA</h2><div class="num">' + esc(inv.num) + '</div><div>Fecha ' + PL.fd(inv.date) + '</div><div>' + statusLabel(inv.status) + '</div></div></div>'
      + '<div class="client"><div class="small">CLIENTE</div><b>' + esc(cl.name || '') + '</b><div>NIF/CIF ' + esc(cl.nif || '') + ' ' + esc(PL.addr(cl)) + '</div></div>'
      + '<table><thead><tr><th>Descripción</th><th class="r">Cantidad</th><th class="r">Precio</th><th class="r">Base</th><th class="r">IGIC</th><th class="r">Importe</th></tr></thead><tbody>' + lines + '</tbody></table>'
      + '<p style="text-align:right"><b>Base ' + money(t.base) + ' · IGIC ' + money(t.igic) + ' · TOTAL ' + money(t.total) + '</b></p>'
      + '<div class="foot">' + esc(S.company.mercantile) + '<br>IBAN ' + esc(S.company.ibanBank) + ' ' + esc(S.company.iban) + '<br>IAE: ' + esc(S.company.iae)
      + '<br>Piloto PAGUU. Verifactu generado en local. Envío a la AEAT simulado, no realizado.</div></article>';
  }
  function doPrint(html) {
    document.getElementById('paper').innerHTML = html;
    window.print();
  }

  let logoCache = null;
  async function logoBytes() {
    if (logoCache) return logoCache;
    const r = await fetch('logo-demo.jpg');
    logoCache = new Uint8Array(await r.arrayBuffer());
    return logoCache;
  }
  function qrMatrix(text) {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    const rows = [];
    for (let r = 0; r < n; r++) {
      let s = '';
      for (let c = 0; c < n; c++) s += q.isDark(r, c) ? '1' : '0';
      rows.push(s);
    }
    return rows;
  }
  function qrSvg(text) {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
  }
  async function invoicePdfBytes(inv) {
    const jpeg = await logoBytes();
    const cl = client(inv.clientId) || { name: '', nif: '' };
    const t = PL.totals(inv);
    const lines = inv.lines.map(ln => {
      const a = PL.lineAmounts(ln);
      return {
        desc: ln.desc,
        note: [ln.note, ln.lot ? 'Lote: ' + ln.lot : '', ln.origin ? 'Origen: ' + ln.origin : ''].filter(Boolean).join(' · '),
        qty: PL.qtyText(ln.qtyMilli), price: PL.eurPlain(ln.price), base: PL.eurPlain(a.base), rate: (ln.rate || 0) + ' %', total: PL.eurPlain(a.total)
      };
    });
    let qr = null;
    try { qr = qrMatrix(PL.qrPayload(S, inv)); } catch (e) { qr = null; }
    return PaguuPdf.invoicePdf({
      company: { name: S.company.name, nif: S.company.nif, addressLines: [S.company.address, (S.company.cp + ' ' + S.company.city).trim(), S.company.email].filter(Boolean) },
      num: inv.num, date: 'Fecha ' + PL.fd(inv.date), status: statusLabel(inv.status),
      client: { name: cl.name || '', nifLine: 'NIF/CIF ' + (cl.nif || ''), addr: PL.addr(cl) },
      lines, base: PL.eurPlain(t.base) + ' €', igic: PL.eurPlain(t.igic) + ' €', total: PL.eurPlain(t.total) + ' €',
      footer: [S.company.mercantile, 'IBAN ' + S.company.ibanBank + ' ' + S.company.iban, 'IAE: ' + S.company.iae],
      disclaimer: 'Piloto PAGUU · Verifactu generado en local · envío a la AEAT simulado, no realizado.',
      qr
    }, jpeg);
  }
  function downloadBlob(name, bytes, type) {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function csv(rows) {
    const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    return '\uFEFF' + rows.map(r => r.map(cell).join(';')).join('\r\n');
  }
  function log(date, text, ref, n) {
    S.log.push({ id: 'lg' + Date.now() + Math.random().toString(16).slice(2, 6), date: date || todayISO(), n: n || 0, text, ref: ref || '' });
  }

  const ACT = {
    toggleGrp(t) { OPEN[t.dataset.g] = !OPEN[t.dataset.g]; render(); },
    theme() {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('paguu-theme', next);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', next === 'light' ? '#eef3f8' : '#070b14');
      render();
    },
    nav() { document.getElementById('side').classList.toggle('open'); },
    factPage(t) { factPage += Number(t.dataset.d) || 0; if (factPage < 1) factPage = 1; render(); },
    async pdfInv(t) {
      const inv = PL.byId(S.invoices, t.dataset.id);
      toast('Generando PDF…');
      downloadBlob(inv.num + '.pdf', await invoicePdfBytes(inv), 'application/pdf');
    },
    printInv(t) { doPrint(sheetInvoice(PL.byId(S.invoices, t.dataset.id))); },
    printAlb(t) {
      const a = PL.byId(S.albaranes, t.dataset.id);
      doPrint(sheetInvoice(Object.assign({}, a, { status: a.signed ? 'firmado' : 'sin firmar' })).replace('FACTURA', 'ALBARÁN'));
    },
    simular(t) {
      const rec = S.chain.find(c => c.id === t.dataset.id);
      if (!rec) return;
      rec.aeat = 'simulado';
      log(todayISO(), 'Envío AEAT simulado (no se ha llamado a la AEAT)', rec.invoiceId, 0);
      save(); toast('Simulación hecha. No se ha llamado a la AEAT.'); render();
    },
    descasar(t) { PL.unmatchBank(S, t.dataset.id); save(); toast('Casación deshecha'); render(); },
    addLine(t) { const D = DRAFT[t.dataset.k]; if (!D) return; D.lines.push(blankLine(0)); render(); },
    delLine(t) { const D = DRAFT[t.dataset.k]; D.lines.splice(Number(t.dataset.i), 1); if (!D.lines.length) D.lines.push(blankLine(0)); render(); },
    preset(t) { DRAFT[t.dataset.k].lines.push(blankLine(t.dataset.rate)); render(); },
    delContacto(t) {
      const id = t.dataset.id;
      if (t.dataset.kind === 'c') {
        if (S.invoices.some(i => i.clientId === id) || S.albaranes.some(a => a.clientId === id)) throw new Error('Tiene documentos y no se elimina');
        S.clients = S.clients.filter(c => c.id !== id); save(); go('#/clientes');
      } else {
        if ((S.received || []).some(i => i.supplierId === id)) throw new Error('Tiene facturas recibidas y no se elimina');
        S.suppliers = S.suppliers.filter(c => c.id !== id); save(); go('#/proveedores');
      }
    },
    restore() {
      if (!confirm('Se sustituyen los datos de este navegador por el piloto demo. ¿Continuar?')) return;
      S = PL.prepare(window.PAGUU_SEED); save(); toast('Piloto demo restaurado'); go('#/inicio');
    },
    saveCounts() {
      document.querySelectorAll('[data-count]').forEach(el => {
        const v = el.value.trim();
        S.counts[el.dataset.count] = v === '' ? null : PL.parseQty(v);
      });
      save(); toast('Conteo guardado'); render();
    },
    excelRel() { downloadRel('csv'); },
    async zipRel() { await downloadRel('zip'); },
    async pdfRel() { await downloadRel('pdf'); },
    excelBen() {
      const route = parse();
      const b = PL.beneficios(S, route.q.desde || (defaultMonth() + '-01'), route.q.hasta || PL.monthEnd(defaultMonth()));
      const rows = [['Cliente', 'Facturas', 'Base', 'Coste', 'Beneficio']].concat(b.byClient.map(g => [(client(g.clientId) || {}).name, g.n, PL.eurPlain(g.base), g.known ? PL.eurPlain(g.cost) : '', g.known ? PL.eurPlain(g.base - g.cost) : '']));
      downloadBlob('beneficios.csv', new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }), 'text/csv');
    },
    excelDeuda() {
      const age = PL.aging(S, todayISO());
      const rows = [['Cliente', 'Facturas', '0-30', '31-60', '61-90', '+90', 'Total']].concat(age.map(r => [(client(r.clientId) || {}).name, r.n, PL.eurPlain(r.b0), PL.eurPlain(r.b30), PL.eurPlain(r.b60), PL.eurPlain(r.b90), PL.eurPlain(r.total)]));
      downloadBlob('deuda.csv', new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }), 'text/csv');
    },
    sigClear() { initSig(true); },
    sigDo(t) {
      const doc = findDoc(t.dataset.id);
      const name = document.getElementById('signer').value;
      const paths = SIG.strokes.map(s => 'M' + s.map(p => p[0] + ' ' + p[1]).join(' L'));
      PL.signDoc(doc, { name, paths, w: SIG.w, h: SIG.h });
      log(todayISO(), 'Documento firmado', doc.id, doc.n || 0);
      save(); toast('Firma guardada en este navegador');
      go((PL.byId(S.invoices, doc.id) ? '#/factura/' : '#/albaran/') + doc.id);
    },
    bookCsv() {
      if (!BOOK) throw new Error('No hay libro para exportar');
      downloadBlob(BOOK.file + '.csv', new Blob([csv([BOOK.headers].concat(BOOK.rows))], { type: 'text/csv;charset=utf-8' }), 'text/csv');
    },
    bookPdf() {
      if (!BOOK) throw new Error('No hay libro para exportar');
      const bytes = PaguuPdf.tablePdf({
        title: BOOK.title,
        subtitle: BOOK.subtitle || S.company.name,
        headers: BOOK.headers,
        rows: BOOK.rows,
        numericFrom: BOOK.numericFrom,
        note: 'Piloto PAGUU. Libro de demostración. No es un libro oficial. IGIC orientativo, por validar con asesor.'
      });
      downloadBlob(BOOK.file + '.pdf', bytes, 'application/pdf');
    },
    cuentaActiva(t) {
      PC.setAccountActive(S, t.dataset.code, t.dataset.on === '1');
      save(); toast(t.dataset.on === '1' ? 'Cuenta activada' : 'Cuenta desactivada'); render();
    },
    addAst() {
      if (!DRAFT.ast) return;
      DRAFT.ast.lines.push({ code: '572', debe: '', haber: '' });
      render();
    },
    delAst(t) {
      if (!DRAFT.ast) return;
      DRAFT.ast.lines.splice(Number(t.dataset.i), 1);
      if (DRAFT.ast.lines.length < 2) DRAFT.ast.lines.push({ code: '572', debe: '', haber: '' });
      render();
    },
    delAsiento(t) {
      if (!confirm('¿Eliminar este asiento?')) return;
      PC.deleteAsiento(S, t.dataset.id);
      save(); toast('Asiento eliminado'); render();
    },
    postAmort(t) {
      PC.postAmort(S, t.dataset.id, t.dataset.ano);
      save(); toast('Cuota contabilizada en el diario'); render();
    },
    delActivo(t) {
      if (!confirm('¿Quitar este bien de la tabla?')) return;
      PC.deleteAsset(S, t.dataset.id);
      save(); toast('Bien eliminado'); render();
    },
    casarExactos() {
      const r = PC.casarExactos(S);
      save();
      toast('Cobrados ' + r.cobros + ' · pagados ' + r.pagos + ' · sin casar ' + r.omitidos);
      render();
    },
    plantillaCsv() {
      const inv = S.invoices.find(i => i.status === 'emitida');
      const rows = [['fecha', 'concepto', 'importe']];
      if (inv) {
        const tot = PL.totals(inv);
        const [y, m, d] = inv.date.split('-');
        rows.push([d + '/' + m + '/' + y, 'Cobro ' + inv.num, PL.eurPlain(tot.total)]);
      }
      rows.push([PL.fd(todayISO()).replace(/(\d+)\/(\d+)\/(\d+)/, '$1/$2/$3'), 'Ingreso que no cuadra', '1,23']);
      downloadBlob('extracto-ejemplo.csv', new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }), 'text/csv');
    },
    cerrarEj(t) {
      if (!confirm('¿Cerrar el ejercicio ' + t.dataset.ano + '? Se añaden regularización, cierre y apertura.')) return;
      PC.closeYear(S, t.dataset.ano);
      log(t.dataset.ano + '-12-31', 'Cierre de ejercicio ' + t.dataset.ano, '', 0);
      save(); toast('Ejercicio cerrado'); render();
    },
    reabrir(t) {
      if (!confirm('¿Reabrir ' + t.dataset.ano + ' y quitar los asientos de cierre?')) return;
      PC.reopenYear(S, t.dataset.ano);
      save(); toast('Ejercicio reabierto'); render();
    },
    postCuadre(t) {
      PC.postCuadre(S, t.dataset.date || todayISO());
      save(); toast('Asiento de cuadre guardado en el diario'); render();
    }
  };

  async function downloadRel(kind) {
    const route = parse();
    const { ym, clientId } = relQuery(route);
    const rel = PL.relacion(S, ym, clientId);
    const cl = client(clientId);
    if (kind === 'csv') {
      const rows = [['Numero', 'Fecha', 'Base', 'IGIC', 'Total', 'Estado', 'Pendiente', 'Detalle']].concat(rel.invs.map(inv => {
        const t = PL.totals(inv);
        return [inv.num, PL.fd(inv.date), PL.eurPlain(t.base), PL.eurPlain(t.igic), PL.eurPlain(t.total), inv.status, inv.status === 'emitida' ? PL.eurPlain(t.total) : '0,00', inv.lines.map(l => l.desc).join(' / ')];
      }));
      downloadBlob('relacion-' + ym + '.csv', new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }), 'text/csv');
      return;
    }
    if (kind === 'pdf') {
      const jpeg = await logoBytes();
      const bytes = PaguuPdf.relacionPdf({
        company: S.company.name + ' · CIF ' + S.company.nif,
        subtitle: 'Relación de ' + ym, party: cl ? cl.name : '', partyNif: cl ? cl.nif : '',
        rows: rel.invs.map(inv => {
          const t = PL.totals(inv);
          return { num: inv.num, date: PL.fd(inv.date), base: PL.eurPlain(t.base), igic: PL.eurPlain(t.igic), total: PL.eurPlain(t.total), status: statusLabel(inv.status), pend: PL.eurPlain(inv.status === 'emitida' ? t.total : 0), note: inv.lines.map(l => l.desc + (l.lot ? ' · Lote ' + l.lot : '')).join(' / ') };
        }),
        mes: 'Mes: base ' + PL.eurPlain(rel.base) + ' · IGIC ' + PL.eurPlain(rel.igic) + ' · total ' + PL.eurPlain(rel.total),
        saldo: 'Saldo acumulado ' + PL.eurPlain(rel.saldo) + ' EUR',
        disclaimer: 'Piloto PAGUU · documento local.'
      }, jpeg);
      downloadBlob('relacion-' + ym + '.pdf', bytes, 'application/pdf');
      return;
    }
    toast('Generando ZIP…');
    const files = [];
    for (const inv of rel.invs) {
      if (inv.status === 'anulada') continue;
      files.push({ name: inv.num + '.pdf', data: await invoicePdfBytes(inv) });
    }
    if (!files.length) throw new Error('No hay facturas en esta relación');
    downloadBlob('relacion-' + ym + '.zip', PaguuPdf.zipStore(files), 'application/zip');
  }

  const FORMS = {
    verRel(f) { go('#/relacion?mes=' + encodeURIComponent(f.mes.value) + '&cliente=' + encodeURIComponent(f.cliente.value)); },
    verBen(f) { go('#/beneficios?desde=' + encodeURIComponent(f.desde.value) + '&hasta=' + encodeURIComponent(f.hasta.value) + '&orden=' + encodeURIComponent(f.orden.value)); },
    costes(f) {
      const inv = PL.byId(S.invoices, f.dataset.id);
      inv.lines.forEach((ln, i) => {
        const v = f.querySelector('[name="cost-' + i + '"]').value.trim();
        if (!v) { ln.cost = null; return; }
        const c = PL.parseEur(v);
        if (c == null || c < 0) throw new Error('Coste no válido');
        ln.cost = c;
      });
      log(todayISO(), 'Coste interno actualizado', inv.id, inv.n);
      save(); toast('Coste interno guardado. No modifica la factura ni la huella.'); render();
    },
    anular(f) {
      PL.anular(S, f.dataset.id, f.motivo.value, todayISO());
      save(); toast('Factura anulada. La cadena se ha alargado en local.'); render();
    },
    emitir() {
      const inv = PL.emitirFactura(S, { clientId: DRAFT.fac.clientId, date: DRAFT.fac.date, lines: DRAFT.fac.lines });
      DRAFT.fac = null; save(); toast('Factura ' + inv.num + ' emitida. Registro Verifactu local, sin envío.'); go('#/factura/' + inv.id);
    },
    albaran() {
      const doc = PL.crearAlbaran(S, { clientId: DRAFT.alb.clientId, date: DRAFT.alb.date, lines: DRAFT.alb.lines });
      DRAFT.alb = null; save(); toast('Albarán ' + doc.num + ' creado'); go('#/albaran/' + doc.id);
    },
    recibida() {
      const rec = PL.crearRecibida(S, { supplierId: DRAFT.rec.supplierId, date: DRAFT.rec.date, lines: DRAFT.rec.lines });
      DRAFT.rec = null; save(); toast('Factura recibida ' + rec.num); go('#/recibidas');
    },
    casar(f) {
      if (!f.bank.value || !f.inv.value) throw new Error('Elige movimiento y factura');
      PL.matchBank(S, f.bank.value, f.inv.value);
      save(); toast('Cobro casado. La factura queda cobrada.'); render();
    },
    casarPago(f) { PL.matchPago(S, f.bank.value, f.rec.value); save(); toast('Pago casado'); render(); },
    bank(f) {
      const amount = PL.parseEur(f.amount.value);
      if (amount == null || amount <= 0) throw new Error('Importe no válido');
      const signed = f.tipo.value === 'pago' ? -amount : amount;
      S.bank.unshift({ id: 'b' + Date.now(), date: f.date.value || todayISO(), concept: f.concept.value.trim() || 'Movimiento simulado', amount: signed, invoiceId: null, receivedId: null, origin: 'simulado' });
      save(); toast('Movimiento añadido. Aún no cambia el estado de ninguna factura.'); render();
    },
    remesa(f) {
      const ids = [...f.querySelectorAll('input[name=ids]:checked')].map(x => x.value);
      if (!ids.length) throw new Error('Marca al menos una factura');
      let total = 0;
      ids.forEach(id => { total += PL.totals(PL.byId(S.invoices, id)).total; });
      S.remesas.unshift({ id: 'RM' + (S.remesas.length + 1), date: todayISO(), concept: f.concept.value.trim() || 'Remesa', invoiceIds: ids, total, status: 'preparada' });
      log(todayISO(), 'Remesa preparada (' + ids.length + ' facturas)', '', 0);
      save(); toast('Remesa preparada. Las facturas siguen pendientes hasta que el banco cuadre.'); render();
    },
    contacto(f) {
      const data = {};
      ['name', 'nif', 'address', 'cp', 'city', 'province', 'country', 'email', 'phone'].forEach(k => data[k] = f[k].value.trim());
      if (data.name.length < 2) throw new Error('Falta la razón social');
      if (!data.nif) throw new Error('Falta el NIF/CIF');
      const kind = f.dataset.kind;
      const list = kind === 'c' ? S.clients : S.suppliers;
      if (f.dataset.id) {
        const rec = list.find(x => x.id === f.dataset.id);
        Object.assign(rec, data);
        save(); toast('Ficha actualizada'); render();
      } else {
        const id = (kind === 'c' ? 'c' : 's') + data.nif.replace(/\s/g, '');
        if (list.some(x => x.id === id)) throw new Error('Ya existe una ficha con ese NIF');
        list.push(Object.assign({ id }, data));
        save(); go(kind === 'c' ? '#/cliente/' + id : '#/proveedor/' + id);
      }
    },
    empresa(f) {
      ['name', 'nif', 'address', 'cp', 'city', 'province', 'email', 'phone', 'mercantile', 'iae', 'iban', 'ibanBank'].forEach(k => { if (f[k]) S.company[k] = f[k].value.trim(); });
      save(); toast('Datos de empresa guardados en este navegador'); render();
    },
    nextNum(f) {
      const n = parseInt(f.next.value, 10);
      const max = S.invoices.reduce((m, i) => Math.max(m, i.n), 0);
      if (!n || n <= max) throw new Error('El número tiene que ser mayor que ' + max);
      S.nextFac = n; save(); toast(n === max + 1 ? 'Siguiente número actualizado' : 'Siguiente número actualizado. Quedará un hueco.'); render();
    },
    finmes(f) {
      const ids = [...f.querySelectorAll('input[name=ids]:checked')].map(x => x.value);
      const inv = PL.facturarAlbaranes(S, ids, f.date.value || todayISO());
      save(); toast('Factura ' + inv.num + ' emitida con la relación'); go('#/factura/' + inv.id);
    },
    entrada(f) {
      const qty = PL.parseQty(f.qty.value);
      const cost = PL.parseEur(f.cost.value);
      PL.addLot(S, { pid: f.pid.value, qtyMilli: qty, cost, lot: f.lot.value.trim(), origin: f.origin.value.trim(), date: f.date.value });
      save(); toast('Entrada registrada'); render();
    },
    periodo(f) {
      let ano = String(f.ano.value || '').replace(/[^\d]/g, '').slice(0, 4);
      let desde = f.desde.value;
      let hasta = f.hasta.value;
      if (ano && (!desde || desde.slice(0, 4) !== ano)) {
        desde = ano + '-01-01';
        hasta = ano + '-12-31';
      }
      const path = f.dataset.path || 'conta';
      const q = new URLSearchParams();
      if (ano) q.set('ano', ano);
      if (desde) q.set('desde', desde);
      if (hasta) q.set('hasta', hasta);
      if (f.q && f.q.value) q.set('q', f.q.value);
      if (f.cuenta && f.cuenta.value) q.set('cuenta', f.cuenta.value);
      go('#/' + path + '?' + q.toString());
    },
    buscaDiario(f) {
      const route = parse();
      const b = yearBounds(route);
      const q = new URLSearchParams({ ano: b.ano, desde: b.desde, hasta: b.hasta });
      if (f.q.value.trim()) q.set('q', f.q.value.trim());
      go('#/diario?' + q.toString());
    },
    eligeCuenta(f) {
      const route = parse();
      const b = yearBounds(route);
      go('#/mayor?ano=' + b.ano + '&desde=' + b.desde + '&hasta=' + b.hasta + '&cuenta=' + encodeURIComponent(f.cuenta.value));
    },
    renCuenta(f) {
      PC.upsertAccount(S, f.code.value, f.name.value);
      save(); toast('Cuenta actualizada'); render();
    },
    nuevaCuenta(f) {
      PC.addAccount(S, f.code.value, f.name.value);
      save(); toast('Cuenta añadida al plan'); render();
    },
    asiento() {
      const id = PC.addManual(S, DRAFT.ast);
      DRAFT.ast = null;
      log(todayISO(), 'Asiento manual', id, 0);
      save(); toast('Asiento guardado en el diario'); render();
    },
    igicPeriod(f) {
      go('#/igic?ano=' + encodeURIComponent(f.ano.value.trim()) + '&t=' + encodeURIComponent(f.t.value));
    },
    amortAno(f) { go('#/amort?ano=' + encodeURIComponent(f.ano.value.trim())); },
    cierreAno(f) { go('#/cierre?ano=' + encodeURIComponent(f.ano.value.trim())); },
    nuevoActivo(f) {
      PC.addAsset(S, { name: f.name.value, fecha: f.fecha.value, valor: f.valor.value, residual: f.residual.value, anos: f.anos.value, cuenta: f.cuenta.value, acum: f.acum.value, gasto: f.gasto.value });
      save(); toast('Bien añadido. La cuota se contabiliza con el botón Asiento.'); render();
    },
    importExtracto(f) {
      const input = f.file;
      const file = input.files && input.files[0];
      if (!file) throw new Error('Elige un CSV');
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const r = PC.importExtracto(S, String(reader.result || ''));
          save();
          toast('Movimientos nuevos: ' + r.added + '. Repetidos: ' + r.dup + '.');
          render();
        } catch (err) { toast(err.message || 'CSV no válido', 'bad'); }
      };
      reader.readAsText(file);
    }
  };

  function onAst(t) {
    if (!DRAFT.ast) return;
    const k = t.dataset.ast;
    if (k === 'date') DRAFT.ast.date = t.value;
    else if (k === 'concept') DRAFT.ast.concept = t.value;
    else {
      const parts = k.split(':');
      const ln = DRAFT.ast.lines[Number(parts[1])];
      if (ln) ln[parts[0]] = t.value;
    }
    const box = document.getElementById('ast-bal');
    if (!box) return;
    let debe = 0, haber = 0;
    DRAFT.ast.lines.forEach(ln => { debe += PL.parseEur(ln.debe) || 0; haber += PL.parseEur(ln.haber) || 0; });
    box.textContent = !debe && !haber ? 'Sin importes' : ((debe === haber ? 'Cuadra · ' : 'No cuadra · ') + money(debe) + ' / ' + money(haber));
  }

  function onDraft(t) {
    const parts = (t.dataset.draft || '').split(':');
    const kind = parts[0], field = parts[1], idx = parts[2];
    const D = DRAFT[kind];
    if (!D) return;
    if (field === 'client') D.clientId = t.value;
    else if (field === 'supplier') D.supplierId = t.value;
    else if (field === 'date') D.date = t.value;
    else if (field === 'pid') {
      const ln = D.lines[+idx];
      ln.pid = t.value;
      const p = PL.byId(S.products, t.value);
      if (p) { ln.desc = p.name; ln.price = PL.eurPlain(p.price); ln.rate = '0'; ln.note = 'Fruta y verdura · IGIC 0 %'; }
      render();
      return;
    } else {
      D.lines[+idx][field] = t.value;
      if (field === 'rate') D.lines[+idx].note = t.value === '7' ? 'Servicios 7 %' : 'Fruta y verdura · IGIC 0 %';
    }
    const live = document.getElementById('live');
    if (live) {
      const tot = draftTotals(kind);
      live.innerHTML = '<div class="row"><span class="grow muted">Base</span><b>' + money(tot.base) + '</b></div><div class="row"><span class="grow muted">IGIC</span><b>' + money(tot.igic) + '</b></div><div class="row"><span class="grow">Total</span><b>' + money(tot.total) + '</b></div>';
    }
  }

  function initSig(reset) {
    const cv = document.getElementById('sigcv');
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 600, h = cv.clientHeight || 220;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#142033';
    SIG = { w, h, strokes: [], cur: null };
    const btn = document.getElementById('sigok');
    const upd = () => { if (btn) btn.disabled = !((document.getElementById('signer').value || '').trim().length >= 2 && SIG.strokes.length); };
    if (reset) { upd(); return; }
    const pos = e => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * 10) / 10, Math.round((e.clientY - r.top) * 10) / 10]; };
    cv.onpointerdown = e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) {} const p = pos(e); SIG.cur = [p]; g.beginPath(); g.moveTo(p[0], p[1]); };
    cv.onpointermove = e => { if (!SIG.cur) return; const p = pos(e); SIG.cur.push(p); g.lineTo(p[0], p[1]); g.stroke(); };
    const end = () => { if (SIG.cur && SIG.cur.length > 1) SIG.strokes.push(SIG.cur); SIG.cur = null; upd(); };
    cv.onpointerup = end; cv.onpointercancel = end;
    const name = document.getElementById('signer');
    if (name) name.oninput = upd;
  }

  async function importFile(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const text = await file.text();
    if (text.trim().startsWith('{')) {
      const data = JSON.parse(text);
      let n = 0;
      for (const row of data.clientes || []) {
        const id = 'c' + row.nif_cif;
        if (S.clients.some(c => c.id === id)) continue;
        S.clients.push({ id, name: row.razon_social, nif: row.nif_cif, address: row.direccion || '', cp: row.codigo_postal || '', city: row.ciudad || '', province: row.provincia || '', country: row.pais || 'España', email: row.email || '', phone: row.telefono || '' });
        n++;
      }
      for (const row of data.proveedores || []) {
        const id = 's' + row.nif_cif;
        if (S.suppliers.some(c => c.id === id)) continue;
        S.suppliers.push({ id, name: row.razon_social, nif: row.nif_cif, address: row.direccion || '', cp: row.codigo_postal || '', city: row.ciudad || '', province: row.provincia || '', country: row.pais || 'España', email: row.email || '', phone: row.telefono || '' });
        n++;
      }
      save(); toast(n ? ('Fichas nuevas: ' + n) : 'Esas fichas ya estaban'); render();
      return;
    }
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const head = lines.shift().split(';').map(x => x.trim().toLowerCase());
    const ix = k => head.indexOf(k);
    let added = 0, skip = 0;
    for (const line of lines) {
      const col = line.split(';');
      const num = (col[ix('numero')] || '').trim();
      if (!num || S.invoices.some(i => i.num === num)) { skip++; continue; }
      const name = (col[ix('cliente')] || '').trim();
      const cl = S.clients.find(c => c.name === name);
      if (!cl) { skip++; continue; }
      const total = PL.parseEur(col[ix('total')] || '');
      const base = PL.parseEur(col[ix('base_imponible')] || col[ix('base')] || '');
      const igic = PL.parseEur(col[ix('igic')] || '');
      let price, rate;
      if (base != null && igic != null) { price = base; rate = base ? Math.round(igic / base * 100) : 0; }
      else { price = total; rate = 0; }
      if (price == null) { skip++; continue; }
      const parts = (col[ix('fecha')] || '').split('/');
      const date = parts.length === 3 ? parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0') : todayISO();
      const nMatch = new RegExp('^' + S.company.serie + '(\\d+)$').exec(num);
      const n = nMatch ? parseInt(nMatch[1], 10) : S.nextFac;
      const estado = (col[ix('estado')] || '').toLowerCase();
      const inv = {
        id: 'imp' + n + '-' + added, n, num, date, clientId: cl.id,
        lines: [{ desc: rate === 7 ? 'Servicio' : 'Fruta y verdura', qtyMilli: 1000, price, rate: rate === 7 ? 7 : 0, lot: 'L-' + date.slice(0, 7), origin: 'Gran Canaria', note: rate === 7 ? 'Servicios 7 %' : 'Fruta y verdura · IGIC 0 %', cost: null, pid: null }],
        status: estado.indexOf('cobrad') >= 0 ? 'emitida' : 'emitida', source: 'importada', groups: [], signed: null, anulacion: null
      };
      if (n >= S.nextFac) S.nextFac = n + 1;
      S.invoices.push(inv);
      const t = PL.totals(inv);
      const prev = S.chain.length ? S.chain[S.chain.length - 1].hash : PL.ZERO;
      const rec = { id: 'chimp' + n, invoiceId: inv.id, num, date, tipo: 'Alta', nif: S.company.nif, base: t.base, igic: t.igic, total: t.total, prev, motivo: '', aeat: 'no-enviado' };
      rec.hash = PL.sha256(PL.canon(rec));
      S.chain.push(rec); inv.huella = rec.hash; inv.huellaPrev = prev;
      if (estado.indexOf('cobrad') >= 0) {
        S.bank.push({ id: 'bimp' + n, date, concept: 'Cobro importado ' + num, amount: t.total, invoiceId: null, receivedId: null, origin: 'importado' });
        try { PL.matchBank(S, 'bimp' + n, inv.id); } catch (e) { /* deja el ingreso sin casar si no cuadra */ }
      }
      log(date, 'Factura importada', inv.id, n);
      added++;
    }
    save(); toast('Importadas ' + added + ' facturas. Omitidas ' + skip + '.'); render();
  }

  function render() {
    if (PC && PC.ensure(S)) save();
    const route = parse();
    document.getElementById('side').innerHTML = sidebar(route);
    const view = document.getElementById('view');
    const fn = VIEWS[route.name] || VIEWS.inicio;
    let html = '';
    try { html = fn(route); }
    catch (err) { console.error(err); html = '<div class="badbox">' + esc(err.message) + '</div>'; }
    view.innerHTML = html;
    view.querySelectorAll('[data-qrid]').forEach(el => {
      const inv = PL.byId(S.invoices, el.dataset.qrid);
      if (!inv) return;
      try { el.innerHTML = qrSvg(PL.qrPayload(S, inv)); }
      catch (e) { el.textContent = 'QR no disponible'; }
    });
    if (view.querySelector('#sigcv')) initSig(false);
    const titles = { inicio: 'Inicio', facturas: 'Facturas', factura: 'Factura', nueva: 'Nueva factura', beneficios: 'Beneficios', relacion: 'Relación', verifactu: 'Verifactu', clientes: 'Clientes', cobros: 'Cobros', conta: 'Contabilidad', plan: 'Plan de cuentas', diario: 'Diario', mayor: 'Mayor', sumas: 'Sumas y saldos', balance: 'Balance', pyg: 'Pérdidas y ganancias', tesoreria: 'Flujo de caja', igic: 'Libro de IGIC', amort: 'Amortizaciones', concilia: 'Conciliación', cierre: 'Cierre', existencias: 'Existencias' };
    document.title = 'PAGUU · ' + (titles[route.name] || 'facturación con IGIC');
  }

  document.body.addEventListener('click', e => {
    const a = e.target.closest('#side a');
    if (a) document.getElementById('side').classList.remove('open');
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const fn = ACT[t.dataset.act];
    if (!fn) return;
    e.preventDefault();
    Promise.resolve().then(() => fn(t, e)).catch(err => { console.error(err); toast(err.message || 'No se pudo completar', 'bad'); });
  });
  document.body.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = FORMS[f.dataset.form];
    if (!fn) return;
    try { fn(f); }
    catch (err) { console.error(err); toast(err.message || 'Revisa los datos', 'bad'); }
  });
  document.body.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset && t.dataset.draft) onDraft(t);
    if (t.dataset && t.dataset.ast) onAst(t);
    if (t.dataset && t.dataset.actInput === 'factQ') { factQ = t.value; factPage = 1; const pos = t.selectionStart; render(); const n = document.getElementById('qfact'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
  });
  document.body.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset && t.dataset.draft) onDraft(t);
    if (t.dataset && t.dataset.ast) onAst(t);
    if (t.dataset && t.dataset.actChange === 'importFile') importFile(t).catch(err => toast(err.message, 'bad'));
  });
  window.addEventListener('hashchange', render);

  const theme = localStorage.getItem('paguu-theme') || 'dark';
  document.documentElement.dataset.theme = theme;
  S = load();
  if (!localStorage.getItem(KEY)) save();
  render();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
