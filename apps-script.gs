var K = 'mzr-key-2026-almazraatain';
var SS = SpreadsheetApp.getActive();
var PHOTOS = 'almazraatain-photos';

var COLS = {
  Users: ['id','phone','name','role','hash','active','created'],
  Sessions: ['token','userId','expires'],
  Harvests: ['id','date','capturedAt','farm','baskets','batch','photo','lat','lng','device','gate','aiBaskets','aiQuality','aiNotes','userId','userName','void','voidReason','opId'],
  Sales: ['id','date','capturedAt','farm','baskets','gross','commission','transport','net','ptype','customer','due','lat','lng','device','userId','userName','void','voidReason','opId'],
  Expenses: ['id','date','capturedAt','category','amount','farm','payer','notes','photo','lat','lng','device','userId','userName','void','voidReason','opId'],
  Payments: ['id','date','saleId','amount','method','userId','userName','void','voidReason','opId'],
  Log: ['date','userName','action','detail']
};

function doGet(e) { return j({ ok: 1, api: 'almazraatain' }); }

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return j({ error: 'BAD_JSON' }); }
  if (b.k !== K) return j({ error: 'BAD_KEY' });
  try {
    if (b.a === 'status') return j({ needsSetup: rows('Users').length === 0 });
    if (b.a === 'setup') return j(setup(b));
    if (b.a === 'login') return j(login(b));
    var u = auth(b.t);
    if (!u) return j({ error: 'NO_SESSION' });
    if (b.a === 'all') return j(all(u));
    if (b.a === 'add') return j(add(b, u));
    if (b.a === 'void') return j(voidRow(b, u));
    if (b.a === 'img') return j(img(b));
    if (b.a === 'ai') return j(aiRun(b, u));
    if (b.a === 'adduser') return j(addUser(b, u));
    if (b.a === 'setuser') return j(setUser(b, u));
    if (b.a === 'logout') return j(logout(b));
    return j({ error: 'BAD_ACTION' });
  } catch (err) { return j({ error: 'ERR', detail: String(err) }); }
}

function j(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* الأعمدة الرقمية والمنطقية تبقى بصيغتها، وكل ما عداها يُجبر كنص صريح
   حتى لا تحوّل Sheets رقم الجوال (+966...) لمعادلة أو التواريخ لصيغة أخرى. */
var NUMCOLS = ['baskets','gross','commission','transport','net','amount','lat','lng','aiBaskets','aiQuality'];
var BOOLCOLS = ['active','void'];

function sh(n) {
  var s = SS.getSheetByName(n);
  if (!s) { s = SS.insertSheet(n); initSheet(s, n); return s; }
  if (s.getLastRow() === 0) { initSheet(s, n); return s; }
  migrate(s, n);
  return s;
}

function fmtCol(s, n, i) {
  var c = COLS[n][i];
  if (NUMCOLS.indexOf(c) < 0 && BOOLCOLS.indexOf(c) < 0) {
    s.getRange(1, i + 1, s.getMaxRows(), 1).setNumberFormat('@');
  }
}

function initSheet(s, n) {
  for (var i = 0; i < COLS[n].length; i++) fmtCol(s, n, i);
  s.appendRow(COLS[n]);
  s.setFrozenRows(1);
}

/* إضافة الأعمدة الجديدة في النهاية فقط.
   إدراج عمود في المنتصف يزيح بيانات السجلات القديمة ويخلط الحقول،
   لذلك نرفض أي تغيير في ترتيب الأعمدة القائمة ولا نلمس البيانات. */
function migrate(s, n) {
  var want = COLS[n];
  var lastCol = s.getLastColumn();
  if (lastCol >= want.length) return;

  var have = s.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < have.length; i++) {
    if (String(have[i]) !== want[i]) {
      throw new Error('ترتيب أعمدة ' + n + ' لا يطابق الكود عند العمود ' + (i + 1) +
        ' (' + have[i] + ' مقابل ' + want[i] + ') — أوقفت التعديل حماية للبيانات.');
    }
  }
  for (var c = lastCol; c < want.length; c++) {
    fmtCol(s, n, c);
    s.getRange(1, c + 1).setValue(want[c]);
  }
}

