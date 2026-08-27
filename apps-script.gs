/* ارفع هذا الرقم مع كل تعديل. يظهر في التطبيق وفي doGet،
   فيُعرف أي نسخة منشورة فعلًا دون الحاجة لتسجيل الدخول. */
var SRV = 20260827;

var K = 'mzr-key-2026-almazraatain';
var SS = SpreadsheetApp.getActive();
var PHOTOS = 'almazraatain-photos';

var COLS = {
  Users: ['id','phone','name','role','hash','active','created','email'],
  Sessions: ['token','userId','expires'],
  /* «unit» مضاف في النهاية عمدًا: الترقية تلحق الأعمدة الجديدة آخر الجدول فقط،
     ووضعه في المنتصف يكسر مطابقة أعمدة السجلات القائمة ويوقف الترقية. */
  Harvests: ['id','date','capturedAt','farm','baskets','batch','photo','lat','lng','device','gate','aiBaskets','aiQuality','aiNotes','userId','userName','void','voidReason','opId','unit'],
  Sales: ['id','date','capturedAt','farm','baskets','gross','commission','transport','net','ptype','customer','due','lat','lng','device','userId','userName','void','voidReason','opId','unit'],
  Expenses: ['id','date','capturedAt','category','amount','farm','payer','notes','photo','lat','lng','device','userId','userName','void','voidReason','opId'],
  Payments: ['id','date','saleId','amount','method','userId','userName','void','voidReason','opId'],
  Packing: ['id','date','farm','fromUnit','fromQty','toUnit','toQty','notes','userId','userName','void','voidReason','opId'],
  Log: ['date','userName','action','detail'],
  /* ورقة مستقلة بعناوين عربية ليقرأها صاحب المزرعة من الجدول مباشرة */
  'سجل الدخول': ['التاريخ', 'الوقت', 'المستخدم', 'الحدث', 'التفاصيل']
};

var ACCESS_SHEET = 'سجل الدخول';
var EVENT_AR = {
  login: 'دخول',
  logout: 'خروج',
  'login-failed': 'محاولة فاشلة',
  'login-locked': 'قفل بعد تكرار المحاولات'
};

function doGet(e) { return j({ ok: 1, api: 'almazraatain', srv: SRV }); }

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return j({ error: 'BAD_JSON' }); }
  if (b.k !== K) return j({ error: 'BAD_KEY' });
  try {
    if (b.a === 'status') return j({ needsSetup: rows('Users').length === 0, srv: SRV });
    if (b.a === 'setup') return j(setup(b));
    if (b.a === 'login') return j(login(b));
    if (b.a === 'forgot') return j(forgot(b));
    if (b.a === 'reset') return j(resetPass(b));
    var u = auth(b.t);
    if (!u) return j({ error: 'NO_SESSION' });
    if (b.a === 'all') return j(all(u));
    if (b.a === 'add') return j(add(b, u));
    if (b.a === 'void') return j(voidRow(b, u));
    if (b.a === 'img') return j(img(b));
    if (b.a === 'ai') return j(aiRun(b, u));
    if (b.a === 'setunits') return j(setUnits(b, u));
    if (b.a === 'adduser') return j(addUser(b, u));
    if (b.a === 'setuser') return j(setUser(b, u));
    if (b.a === 'logout') return j(logout(b, u));
    return j({ error: 'BAD_ACTION' });
  } catch (err) { return j({ error: 'ERR', detail: String(err) }); }
}

function j(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* الأعمدة الرقمية والمنطقية تبقى بصيغتها، وكل ما عداها يُجبر كنص صريح
   حتى لا تحوّل Sheets رقم الجوال (+966...) لمعادلة أو التواريخ لصيغة أخرى. */
var NUMCOLS = ['baskets','gross','commission','transport','net','amount','lat','lng','aiBaskets','aiQuality','fromQty','toQty'];
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
  normalisePhones();
}

/* يوحّد أرقام الجوال المخزّنة سابقًا على صيغة 05 — لا يغيّر الرقم نفسه
   بل شكله فقط، والمطابقة تعمل قبل التوحيد وبعده. */
