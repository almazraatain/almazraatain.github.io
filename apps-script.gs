var K = 'mzr-key-2026-almazraatain';
var SS = SpreadsheetApp.getActive();
var PHOTOS = 'almazraatain-photos';

var COLS = {
  Users: ['id','phone','name','role','hash','active','created'],
  Sessions: ['token','userId','expires'],
  Harvests: ['id','date','capturedAt','farm','baskets','batch','photo','lat','lng','device','gate','aiBaskets','aiQuality','aiNotes','userId','userName','void','voidReason'],
  Sales: ['id','date','capturedAt','farm','baskets','gross','commission','transport','net','ptype','customer','due','lat','lng','device','userId','userName','void','voidReason'],
  Expenses: ['id','date','capturedAt','category','amount','farm','payer','notes','photo','lat','lng','device','userId','userName','void','voidReason'],
  Payments: ['id','date','saleId','amount','method','userId','userName','void','voidReason'],
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

/* يضيف أي أعمدة جديدة لجدول قائم دون المساس بالبيانات الموجودة */
function migrate(s, n) {
  var want = COLS[n], have = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  if (have.length >= want.length) {
    var same = true;
    for (var j = 0; j < want.length; j++) if (String(have[j]) !== want[j]) { same = false; break; }
    if (same) return;
  }
  for (var i = 0; i < want.length; i++) {
    if (String(have[i] || '') !== want[i]) {
      fmtCol(s, n, i);
      s.getRange(1, i + 1).setValue(want[i]);
    }
  }
}

function rows(n) {
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

function auth(token) {
  if (!token) return null;
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

function tries(phone) {
  var p = PropertiesService.getScriptProperties().getProperty('f_' + phone);
  return p ? JSON.parse(p) : { n: 0, at: 0 };
}

function bump(phone, ok) {
  var props = PropertiesService.getScriptProperties();
  if (ok) { props.deleteProperty('f_' + phone); return; }
  var rec = tries(phone);
  rec.n++; rec.at = Date.now();
  props.setProperty('f_' + phone, JSON.stringify(rec));
}

/* مقارنة الجوال بالأرقام فقط — تنجح حتى لو أزالت Sheets علامة + */
function digitsOf(v) {
  var s = String(v === undefined || v === null ? '' : v);
  /* Sheets قد تعرض الأرقام الطويلة بصيغة علمية مثل 9.665E+11 */
  if (/^\d+(\.\d+)?[eE][+-]?\d+$/.test(s)) {
    var n = Number(s);
    if (isFinite(n)) s = n.toFixed(0);
  }
  return s.replace(/[^0-9]/g, '');
}
function samePhone(a, b) {
  var x = digitsOf(a), y = digitsOf(b);
  if (!x || !y) return false;
  if (x === y) return true;
  /* 0501234567 مقابل 966501234567 */
  var nx = x.indexOf('966') === 0 ? x.substring(3) : x.replace(/^0/, '');
  var ny = y.indexOf('966') === 0 ? y.substring(3) : y.replace(/^0/, '');
  return nx === ny && nx.length >= 9;
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

function add(b, u) {
  var t = b.t2, r = b.rec, id = uid(), lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (t === 'Harvests') {
      if (!(Number(r.baskets) > 0)) return { error: 'BAD_BASKETS' };
      if (!b.img) return { error: 'NEED_PHOTO' };
      var batch = batchNo(r.farm, r.code);
      append('Harvests', { id: id, date: now(), capturedAt: r.capturedAt || '', farm: r.farm,
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
      append('Sales', { id: id, date: now(), capturedAt: r.capturedAt || '', farm: r.farm,
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
      append('Expenses', { id: id, date: now(), capturedAt: r.capturedAt || '', category: r.category,
        amount: Number(r.amount), farm: r.farm, payer: r.payer, notes: r.notes || '',
        photo: upload(b.img, id), lat: r.lat || '', lng: r.lng || '', device: r.device || '',
        userId: u.id, userName: u.name, 'void': false, voidReason: '' });
      log(u, 'expense', r.category + ' / ' + r.amount);
      return { ok: 1, id: id };
    }
    if (t === 'Payments') {
      if (!(Number(r.amount) > 0)) return { error: 'BAD_AMOUNT' };
      append('Payments', { id: id, date: now(), saleId: r.saleId, amount: Number(r.amount),
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

/* يكتشف نموذجًا صالحًا من مفتاح المستخدم ويحفظه، فلا يتعطل لو تغيرت الأسماء */
function gModel(force) {
  var props = PropertiesService.getScriptProperties();
  if (!force) {
    var saved = props.getProperty('GEMINI_MODEL');
    if (saved) return saved;
  }
  var res = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(gKey()),
    { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  var list = (JSON.parse(res.getContentText()).models) || [];
  var usable = [];
  for (var i = 0; i < list.length; i++) {
    var m = list[i], methods = m.supportedGenerationMethods || m.supportedActions || [];
    if (methods.indexOf('generateContent') < 0) continue;
    var name = String(m.name).replace('models/', '');
    if (name.indexOf('embedding') >= 0 || name.indexOf('imagen') >= 0) continue;
    usable.push(name);
  }
  /* الأفضلية للأخف والأسرع لأن الباقة المجانية أسخى معها */
  var order = ['flash-lite', 'flash', 'pro'];
  for (var o = 0; o < order.length; o++) {
    for (var k = 0; k < usable.length; k++) {
      if (usable[k].indexOf(order[o]) >= 0) {
        props.setProperty('GEMINI_MODEL', usable[k]);
        return usable[k];
      }
    }
  }
  if (usable.length) { props.setProperty('GEMINI_MODEL', usable[0]); return usable[0]; }
  return null;
}

function gJson(prompt, b64, retried) {
  var key = gKey();
  if (!key) return { error: 'NO_AI_KEY' };
  var model = gModel(false);
  if (!model) return { error: 'NO_AI_MODEL' };

  var parts = [{ text: prompt }];
  if (b64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: b64 } });

  var res = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key),
    {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{ role: 'user', parts: parts }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      })
    });

  var code = res.getResponseCode(), body = res.getContentText();
  if (code === 404 && !retried) {
    PropertiesService.getScriptProperties().deleteProperty('GEMINI_MODEL');
    gModel(true);
    return gJson(prompt, b64, true);
  }
  if (code === 429) return { error: 'AI_QUOTA' };
  if (code !== 200) return { error: 'AI_FAIL', detail: body.substring(0, 300) };

  try {
    var txt = JSON.parse(body).candidates[0].content.parts[0].text;
    return { ok: 1, data: JSON.parse(txt) };
  } catch (x) { return { error: 'AI_PARSE' }; }
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
    var m = gModel(false);
    return m ? { ok: 1, model: m } : { error: 'NO_AI_MODEL' };
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
  PropertiesService.getScriptProperties().deleteProperty('f_' + target.phone);
  PropertiesService.getScriptProperties().deleteProperty('f_+' + digitsOf(target.phone));

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