/* قراءة الجدول مكلفة، وكانت تتكرر حتى ست مرات في حفظ واحد.
   نخزّنها لحظيًا داخل الطلب الواحد فقط. */
var RCACHE = {};
function dirty(n) { delete RCACHE[n]; }

function rows(n) {
  if (RCACHE[n]) return RCACHE[n];
  var out = readRows(n);
  RCACHE[n] = out;
  return out;
}

function readRows(n) {
  var s = sh(n), last = s.getLastRow();
  if (last < 2) return [];
  var head = COLS[n];
  var vals = s.getRange(2, 1, last - 1, head.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = { _row: i + 2 };
    for (var c = 0; c < head.length; c++) r[head[c]] = vals[i][c];
    out.push(r);
  }
  return out;
}

function append(n, o) {
  var head = COLS[n], line = [];
  for (var c = 0; c < head.length; c++) line.push(o[head[c]] === undefined ? '' : o[head[c]]);
  sh(n).appendRow(line);
  dirty(n);
}

function uid() { return Utilities.getUuid().replace(/-/g, '').substring(0, 12); }
function now() { return new Date().toISOString(); }

function hash(pass, salt) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pass, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(raw);
}

function mkToken(userId) {
  var token = uid() + uid() + uid();
  var exp = new Date(Date.now() + 30 * 864e5).toISOString();
  append('Sessions', { token: token, userId: userId, expires: exp });
  return token;
}

/* الجلسات كانت تتراكم بلا حذف وتُقرأ في كل طلب.
   ننظّف المنتهية مرة كل يوم فيبقى الجدول صغيرًا. */
function sweepSessions() {
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('SWEEP_AT') || 0);
  if (Date.now() - last < 864e5) return;
  props.setProperty('SWEEP_AT', String(Date.now()));
  var sheet = sh('Sessions'), ss = readRows('Sessions'), t = now(), n = 0;
  for (var i = ss.length - 1; i >= 0; i--) {
    if (String(ss[i].expires) <= t) { sheet.deleteRow(ss[i]._row); n++; }
  }
  if (n) dirty('Sessions');
}

function auth(token) {
  if (!token) return null;
  sweepSessions();
  var ss = rows('Sessions');
  for (var i = 0; i < ss.length; i++) {
    if (ss[i].token === token && String(ss[i].expires) > now()) {
      var us = rows('Users');
      for (var u = 0; u < us.length; u++) {
        if (us[u].id === ss[i].userId && isTrue(us[u].active)) return us[u];
      }
    }
  }
  return null;
}

function logout(b) {
  var s = sh('Sessions'), ss = rows('Sessions');
  for (var i = ss.length - 1; i >= 0; i--) if (ss[i].token === b.t) s.deleteRow(ss[i]._row);
  dirty('Sessions');
  return { ok: 1 };
}

function log(user, action, detail) {
  append('Log', { date: now(), userName: user ? user.name : '-', action: action, detail: detail });
}

function setup(b) {
  if (rows('Users').length > 0) return { error: 'ALREADY_SETUP' };
  if (!b.pass || b.pass.length < 8) return { error: 'SHORT_PASS' };
  var id = uid(), salt = uid();
  var nm = b.name || 'Admin';
  append('Users', { id: id, phone: b.phone, name: nm, role: 'admin',
    hash: salt + '$' + hash(b.pass, salt), active: true, created: now() });
  var user = { id: id, name: nm, role: 'admin' };
  log(user, 'setup', b.phone);
  return { ok: 1, t: mkToken(id), user: user };
}

/* حد المحاولات: 5 محاولات فاشلة تقفل الرقم 15 دقيقة */
var MAX_TRIES = 5;
var LOCK_MIN = 15;