function normalisePhones() {
  var us = readRows('Users'), sheet = sh('Users');
  var col = COLS.Users.indexOf('phone') + 1, n = 0;
  for (var i = 0; i < us.length; i++) {
    var want = local05(us[i].phone);
    if (want && /^05[0-9]{8}$/.test(want) && String(us[i].phone) !== want) {
      sheet.getRange(us[i]._row, col).setValue(want);
      n++;
    }
  }
  if (n) dirty('Users');
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

function logout(b, u) {
  var s = sh('Sessions'), ss = rows('Sessions');
  for (var i = ss.length - 1; i >= 0; i--) if (ss[i].token === b.t) s.deleteRow(ss[i]._row);
  dirty('Sessions');
  log(u, 'logout', '');
  return { ok: 1 };
}

/* لا نكتب المعرّف كاملًا في السجل: قد يُدخل المستخدم كلمة المرور في خانة البريد سهوًا */
function mask(v) {
  var t = String(v || '').trim();
  if (t.length <= 4) return t ? t.charAt(0) + '***' : '-';
  return t.substring(0, 3) + '***' + t.substring(t.length - 2);
}

function roleName(r) { return r === 'admin' ? 'المدير' : r === 'operator' ? 'مشغّل' : 'مطّلع'; }

function log(user, action, detail) {
  append('Log', { date: now(), userName: user ? user.name : '-', action: action, detail: detail });
  if (EVENT_AR[action]) accessLog(user, action, detail);
}

/* حركات الدخول تُكتب أيضًا في ورقتها العربية المستقلة.
   الفصل مقصود: ورقة Log فيها كل شيء ويصعب تصفّحها،
   وهذه ورقة واحدة يقرأها المالك بنظرة. */
function accessLog(user, action, detail) {
  var d = new Date(Date.now() + 3 * 3600000);   /* توقيت الرياض */
  var hh = ('0' + d.getUTCHours()).slice(-2), mm = ('0' + d.getUTCMinutes()).slice(-2);
  var o = {};
  o[COLS[ACCESS_SHEET][0]] = d.toISOString().substring(0, 10);
  o[COLS[ACCESS_SHEET][1]] = hh + ':' + mm;
  o[COLS[ACCESS_SHEET][2]] = user ? user.name : 'غير معروف';
  o[COLS[ACCESS_SHEET][3]] = EVENT_AR[action];
  o[COLS[ACCESS_SHEET][4]] = detail || '';
  append(ACCESS_SHEET, o);
}

function setup(b) {
  if (rows('Users').length > 0) return { error: 'ALREADY_SETUP' };
  if (!b.pass || b.pass.length < 8) return { error: 'SHORT_PASS' };
  var em = canonEmail(b.email);
  if (!validEmail(em)) return { error: 'BAD_EMAIL' };
  var id = uid(), salt = uid();
  var nm = b.name || 'Admin';
  append('Users', { id: id, phone: local05(b.phone), name: nm, role: 'admin',
    hash: salt + '$' + hash(b.pass, salt), active: true, created: now(), email: em });
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

/* المعرّف قد يكون بريدًا أو جوالًا — مفتاح القفل يتبعه */
function idKey(raw) {
  var v = String(raw === undefined || raw === null ? '' : raw);
  return v.indexOf('@') >= 0 ? ('fe_' + canonEmail(v)) : lockKey(v);
}

/* الصيغة المعتمدة للتخزين والعرض: 05xxxxxxxx بلا مفتاح دولة */
function local05(v) {
  var d = canonPhone(v);
  return /^5[0-9]{8}$/.test(d) ? '0' + d : String(v === undefined || v === null ? '' : v);
}

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
  /* المعرّف: البريد أولًا، ويُقبل الجوال أيضًا للحسابات القديمة بلا بريد */
  var raw = String(b.id !== undefined && b.id !== null && b.id !== ''
    ? b.id : (b.phone === undefined || b.phone === null ? '' : b.phone));
  var byEmail = raw.indexOf('@') >= 0;
  var key = idKey(raw);

  var props = PropertiesService.getScriptProperties();
  var p = props.getProperty(key);
  var rec = p ? JSON.parse(p) : { n: 0, at: 0 };
  var mins = (Date.now() - rec.at) / 60000;
  if (rec.n >= MAX_TRIES && mins < LOCK_MIN) {
    log(null, 'login-locked', mask(raw));
    return { error: 'LOCKED' };
  }
  if (mins >= LOCK_MIN) props.deleteProperty(key);

  var us = rows('Users');
  for (var i = 0; i < us.length; i++) {
    var u = us[i];
    var hit = byEmail
      ? (canonEmail(u.email) !== '' && canonEmail(u.email) === canonEmail(raw))
      : samePhone(u.phone, raw);
    if (hit && isTrue(u.active)) {
      var parts = String(u.hash).split('$');
      if (hash(b.pass, parts[0]) === parts[1]) {
        props.deleteProperty(key);
        log(u, 'login', (byEmail ? 'بريد' : 'جوال') + ' · ' + roleName(u.role));
        return { ok: 1, t: mkToken(u.id), user: { id: u.id, name: u.name, role: u.role } };
      }
    }
  }
  rec.n++; rec.at = Date.now();
  props.setProperty(key, JSON.stringify(rec));
  log(null, 'login-failed', mask(raw) + ' · محاولة ' + rec.n + ' من ' + MAX_TRIES);
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
    srv: SRV,
    user: { id: u.id, name: u.name, role: u.role },
    harvests: rows('Harvests'),
    sales: rows('Sales'),
    expenses: rows('Expenses'),
    payments: rows('Payments'),
    packing: rows('Packing'),
    units: getUnits(),
    users: u.role === 'admin' ? clean(rows('Users')) : [],
    authLog: u.role === 'admin' ? authLog(120) : []
  };
}

