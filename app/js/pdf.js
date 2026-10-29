/* PAGUU · PDF mínimo (Helvetica WinAnsi + JPEG) y ZIP sin comprimir. */
(function (root) {
  'use strict';
  const enc = new TextEncoder();
  const WIN = {
    '€': 0x80, 'º': 0xBA, 'ª': 0xAA, '¿': 0xBF, '¡': 0xA1,
    'á': 0xE1, 'é': 0xE9, 'í': 0xED, 'ó': 0xF3, 'ú': 0xFA,
    'Á': 0xC1, 'É': 0xC9, 'Í': 0xCD, 'Ó': 0xD3, 'Ú': 0xDA,
    'ñ': 0xF1, 'Ñ': 0xD1, 'ü': 0xFC, 'Ü': 0xDC, 'ç': 0xE7,
    'à': 0xE0, 'è': 0xE8, 'ò': 0xF2, 'ù': 0xF9
  };
  function pdfLit(str) {
    let o = '(';
    for (const ch of String(str)) {
      if (ch === '(' || ch === ')' || ch === '\\') { o += '\\' + ch; continue; }
      const c = ch.codePointAt(0);
      if (c >= 32 && c <= 126) { o += ch; continue; }
      const w = WIN[ch];
      if (w != null) o += '\\' + w.toString(8).padStart(3, '0');
      else if (c >= 160 && c <= 255) o += '\\' + c.toString(8).padStart(3, '0');
      else o += '?';
    }
    return o + ')';
  }
  function n(v) { return (Math.round(v * 100) / 100).toString(); }
  function jpegSize(bytes) {
    for (let i = 0; i < bytes.length - 9; i++) {
      if (bytes[i] === 0xFF && (bytes[i + 1] === 0xC0 || bytes[i + 1] === 0xC2)) {
        return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
      }
    }
    return { w: 784, h: 784 };
  }
  function u8(s) { return enc.encode(s); }
function build(jpeg, pages) {
  const objs = [];
  const add = body => { objs.push(body); return objs.length; };
  add(u8('<< /Type /Catalog /Pages 2 0 R >>'));
  const pagesId = add(u8('<< /Type /Pages >>'));
  const font1 = add(u8('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  const font2 = add(u8('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
    let im = null;
    if (jpeg && jpeg.length) {
      const sz = jpegSize(jpeg);
      const head = u8('<< /Type /XObject /Subtype /Image /Width ' + sz.w + ' /Height ' + sz.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n');
      const tail = u8('\nendstream');
      const body = new Uint8Array(head.length + jpeg.length + tail.length);
      body.set(head, 0); body.set(jpeg, head.length); body.set(tail, head.length + jpeg.length);
      im = add(body);
    }
    const kids = [];
    for (const content of pages) {
      const stream = u8(content);
      const cid = add(concat([u8('<< /Length ' + stream.length + ' >>\nstream\n'), stream, u8('\nendstream')]));
      const res = '<< /Font << /F1 ' + font1 + ' 0 R /F2 ' + font2 + ' 0 R >>' + (im ? ' /XObject << /Im1 ' + im + ' 0 R >>' : '') + ' >>';
      const pid = add(u8('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources ' + res + ' /Contents ' + cid + ' 0 R >>'));
      kids.push(pid);
    }
    objs[pagesId - 1] = u8('<< /Type /Pages /Count ' + kids.length + ' /Kids [' + kids.map(id => id + ' 0 R').join(' ') + '] >>');
    const parts = [u8('%PDF-1.4\n')];
    const xref = [0];
    let pos = parts[0].length;
    for (let i = 0; i < objs.length; i++) {
      xref.push(pos);
      const chunk = concat([u8((i + 1) + ' 0 obj\n'), objs[i], u8('\nendobj\n')]);
      parts.push(chunk);
      pos += chunk.length;
    }
    const xrefPos = pos;
    let xrefStr = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    for (let i = 1; i < xref.length; i++) xrefStr += String(xref[i]).padStart(10, '0') + ' 00000 n \n';
    xrefStr += 'trailer << /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF';
    parts.push(u8(xrefStr));
    return concat(parts);
  }
  function concat(arrs) {
    let n = 0; for (const a of arrs) n += a.length;
    const o = new Uint8Array(n); let p = 0;
    for (const a of arrs) { o.set(a, p); p += a.length; }
    return o;
  }
  function Painter() {
    let s = '';
    const api = {
      fill(r, g, b) { s += r + ' ' + g + ' ' + b + ' rg\n'; return api; },
      rect(x, y, w, h) { s += n(x) + ' ' + n(y) + ' ' + n(w) + ' ' + n(h) + ' re f\n'; return api; },
      text(font, size, x, y, str) { s += 'BT /' + font + ' ' + size + ' Tf ' + n(x) + ' ' + n(y) + ' Td ' + pdfLit(str) + ' Tj ET\n'; return api; },
      image(x, y, w, h) { s += 'q ' + n(w) + ' 0 0 ' + n(h) + ' ' + n(x) + ' ' + n(y) + ' cm /Im1 Do Q\n'; return api; },
      out() { return s; }
    };
    return api;
  }
  const GREEN = [0.055, 0.32, 0.22];
  const INK = [0.09, 0.12, 0.16];
  const MUT = [0.35, 0.4, 0.45];

  function invoicePdf(model, jpeg) {
    const p = Painter();
    p.fill(GREEN[0], GREEN[1], GREEN[2]).rect(0, 806, 595, 36);
    if (jpeg) p.image(28, 652, 132, 132);
    p.fill(INK[0], INK[1], INK[2]);
    p.text('F2', 13, 172, 760, model.company.name);
    p.fill(MUT[0], MUT[1], MUT[2]);
    p.text('F1', 9, 172, 744, 'CIF ' + model.company.nif);
    const addr = model.company.addressLines || [];
    addr.forEach((ln, i) => p.text('F1', 9, 172, 730 - i * 12, ln));
    p.fill(GREEN[0], GREEN[1], GREEN[2]);
    p.text('F2', 18, 400, 762, 'FACTURA');
    p.fill(INK[0], INK[1], INK[2]);
    p.text('F2', 14, 400, 742, model.num);
    p.fill(MUT[0], MUT[1], MUT[2]);
    p.text('F1', 10, 400, 726, model.date);
    p.text('F1', 10, 400, 712, model.status);
    p.fill(0.96, 0.94, 0.88).rect(28, 560, 539, 78);
    p.fill(MUT[0], MUT[1], MUT[2]).text('F1', 8, 40, 620, 'CLIENTE');
    p.fill(INK[0], INK[1], INK[2]).text('F2', 12, 40, 604, model.client.name);
    p.fill(0.2, 0.24, 0.28).text('F1', 9, 40, 586, model.client.nifLine);
    const extra = model.client.addr || '';
    p.text('F1', 8, 40, 572, extra.slice(0, 110));
    p.fill(GREEN[0], GREEN[1], GREEN[2]).rect(28, 532, 539, 20);
    p.fill(1, 1, 1);
    const heads = [['Descripción', 36], ['Cant.', 300], ['Precio', 350], ['Base', 410], ['IGIC', 462], ['Importe', 510]];
    heads.forEach(([t, x]) => p.text('F2', 8, x, 538, t));
    let y = 514;
    p.fill(INK[0], INK[1], INK[2]);
    for (const ln of model.lines) {
      p.text('F1', 9, 36, y, ln.desc.slice(0, 48));
      p.text('F1', 9, 300, y, ln.qty);
      p.text('F1', 9, 346, y, ln.price);
      p.text('F1', 9, 406, y, ln.base);
      p.text('F1', 9, 462, y, ln.rate);
      p.text('F2', 9, 500, y, ln.total);
      y -= 12;
      if (ln.note) { p.fill(MUT[0], MUT[1], MUT[2]); p.text('F1', 8, 36, y, ln.note.slice(0, 90)); p.fill(INK[0], INK[1], INK[2]); y -= 12; }
      y -= 4;
    }
    y -= 8;
    p.text('F1', 10, 360, y, 'Base imponible'); p.text('F1', 10, 490, y, model.base); y -= 14;
    p.text('F1', 10, 360, y, 'IGIC'); p.text('F1', 10, 490, y, model.igic); y -= 16;
    p.fill(GREEN[0], GREEN[1], GREEN[2]);
    p.text('F2', 12, 360, y, 'TOTAL'); p.text('F2', 12, 480, y, model.total);
    if (model.qr && model.qr.length) {
      const cell = 2.1, nmod = model.qr.length, ox = 36, oy = 150;
      p.fill(0, 0, 0);
      for (let r = 0; r < nmod; r++) for (let c = 0; c < nmod; c++) if (model.qr[r][c] === '1') p.rect(ox + c * cell, oy + (nmod - 1 - r) * cell, cell, cell);
      p.fill(MUT[0], MUT[1], MUT[2]).text('F1', 7, 36 + nmod * cell + 8, 168, 'QR de consulta (entorno de pruebas).');
      p.text('F1', 7, 36 + nmod * cell + 8, 158, 'El registro no se ha enviado a la AEAT.');
    }
    p.fill(MUT[0], MUT[1], MUT[2]);
    let fy = 78;
    for (const ln of model.footer || []) { p.text('F1', 8, 36, fy, ln); fy -= 11; }
    p.text('F1', 7, 36, 28, model.disclaimer || '');
    return build(jpeg, [p.out()]);
  }

  function relacionPdf(model, jpeg) {
    const pages = [];
    const rows = model.rows.slice();
    const pageRows = 18;
    if (!rows.length) rows.push(null);
    for (let i = 0; i < rows.length; i += pageRows) {
      const slice = rows.slice(i, i + pageRows).filter(Boolean);
      const p = Painter();
      p.fill(GREEN[0], GREEN[1], GREEN[2]).rect(0, 806, 595, 36);
      if (jpeg && i === 0) p.image(28, 700, 78, 78);
      p.fill(INK[0], INK[1], INK[2]);
      p.text('F2', 14, jpeg && i === 0 ? 118 : 36, 760, 'RELACIÓN MENSUAL');
      p.fill(MUT[0], MUT[1], MUT[2]);
      p.text('F1', 9, 36, 688, model.company);
      p.text('F1', 9, 36, 674, model.subtitle);
      p.fill(INK[0], INK[1], INK[2]).text('F2', 12, 36, 650, model.party);
      p.fill(MUT[0], MUT[1], MUT[2]).text('F1', 9, 36, 636, model.partyNif || '');
      p.fill(GREEN[0], GREEN[1], GREEN[2]).rect(28, 608, 539, 16);
      p.fill(1, 1, 1);
      [['Número', 36], ['Fecha', 110], ['Base', 200], ['IGIC', 280], ['Total', 350], ['Estado', 430], ['Pendiente', 490]].forEach(([t, x]) => p.text('F2', 8, x, 612, t));
      let y = 590;
      p.fill(INK[0], INK[1], INK[2]);
      for (const r of slice) {
        p.text('F2', 8, 36, y, r.num);
        p.text('F1', 8, 110, y, r.date);
        p.text('F1', 8, 190, y, r.base);
        p.text('F1', 8, 270, y, r.igic);
        p.text('F1', 8, 340, y, r.total);
        p.text('F1', 8, 430, y, r.status);
        p.text('F1', 8, 490, y, r.pend);
        y -= 11;
        if (r.note) { p.fill(MUT[0], MUT[1], MUT[2]); p.text('F1', 7, 36, y, r.note.slice(0, 100)); p.fill(INK[0], INK[1], INK[2]); y -= 10; }
        y -= 3;
      }
      p.fill(GREEN[0], GREEN[1], GREEN[2]);
      p.text('F1', 9, 36, 70, model.mes);
      p.text('F1', 9, 360, 70, model.saldo);
      p.fill(MUT[0], MUT[1], MUT[2]).text('F1', 7, 36, 28, model.disclaimer || '');
      pages.push(p.out());
    }
    return build(jpeg, pages);
  }

  function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    return ~c >>> 0;
  }
  function zipStore(files) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const f of files) {
      const name = u8(f.name);
      const data = f.data;
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length + data.length);
      const dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, name.length, true);
      local.set(name, 30);
      local.set(data, 30 + name.length);
      locals.push(local);
      const cen = new Uint8Array(46 + name.length);
      const cd = new DataView(cen.buffer);
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true);
      cd.setUint32(42, offset, true);
      cen.set(name, 46);
      centrals.push(cen);
      offset += local.length;
    }
    const central = concat(centrals);
    const end = new Uint8Array(22);
    const ed = new DataView(end.buffer);
    ed.setUint32(0, 0x06054b50, true);
    ed.setUint16(8, files.length, true);
    ed.setUint16(10, files.length, true);
    ed.setUint32(12, central.length, true);
    ed.setUint32(16, offset, true);
    return concat(locals.concat([central, end]));
  }

  function clipPdf(str, px) {
    const max = Math.max(3, Math.floor(px / 3.7));
    const s = String(str == null ? '' : str);
    return s.length > max ? s.slice(0, max) : s;
  }
  function layoutCols(nCols, numericFrom) {
    const left = 32, width = 530;
    const nNum = Math.max(0, nCols - numericFrom);
    const numW = nNum ? Math.min(72, width / Math.max(nCols, 1)) : 0;
    const textW = width - nNum * numW;
    const nText = numericFrom;
    const tw = nText ? textW / nText : width;
    const cols = [];
    let x = left;
    for (let i = 0; i < nCols; i++) {
      const w = i >= numericFrom ? numW : tw;
      cols.push({ x, w });
      x += w;
    }
    return cols;
  }
  function tablePdf(model) {
    const headers = model.headers || [];
    const rows = model.rows || [];
    const numericFrom = model.numericFrom == null ? headers.length : model.numericFrom;
    const per = 42;
    const chunks = [];
    for (let i = 0; i < rows.length; i += per) chunks.push(rows.slice(i, i + per));
    if (!chunks.length) chunks.push([]);
    const cols = layoutCols(headers.length, numericFrom);
    const pages = chunks.map((slice, pi) => {
      const p = Painter();
      p.fill(GREEN[0], GREEN[1], GREEN[2]).rect(0, 806, 595, 28);
      p.fill(1, 1, 1).text('F2', 11, 32, 816, clipPdf(model.title || 'Libro', 360));
      p.fill(MUT[0], MUT[1], MUT[2]);
      p.text('F1', 8, 32, 788, clipPdf(model.subtitle || '', 340));
      p.text('F1', 8, 430, 788, 'Pagina ' + (pi + 1) + ' / ' + chunks.length);
      p.fill(GREEN[0], GREEN[1], GREEN[2]).rect(28, 766, 539, 14);
      p.fill(1, 1, 1);
      headers.forEach((h, i) => p.text('F2', 7, cols[i].x, 770, clipPdf(h, cols[i].w)));
      let y = 750;
      p.fill(INK[0], INK[1], INK[2]);
      for (const row of slice) {
        for (let i = 0; i < headers.length; i++) {
          const text = clipPdf(row[i], cols[i].w);
          if (i >= numericFrom) p.text('F1', 7, cols[i].x + Math.max(0, cols[i].w - text.length * 3.6 - 2), y, text);
          else p.text('F1', 7, cols[i].x, y, text);
        }
        y -= 12;
      }
      p.fill(MUT[0], MUT[1], MUT[2]).text('F1', 7, 32, 36, clipPdf(model.note || '', 150));
      if (model.note && model.note.length > 90) p.text('F1', 7, 32, 26, clipPdf(model.note.slice(90), 150));
      return p.out();
    });
    return build(null, pages);
  }

  root.PaguuPdf = { invoicePdf, relacionPdf, tablePdf, zipStore, pdfLit };
})(typeof window !== 'undefined' ? window : globalThis);