/* مفتاح القفل يُبنى على الرقم بعد توحيده لا على نصّه كما أُرسل.
   بدون ذلك يصير لكل صيغة عدّاد مستقل (05… و966… و+966…)
   فيتجاوز المخمِّن الحدَّ بمجرد تبديل الصيغة كل خمس محاولات. */
function lockKey(phone) { return 'f_' + canonPhone(phone); }

function tries(phone) {
  var p = PropertiesService.getScriptProperties().getProperty(lockKey(phone));
  return p ? JSON.parse(p) : { n: 0, at: 0 };
}

function bump(phone, ok) {
  var props = PropertiesService.getScriptProperties();
  if (ok) { props.deleteProperty(lockKey(phone)); return; }
  var rec = tries(phone);
  rec.n++; rec.at = Date.now();
  props.setProperty(lockKey(phone), JSON.stringify(rec));
}

/* مقارنة الجوال بالأرقام فقط — تنجح حتى لو أزالت Sheets علامة + */
function digitsOf(v) {
  var s = String(v === undefined || v === null ? '' : v);
  /* الأرقام العربية-الهندية والفارسية تُحوَّل قبل أي معالجة */
  s = s.replace(/[\u0660-\u0669]/g, function (c) { return c.charCodeAt(0) - 0x0660; })
       .replace(/[\u06F0-\u06F9]/g, function (c) { return c.charCodeAt(0) - 0x06F0; });
  /* Sheets قد تعرض الأرقام الطويلة بصيغة علمية مثل 9.665E+11 */
  if (/^\d+(\.\d+)?[eE][+-]?\d+$/.test(s)) {
    var n = Number(s);
    if (isFinite(n)) s = n.toFixed(0);
  }
  return s.replace(/[^0-9]/g, '');
}
/* صيغة قياسية واحدة للرقم مهما كُتب:
   05x · 5x · 9665x · +9665x · 009665x  ->  5x
   تستخدمها المطابقة ومفتاح القفل معًا حتى لا يختلفا. */
function canonPhone(v) {
  var d = digitsOf(v);
  d = d.replace(/^0+/, '');
  if (d.indexOf('966') === 0) d = d.substring(3);
  return d.replace(/^0+/, '');
}

function samePhone(a, b) {
  var x = canonPhone(a), y = canonPhone(b);
  return !!x && x === y && x.length >= 9;
}

/* الحقول المنطقية قد تعود نصًا من Sheets */
function isTrue(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }

function login(b) {
  var phone = String(b.phone);
  var rec = tries(phone);
  var mins = (Date.now() - rec.at) / 60000;
  if (rec.n >= MAX_TRIES && mins < LOCK_MIN) return { error: 'LOCKED' };
  if (mins >= LOCK_MIN) bump(phone, true);

  var us = rows('Users');
  for (var i = 0; i < us.length; i++) {
    var u = us[i];
    if (samePhone(u.phone, phone) && isTrue(u.active)) {
      var parts = String(u.hash).split('$');
      if (hash(b.pass, parts[0]) === parts[1]) {
        bump(phone, true);
        return { ok: 1, t: mkToken(u.id), user: { id: u.id, name: u.name, role: u.role } };
      }
    }
  }
  bump(phone, false);
  return { error: 'BAD_LOGIN' };
}

function clean(list) {
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var r = list[i], o = {};
    for (var key in r) if (key !== 'hash') o[key] = r[key];
    out.push(o);
  }
  return out;
}

function all(u) {
  return {
    ok: 1,
    user: { id: u.id, name: u.name, role: u.role },
    harvests: rows('Harvests'),
    sales: rows('Sales'),
    expenses: rows('Expenses'),
    payments: rows('Payments'),
    users: u.role === 'admin' ? clean(rows('Users')) : []
  };
}

function folder() {
  var it = DriveApp.getFoldersByName(PHOTOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTOS);
}