/* حركات الدخول للمدير. ورقة السجل تكبر بلا حد، فنقرأ آخر شريحة منها فقط
   بدل الورقة كاملة — وإلا بطؤ كل تحديث للبيانات مع مرور الأشهر. */
function authLog(n) {
  var s = sh('Log'), last = s.getLastRow();
  if (last < 2) return [];
  var take = Math.min(last - 1, 500);
  var vals = s.getRange(last - take + 1, 1, take, COLS.Log.length).getValues();
  var out = [];
  for (var i = vals.length - 1; i >= 0 && out.length < n; i--) {
    var a = String(vals[i][2]);
    if (a === 'logout' || a.substring(0, 5) === 'login') {
      out.push({ date: vals[i][0], userName: vals[i][1], action: a, detail: vals[i][3] });
    }
  }
  return out;
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

function stock(farm, unit) {
  var total = 0, i;
  var hs = rows('Harvests');
  for (i = 0; i < hs.length; i++) {
    if (hs[i].farm === farm && unitOf(hs[i]) === unit && !isTrue(hs[i]['void'])) total += Number(hs[i].baskets) || 0;
  }
  var ss = rows('Sales');
  for (i = 0; i < ss.length; i++) {
    if (ss[i].farm === farm && unitOf(ss[i]) === unit && !isTrue(ss[i]['void'])) total -= Number(ss[i].baskets) || 0;
  }
  /* التعبئة تنقص من النوع المصدر وتزيد النوع الناتج */
  var pk = rows('Packing');
  for (i = 0; i < pk.length; i++) {
    if (pk[i].farm !== farm || isTrue(pk[i]['void'])) continue;
    if (String(pk[i].fromUnit) === unit) total -= Number(pk[i].fromQty) || 0;
    if (String(pk[i].toUnit) === unit) total += Number(pk[i].toQty) || 0;
  }
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
      var hUnit = String(r.unit || '').trim();
      if (!hUnit || getUnits().indexOf(hUnit) < 0) return { error: 'BAD_UNIT' };
      var batch = batchNo(r.farm, r.code);
      append('Harvests', { id: id, opId: (r.opId || ''), unit: hUnit, date: now(), capturedAt: r.capturedAt || '', farm: r.farm,
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
      var sUnit = String(r.unit || '').trim();
      if (!sUnit || getUnits().indexOf(sUnit) < 0) return { error: 'BAD_UNIT' };
      if (n > stock(r.farm, sUnit)) return { error: 'NO_STOCK' };
      var net = Number(r.gross) - Number(r.commission || 0) - Number(r.transport || 0);
      if (net < 0) return { error: 'NEG_NET' };
      if (r.ptype === 'credit' && (!r.customer || !r.due)) return { error: 'NEED_CUSTOMER' };
      append('Sales', { id: id, opId: (r.opId || ''), unit: sUnit, date: now(), capturedAt: r.capturedAt || '', farm: r.farm,
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
    if (t === 'Packing') {
      var fq = Number(r.fromQty), tq = Number(r.toQty);
      var fu = String(r.fromUnit || '').trim(), tu = String(r.toUnit || '').trim();
      var units = getUnits();
      if (units.indexOf(fu) < 0 || units.indexOf(tu) < 0) return { error: 'BAD_UNIT' };
      if (fu === tu) return { error: 'SAME_UNIT' };
      if (!(fq > 0) || !(tq > 0)) return { error: 'BAD_QTY' };
      if (fq > stock(r.farm, fu)) return { error: 'NO_STOCK' };
      append('Packing', { id: id, opId: (r.opId || ''), date: now(), farm: r.farm,
        fromUnit: fu, fromQty: fq, toUnit: tu, toQty: tq, notes: r.notes || '',
        userId: u.id, userName: u.name, 'void': false, voidReason: '' });
      log(u, 'packing', fq + ' ' + fu + ' -> ' + tq + ' ' + tu);
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
      if (t === 'Harvests' && stock(list[i].farm, unitOf(list[i])) - Number(list[i].baskets) < 0) return { error: 'STOCK_LOCK' };
      if (t === 'Packing' && stock(list[i].farm, String(list[i].toUnit)) - Number(list[i].toQty) < 0) return { error: 'STOCK_LOCK' };
      s.getRange(list[i]._row, col).setValue(true);
      s.getRange(list[i]._row, col + 1).setValue(b.reason || '');
      dirty(t);
      log(u, 'void', t + ' / ' + b.id + ' / ' + (b.reason || ''));
      return { ok: 1 };
    }
  }
  return { error: 'NOT_FOUND' };
}

function addUser(b, u) {
  if (u.role !== 'admin') return { error: 'NOT_ADMIN' };
  if (!b.pass || b.pass.length < 8) return { error: 'SHORT_PASS' };
  var em = canonEmail(b.email);
  if (em && !validEmail(em)) return { error: 'BAD_EMAIL' };
  var us = rows('Users');
  for (var i = 0; i < us.length; i++) {
    if (samePhone(us[i].phone, b.phone)) return { error: 'DUP_PHONE' };
    if (em && canonEmail(us[i].email) === em) return { error: 'DUP_EMAIL' };
  }
  var salt = uid();
  append('Users', { id: uid(), phone: local05(b.phone), name: b.name, role: b.role || 'operator',
    hash: salt + '$' + hash(b.pass, salt), active: true, created: now(), email: em });
  log(u, 'adduser', b.phone + ' / ' + b.role);
  return { ok: 1 };
}

/* ═══════════ الذكاء الاصطناعي (Gemini) ═══════════
   المفتاح يُحفظ في Project Settings > Script Properties باسم GEMINI_KEY
   ولا يُكتب داخل الكود إطلاقًا. */

/* ═══════════ أنواع التعبئة ═══════════
   قابلة للتعديل من لوحة الإدارة — لا تُثبَّت في الكود
   حتى لا يحتاج تغييرها إعادة نشر. */
var DEFAULT_UNITS = ['صندوق', 'بوكس', 'سلة'];

function getUnits() {
  var raw = PropertiesService.getScriptProperties().getProperty('UNITS');
  if (raw) { try { var a = JSON.parse(raw); if (a && a.length) return a; } catch (x) {} }
  return DEFAULT_UNITS;
}

function setUnits(b, u) {
  if (u.role !== 'admin') return { error: 'NOT_ADMIN' };
  var list = [];
  for (var i = 0; i < (b.units || []).length; i++) {
    var v = String(b.units[i] || '').trim();
    if (v && list.indexOf(v) < 0) list.push(v);
  }
  if (!list.length) return { error: 'NO_UNITS' };
  PropertiesService.getScriptProperties().setProperty('UNITS', JSON.stringify(list));
  log(u, 'units', list.join(' · '));
  return { ok: 1, units: list };
}

/* الوحدة الافتراضية للسجلات القديمة التي سُجّلت قبل إضافة الأنواع */
function unitOf(r) {
  var v = String(r.unit === undefined || r.unit === null ? '' : r.unit).trim();
  return v || 'سلة';
}

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
      if (b.email !== undefined) {
        var nem = canonEmail(b.email);
        if (nem && !validEmail(nem)) return { error: 'BAD_EMAIL' };
        for (var k = 0; k < us.length; k++) {
          if (us[k].id !== b.id && nem && canonEmail(us[k].email) === nem) return { error: 'DUP_EMAIL' };
        }
        s.getRange(us[i]._row, COLS.Users.indexOf('email') + 1).setValue(nem);
      }
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


/* ═══════════ استعادة كلمة المرور بالبريد ═══════════ */
var RESET_TTL_MIN = 15;      /* صلاحية الرمز */
var RESET_MAX_TRIES = 5;     /* محاولات إدخال الرمز */
var RESET_COOLDOWN_SEC = 60; /* بين طلبين لنفس البريد */

function canonEmail(v) { return String(v === undefined || v === null ? '' : v).trim().toLowerCase(); }
function validEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }
function escHtml(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function resetKey(email) { return 'r_' + canonEmail(email); }

function findByEmail(em) {
  var us = rows('Users');
  for (var i = 0; i < us.length; i++) {
    if (canonEmail(us[i].email) === em && isTrue(us[i].active)) return us[i];
  }
  return null;
}

/* يرد بنجاح دائمًا — حتى لا يكشف أي بريد مسجّل في النظام */
function forgot(b) {
  var em = canonEmail(b.email);
  if (!validEmail(em)) return { error: 'BAD_EMAIL' };

  var props = PropertiesService.getScriptProperties();
  var key = resetKey(em);
  var prev = props.getProperty(key);
  if (prev) {
    try {
      var old = JSON.parse(prev);
      /* منع إغراق البريد بالطلبات المتتابعة */
      if (Date.now() - old.at < RESET_COOLDOWN_SEC * 1000) return { ok: 1 };
    } catch (x) {}
  }

  var target = findByEmail(em);
  if (!target) return { ok: 1 };

  var code = String(Math.floor(100000 + Math.random() * 900000));
  props.setProperty(key, JSON.stringify({ code: code, at: Date.now(), tries: 0, id: target.id }));

  MailApp.sendEmail({
    to: em,
    subject: 'رمز استعادة كلمة المرور — مزرعة قرضة ورظف',
    htmlBody:
      '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#14211c">' +
      '<p>مرحبًا ' + escHtml(target.name) + '،</p>' +
      '<p>رمز استعادة كلمة المرور الخاص بك:</p>' +
      '<p style="font-size:32px;font-weight:bold;letter-spacing:8px;direction:ltr;' +
      'background:#e9f4ef;color:#174c3b;padding:14px;border-radius:10px;text-align:center">' + code + '</p>' +
      '<p>الرمز صالح لمدة ' + RESET_TTL_MIN + ' دقيقة.</p>' +
      '<p style="color:#6c7973">إن لم تطلب الاستعادة فتجاهل هذه الرسالة، ولم يتغيّر شيء في حسابك.</p>' +
      '</div>'
  });
  log(null, 'forgot', em);
  return { ok: 1 };
}

function resetPass(b) {
  var em = canonEmail(b.email);
  var props = PropertiesService.getScriptProperties();
  var key = resetKey(em);
  var raw = props.getProperty(key);
  if (!raw) return { error: 'BAD_CODE' };

  var rec;
  try { rec = JSON.parse(raw); } catch (x) { props.deleteProperty(key); return { error: 'BAD_CODE' }; }

  if (Date.now() - rec.at > RESET_TTL_MIN * 60000) { props.deleteProperty(key); return { error: 'CODE_EXPIRED' }; }
  if (rec.tries >= RESET_MAX_TRIES) { props.deleteProperty(key); return { error: 'CODE_LOCKED' }; }

  if (String(b.code === undefined || b.code === null ? '' : b.code).trim() !== rec.code) {
    rec.tries++;
    props.setProperty(key, JSON.stringify(rec));
    return { error: 'BAD_CODE' };
  }
  if (!b.pass || b.pass.length < 8) return { error: 'SHORT_PASS' };

  var us = rows('Users'), sheet = sh('Users'), col = COLS.Users.indexOf('hash') + 1;
  for (var i = 0; i < us.length; i++) {
    if (us[i].id === rec.id) {
      var salt = uid();
      sheet.getRange(us[i]._row, col).setValue(salt + '$' + hash(b.pass, salt));
      dirty('Users');
      props.deleteProperty(key);
      props.deleteProperty(lockKey(us[i].phone));  /* يفك أي قفل محاولات */
      killSessions(us[i].id);                      /* يبطل الجلسات القديمة */
      log(null, 'reset', em);
      return { ok: 1 };
    }
  }
  return { error: 'BAD_CODE' };
}

function killSessions(userId) {
  var sheet = sh('Sessions'), ss = readRows('Sessions'), n = 0;
  for (var i = ss.length - 1; i >= 0; i--) {
    if (ss[i].userId === userId) { sheet.deleteRow(ss[i]._row); n++; }
  }
  if (n) dirty('Sessions');
}