function upload(b64, name) {
  if (!b64) return '';
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', name + '.jpg');
  return folder().createFile(blob).getId();
}

function img(b) {
  try {
    var f = DriveApp.getFileById(b.id);
    return { ok: 1, b64: Utilities.base64Encode(f.getBlob().getBytes()) };
  } catch (x) { return { error: 'NO_IMG' }; }
}

function stock(farm) {
  var total = 0, i;
  var hs = rows('Harvests');
  for (i = 0; i < hs.length; i++) if (hs[i].farm === farm && hs[i]['void'] !== true) total += Number(hs[i].baskets);
  var ss = rows('Sales');
  for (i = 0; i < ss.length; i++) if (ss[i].farm === farm && ss[i]['void'] !== true) total -= Number(ss[i].baskets);
  return total;
}

/* اليوم بتوقيت الرياض (UTC+3 ثابت بلا توقيت صيفي) */
function riyadhDay(v) {
  var d = v ? new Date(v) : new Date();
  if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() + 3 * 3600000).toISOString().substring(0, 10);
}

function batchNo(farm, code) {
  var day = riyadhDay(), n = 1;
  var hs = rows('Harvests');
  for (var i = 0; i < hs.length; i++) {
    if (hs[i].farm === farm && riyadhDay(hs[i].date) === day) n++;
  }
  return code + '-' + day.replace(/-/g, '') + '-' + ('00' + n).slice(-3);
}

/* لو انقطع الاتصال بعد أن يحفظ الخادم، يعيد العميل الإرسال.
   نتعرّف على البصمة فنعيد النتيجة السابقة بدل تسجيلها مرتين. */
function seen(table, opid) {
  if (!opid) return null;
  var list = rows(table);
  for (var i = 0; i < list.length; i++) if (String(list[i].opId) === String(opid)) return list[i];
  return null;
}

function add(b, u) {
  var t = b.t2, r = b.rec, id = uid(), lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var dup = seen(t, r && r.opId);
    if (dup) {
      return { ok: 1, id: dup.id, batch: dup.batch, net: dup.net, duplicate: 1 };
    }
    if (t === 'Harvests') {
      if (!(Number(r.baskets) > 0)) return { error: 'BAD_BASKETS' };
      if (!b.img) return { error: 'NEED_PHOTO' };
      var batch = batchNo(r.farm, r.code);
      append('Harvests', { id: id, opId: (r.opId || ''), date: now(), capturedAt: r.capturedAt || '', farm: r.farm,
        baskets: Number(r.baskets), batch: batch, photo: upload(b.img, id),
        lat: r.lat || '', lng: r.lng || '', device: r.device || '', gate: r.gate || '',
        aiBaskets: r.aiBaskets === undefined || r.aiBaskets === '' ? '' : Number(r.aiBaskets),
        aiQuality: r.aiQuality === undefined || r.aiQuality === '' ? '' : Number(r.aiQuality),
        aiNotes: r.aiNotes || '',
        userId: u.id, userName: u.name, 'void': false, voidReason: '' });
      log(u, 'harvest', batch + ' / ' + r.baskets);
      return { ok: 1, id: id, batch: batch };
    }
    if (t === 'Sales') {
      var n = Number(r.baskets);
      if (!(n > 0)) return { error: 'BAD_BASKETS' };
      if (n > stock(r.farm)) return { error: 'NO_STOCK' };
      var net = Number(r.gross) - Number(r.commission || 0) - Number(r.transport || 0);
      if (net < 0) return { error: 'NEG_NET' };
      if (r.ptype === 'credit' && (!r.customer || !r.due)) return { error: 'NEED_CUSTOMER' };
      append('Sales', { id: id, opId: (r.opId || ''), date: now(), capturedAt: r.capturedAt || '', farm: r.farm,
        baskets: n, gross: Number(r.gross),
        commission: Number(r.commission || 0), transport: Number(r.transport || 0), net: net,
        ptype: r.ptype, customer: r.customer || '', due: r.due || '',
        lat: r.lat || '', lng: r.lng || '', device: r.device || '',
        userId: u.id, userName: u.name, 'void': false, voidReason: '' });
      log(u, 'sale', n + ' / ' + net);
      return { ok: 1, id: id, net: net };
    }
    if (t === 'Expenses') {
      if (!(Number(r.amount) > 0)) return { error: 'BAD_AMOUNT' };
      if (!b.img) return { error: 'NEED_PHOTO' };
      append('Expenses', { id: id, opId: (r.opId || ''), date: now(), capturedAt: r.capturedAt || '', category: r.category,
        amount: Number(r.amount), farm: r.farm, payer: r.payer, notes: r.notes || '',
        photo: upload(b.img, id), lat: r.lat || '', lng: r.lng || '', device: r.device || '',
        userId: u.id, userName: u.name, 'void': false, voidReason: '' });
      log(u, 'expense', r.category + ' / ' + r.amount);
      return { ok: 1, id: id };
    }
    if (t === 'Payments') {
      if (!(Number(r.amount) > 0)) return { error: 'BAD_AMOUNT' };
      append('Payments', { id: id, opId: (r.opId || ''), date: now(), saleId: r.saleId, amount: Number(r.amount),
        method: r.method || 'cash', userId: u.id, userName: u.name, 'void': false, voidReason: '' });
      log(u, 'payment', r.saleId + ' / ' + r.amount);
      return { ok: 1, id: id };
    }
    return { error: 'BAD_TABLE' };
  } finally { lock.releaseLock(); }
}

function voidRow(b, u) {
  if (u.role !== 'admin') return { error: 'NOT_ADMIN' };
  var t = b.t2, list = rows(t), s = sh(t), col = COLS[t].indexOf('void') + 1;
  if (col === 0) return { error: 'BAD_TABLE' };
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === b.id) {
      if (t === 'Harvests' && stock(list[i].farm) - Number(list[i].baskets) < 0) return { error: 'STOCK_LOCK' };
      s.getRange(list[i]._row, col).setValue(true);
      s.getRange(list[i]._row, col + 1).setValue(b.reason || '');
      log(u, 'void', t + ' / ' + b.id + ' / ' + (b.reason || ''));
      return { ok: 1 };
    }
  }
  return { error: 'NOT_FOUND' };
}

function addUser(b, u) {
  if (u.role !== 'admin') return { error: 'NOT_ADMIN' };
  if (!b.pass || b.pass.length < 8) return { error: 'SHORT_PASS' };
  var us = rows('Users');
  for (var i = 0; i < us.length; i++) if (samePhone(us[i].phone, b.phone)) return { error: 'DUP_PHONE' };
  var salt = uid();
  append('Users', { id: uid(), phone: b.phone, name: b.name, role: b.role || 'operator',
    hash: salt + '$' + hash(b.pass, salt), active: true, created: now() });
  log(u, 'adduser', b.phone + ' / ' + b.role);
  return { ok: 1 };
}

/* ═══════════ الذكاء الاصطناعي (Gemini) ═══════════
   المفتاح يُحفظ في Project Settings > Script Properties باسم GEMINI_KEY
   ولا يُكتب داخل الكود إطلاقًا. */

function gKey() { return PropertiesService.getScriptProperties().getProperty('GEMINI_KEY'); }

/* يبني قائمة نماذج مرشّحة من مفتاح المستخدم.
   الأفضلية لأسماء latest لأن النسخ المثبّتة (مثل ‎-001) بلا حصة مجانية. */
function gModels(force) {
  var props = PropertiesService.getScriptProperties();
  if (!force) {
    var saved = props.getProperty('GEMINI_MODELS');
    if (saved) { try { return JSON.parse(saved); } catch (x) {} }
  }
  var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models',
    { muteHttpExceptions: true, headers: { 'x-goog-api-key': gKey() } });
  if (res.getResponseCode() !== 200) return [];
  var list = (JSON.parse(res.getContentText()).models) || [];
  var ok = [];
  for (var i = 0; i < list.length; i++) {
    var m = list[i], meth = m.supportedGenerationMethods || m.supportedActions || [];
    if (meth.indexOf('generateContent') < 0) continue;
    var n = String(m.name).replace('models/', '');
    if (/embedding|imagen|tts|image|veo|learnlm|native-audio/i.test(n)) continue;
    ok.push(n);
  }
  function pick(re) { return ok.filter(function (n) { return re.test(n); }); }
  var order = pick(/flash-lite-latest/)
    .concat(pick(/flash-latest/))
    .concat(pick(/^gemini-[0-9.]+-flash-lite$/))
    .concat(pick(/^gemini-[0-9.]+-flash$/))
    .concat(pick(/flash/))
    .concat(ok);
  var seen = {}, out = [];
  for (var k = 0; k < order.length && out.length < 6; k++) {
    if (!seen[order[k]]) { seen[order[k]] = 1; out.push(order[k]); }
  }
  props.setProperty('GEMINI_MODELS', JSON.stringify(out));
  return out;
}

/* يجرّب المرشّحين بالترتيب: يتخطى المستنفد أو غير الموجود إلى التالي */
function gJson(prompt, b64) {
  var key = gKey();
  if (!key) return { error: 'NO_AI_KEY' };
  var models = gModels(false);
  if (!models.length) models = gModels(true);
  if (!models.length) return { error: 'NO_AI_MODEL' };

  var parts = [{ text: prompt }];
  if (b64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: b64 } });
  var payload = JSON.stringify({
    contents: [{ role: 'user', parts: parts }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
  });

  var lastCode = 0, lastBody = '';
  for (var i = 0; i < models.length; i++) {
    var res = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + models[i] + ':generateContent',
      { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { 'x-goog-api-key': key }, payload: payload });
    lastCode = res.getResponseCode();
    lastBody = res.getContentText();
    if (lastCode === 200) {
      try {
        var txt = JSON.parse(lastBody).candidates[0].content.parts[0].text;
        return { ok: 1, data: JSON.parse(txt), model: models[i] };
      } catch (x) { return { error: 'AI_PARSE' }; }
    }
    /* 429 مستنفد · 404 غير موجود · 503 مشغول -> جرّب التالي */
    if (lastCode !== 429 && lastCode !== 404 && lastCode !== 503) break;
    PropertiesService.getScriptProperties().deleteProperty('GEMINI_MODELS');
  }
  if (lastCode === 429) return { error: 'AI_QUOTA' };
  return { error: 'AI_FAIL', detail: String(lastCode) + ' ' + lastBody.substring(0, 200) };
}

var P_INVOICE =
  'أنت محاسب. اقرأ صورة الفاتورة وأعد JSON فقط بهذه الحقول: ' +
  '{"amount": المبلغ الإجمالي النهائي بالريال كرقم عشري بدون رمز عملة, ' +
  '"supplier": اسم المورّد أو المتجر كنص, ' +
  '"date": التاريخ بصيغة YYYY-MM-DD أو "" إن لم يظهر, ' +
  '"category": واحدة فقط من [أسمدة ومغذيات, مياه وري, عمالة, نقل, صيانة, بذور وشتلات, مصروف آخر], ' +
  '"confidence": ثقتك من 0 إلى 1}. ' +
  'إن لم تجد المبلغ فاجعل amount = 0. لا تكتب أي شرح خارج JSON.';

var P_HARVEST =
  'أنت خبير جودة فراولة. حلّل صورة محصول الفراولة وأعد JSON فقط: ' +
  '{"baskets": تقديرك لعدد السلال الظاهرة كرقم صحيح, ' +
  '"quality": تقييم الجودة من 0 إلى 100 بناءً على اللون والنضج والتلف والحجم, ' +
  '"notes": جملة عربية قصيرة جدًا (أقل من 12 كلمة) تصف الحالة, ' +
  '"confidence": ثقتك في عدد السلال من 0 إلى 1}. ' +
  'إن تعذر عدّ السلال فاجعل baskets = 0 و confidence = 0. لا تكتب أي شرح خارج JSON.';

function aiRun(b, u) {
  if (b.mode === 'invoice') return gJson(P_INVOICE, b.img);
  if (b.mode === 'harvest') return gJson(P_HARVEST, b.img);
  if (b.mode === 'ping') {
    if (!gKey()) return { error: 'NO_AI_KEY' };
    /* اختبار حقيقي: يرسل طلبًا فعليًا ليتأكد من الحصة لا من وجود النموذج فقط */
    var t = gJson('أعد JSON فقط: {"ok":1}', '');
    if (t.ok) return { ok: 1, model: t.model };
    return t;
  }
  return { error: 'BAD_ACTION' };
}

function setUser(b, u) {
  if (u.role !== 'admin') return { error: 'NOT_ADMIN' };
  var us = rows('Users'), s = sh('Users');
  for (var i = 0; i < us.length; i++) {
    if (us[i].id === b.id) {
      if (b.id === u.id && b.active === false) return { error: 'SELF_LOCK' };
      if (b.active !== undefined) s.getRange(us[i]._row, COLS.Users.indexOf('active') + 1).setValue(b.active);
      if (b.pass) {
        if (b.pass.length < 8) return { error: 'SHORT_PASS' };
        var salt = uid();
        s.getRange(us[i]._row, COLS.Users.indexOf('hash') + 1).setValue(salt + '$' + hash(b.pass, salt));
      }
      if (b.role) s.getRange(us[i]._row, COLS.Users.indexOf('role') + 1).setValue(b.role);
      log(u, 'setuser', b.id);
      return { ok: 1 };
    }
  }
  return { error: 'NOT_FOUND' };
}


/* ═══════════════════════════════════════════════════════
   نسيت كلمة المرور؟
   شغّل هذه الدالة من محرر Apps Script: اختر resetAdminPassword
   من قائمة الدوال ثم اضغط Run، وستظهر لك في السجل (Execution log)
   كلمة مرور جديدة ورقم الجوال المسجّل بالضبط.
   آمنة لأنها تتطلب الدخول لحسابك في Google — لا يمكن استدعاؤها من الويب.
   ═══════════════════════════════════════════════════════ */
function resetAdminPassword() {
  var us = rows('Users');
  if (!us.length) { Logger.log('لا يوجد مستخدمون. افتح الموقع وأنشئ حساب المدير.'); return; }
  var s = sh('Users');
  var target = us[0];
  for (var i = 0; i < us.length; i++) if (us[i].role === 'admin') { target = us[i]; break; }

  var pass = 'Mzr' + uid().substring(0, 9);
  var salt = uid();
  s.getRange(target._row, COLS.Users.indexOf('hash') + 1).setValue(salt + '$' + hash(pass, salt));
  s.getRange(target._row, COLS.Users.indexOf('active') + 1).setValue(true);
  bump(target.phone, true);

  Logger.log('=======================================');
  Logger.log('رقم الجوال المسجّل : ' + target.phone);
  Logger.log('كلمة المرور الجديدة: ' + pass);
  Logger.log('=======================================');
  Logger.log('سجّل الدخول بهما ثم غيّر كلمة المرور من لوحة الإدارة.');
}

/* يعرض المستخدمين المسجّلين دون كلمات المرور — للتشخيص من المحرر */
function listUsers() {
  var us = rows('Users');
  if (!us.length) { Logger.log('لا يوجد مستخدمون.'); return; }
  for (var i = 0; i < us.length; i++) {
    Logger.log((i + 1) + ') ' + us[i].name + ' | ' + us[i].phone +
      ' | ' + us[i].role + ' | ' + (isTrue(us[i].active) ? 'نشط' : 'معطّل'));
  }
}
