/* مزرعة قرضة ورظف للفراولة — تطبيق الإدارة الكامل */
(function () {
'use strict';

/* ═══════════ الإعدادات ═══════════ */
/* رقم الإصدار يُستخرج من رابط app.js?v=N — لا يُكتب يدويًا فلا يتأخر عن bump.
   يُقرأ فور التحميل لأن currentScript يصير null بعد انتهاء التنفيذ. */
function appVer() {
  var src = (document.currentScript && document.currentScript.src) || '';
  if (!src) {
    var ss = document.getElementsByTagName('script');
    for (var i = 0; i < ss.length; i++) if (/app\.js/.test(ss[i].src)) src = ss[i].src;
  }
  var m = String(src).match(/[?&]v=(\d+)/);
  return m ? m[1] : '?';
}
var APP_V = appVer();

var API_DEFAULT = 'https://script.google.com/macros/s/AKfycbwdv1I5JlkemEBN3MMUUJfOlDlSN0o2C_3Y-fy0S6pIjWk5vQ13_FWi332gORIxZFPShQ/exec';

/* رابط النشر يتبدّل مع كل نشر جديد. أي جهاز حفظ الرابط القديم محليًا
   يبقى يخاطب نشرًا ميتًا للأبد، فنُسقط المحفوظ كلما تغيّر الرابط المدمج. */
try {
  if (localStorage.getItem('mzr_api_seed') !== API_DEFAULT) {
    localStorage.removeItem('mzr_api');
    localStorage.setItem('mzr_api_seed', API_DEFAULT);
  }
} catch (e) {}

var API = localStorage.getItem('mzr_api') || API_DEFAULT;
var KEY = 'mzr-key-2026-almazraatain';

/* الرابط جاهز فقط إذا كان رابط Apps Script صحيح الشكل */
function apiReady() {
  return /^https:\/\/script\.google\.com\/.+\/exec$/.test(API) ||
         /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(API);
}

var FARMS = {
  'قرضة': { code: 'QAR', lat: 18.307193, lng: 42.429743 },
  'رظف':  { code: 'RAD', lat: 18.249335, lng: 42.496246 }
};
var FARM_NAMES = ['قرضة', 'رظف'];
var PARTNERS = ['عبدالاله آل جابر', 'معاذ آل جابر'];
var CATEGORIES = ['أسمدة ومغذيات', 'مياه وري', 'عمالة', 'نقل', 'صيانة', 'بذور وشتلات', 'مصروف آخر'];
var PAYERS = ['صندوق المشروع', 'عبدالاله آل جابر', 'معاذ آل جابر'];

var ERR = {
  BAD_JSON: 'طلب غير صالح', BAD_KEY: 'مفتاح الربط غير صحيح',
  NO_SESSION: 'انتهت الجلسة، سجّل الدخول من جديد', BAD_ACTION: 'أمر غير معروف',
  ALREADY_SETUP: 'تم إعداد النظام مسبقًا', SHORT_PASS: 'كلمة المرور 8 خانات على الأقل',
  BAD_LOGIN: 'رقم الجوال أو كلمة المرور غير صحيحة',
  BAD_EMAIL: 'صيغة البريد الإلكتروني غير صحيحة',
  BAD_UNIT: 'نوع التعبئة غير معروف',
  SAME_UNIT: 'اختر نوعين مختلفين للتعبئة',
  BAD_QTY: 'أدخل كميات صحيحة',
  NO_UNITS: 'لا بد من نوع واحد على الأقل',
  DUP_EMAIL: 'هذا البريد مسجّل لمستخدم آخر',
  BAD_CODE: 'الرمز غير صحيح',
  CODE_EXPIRED: 'انتهت صلاحية الرمز، اطلب رمزًا جديدًا',
  CODE_LOCKED: 'تجاوزت عدد المحاولات، اطلب رمزًا جديدًا',
  LOCKED: 'تم قفل الدخول لهذا الرقم 15 دقيقة بعد 5 محاولات فاشلة', BAD_BASKETS: 'عدد السلال غير صالح',
  NEED_PHOTO: 'الصورة مطلوبة', NO_STOCK: 'لا يمكن بيع أكثر من المخزون المتاح',
  NEG_NET: 'العمولة والنقل أكبر من إجمالي البيع',
  NEED_CUSTOMER: 'اسم العميل وتاريخ الاستحقاق مطلوبان للبيع الآجل',
  BAD_AMOUNT: 'المبلغ غير صالح', BAD_TABLE: 'جدول غير معروف',
  NOT_ADMIN: 'هذه الصلاحية للمدير فقط', NOT_FOUND: 'السجل غير موجود',
  DUP_PHONE: 'رقم الجوال مسجّل مسبقًا', SELF_LOCK: 'لا يمكنك تعطيل حسابك',
  STOCK_LOCK: 'لا يمكن إلغاء هذه الجولة لأن سلالها مباعة', NO_IMG: 'تعذر جلب الصورة',
  NO_AI_KEY: 'لم يُضبط مفتاح الذكاء الاصطناعي في إعدادات الخادم',
  NO_AI_MODEL: 'تعذر العثور على نموذج متاح لمفتاحك',
  AI_QUOTA: 'تجاوزت الحصة المجانية اليومية، حاول غدًا',
  AI_FAIL: 'تعذر تحليل الصورة',
  AI_PARSE: 'رد الذكاء الاصطناعي غير مفهوم',
  ERR: 'حدث خطأ في الخادم'
};

/* ═══════════ الحالة ═══════════ */
var S = {
  token: localStorage.getItem('mzr_token') || '',
  user: null,
  view: 'home',
  tab: 'overview',
  busy: false,
  farm: 'قرضة',
  located: false,
  photo: null,
  queue: [], syncing: false, online: navigator.onLine,
  units: ['صندوق', 'بوكس', 'سلة'],
  db: { harvests: [], sales: [], expenses: [], payments: [], packing: [], users: [], authLog: [] }
};

var root = document.getElementById('root');
var modalBox = document.getElementById('modal');
var toastBox = document.getElementById('toast');

/* ═══════════ أدوات ═══════════ */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function digits(s) {
  return String(s == null ? '' : s)
    .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x0660; })
    .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 0x06F0; });
}
function numOf(v) { var n = parseFloat(digits(v)); return isFinite(n) ? n : 0; }

var fMoney = new Intl.NumberFormat('ar-SA-u-nu-latn', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
var fNum = new Intl.NumberFormat('ar-SA-u-nu-latn');
var fDate = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' });
var fShort = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short' });
var fTime = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { hour: '2-digit', minute: '2-digit' });

function riyal(halalas) { return fMoney.format((Number(halalas) || 0) / 100); }
function num(n) { return fNum.format(Number(n) || 0); }
function dt(iso) { var d = new Date(iso); return isNaN(d) ? '—' : fDate.format(d); }
function dtShort(iso) { var d = new Date(iso); return isNaN(d) ? '—' : fShort.format(d); }
function tm(iso) { var d = new Date(iso); return isNaN(d) ? '' : fTime.format(d); }

/* اليوم بتوقيت الرياض (UTC+3 ثابت) */
function dayOf(iso) {
  var d = new Date(iso);
  if (isNaN(d)) return '';
  return new Date(d.getTime() + 3 * 3600000).toISOString().slice(0, 10);
}
function today() { return dayOf(new Date().toISOString()); }
function daysAgo(n) { return dayOf(new Date(Date.now() - n * 86400000).toISOString()); }

function ago(iso) {
  var diff = Date.now() - new Date(iso).getTime();
  if (!isFinite(diff)) return '—';
  var m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return 'قبل ' + num(m) + ' د';
  var h = Math.floor(m / 60);
  if (h < 24) return 'قبل ' + num(h) + ' س';
  var d = Math.floor(h / 24);
  if (d < 30) return 'قبل ' + num(d) + ' يوم';
  return dtShort(iso);
}

function toast(msg, kind) {
  toastBox.className = 'toast show ' + (kind || '');
  toastBox.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { toastBox.className = 'toast ' + (kind || ''); }, 3600);
}

/* صيغة موحّدة واحدة: 05xxxxxxxx بلا مفتاح دولة.
   يقبل ما يكتبه المستخدم بأي شكل (05… · 5… · 966… · +966… · 00966…)
   ويعيده دائمًا بالصيغة المحلية. */
function phoneCore(raw) {
  var d = digits(raw).replace(/\D/g, '').replace(/^0+/, '');
  if (d.indexOf('966') === 0) d = d.substring(3);
  return d.replace(/^0+/, '');
}

function phoneNorm(raw) {
  var d = phoneCore(raw);
  if (!/^5\d{8}$/.test(d)) throw new Error('رقم الجوال غير صالح (مثال: 0501234567)');
  return '0' + d;
}

/* للعرض فقط — يوحّد شكل الأرقام المخزّنة سابقًا بصيغ أخرى */
function phoneShow(v) {
  var d = phoneCore(v);
  return /^5\d{8}$/.test(d) ? '0' + d : String(v == null ? '' : v);
}

/* ═══════════ الاتصال بالخادم ═══════════ */
function netErr() {
  var e = new Error('لا يوجد اتصال بالإنترنت');
  e.offline = true;
  return e;
}

/* مهلة قصوى لكل طلب — بدونها يبقى الطلب معلّقًا للأبد
   فتعلق معه أعلام الانشغال ويتوقف الحفظ نهائيًا. */
var CALL_TIMEOUT = 45000;

function call(action, extra, timeoutMs) {
  var body = { k: KEY, a: action, t: S.token };
  for (var p in extra) body[p] = extra[p];

  var ctl = typeof AbortController === 'function' ? new AbortController() : null;
  var timedOut = false;
  var timer = setTimeout(function () {
    timedOut = true;
    if (ctl) ctl.abort();
  }, timeoutMs || CALL_TIMEOUT);

  function done(v) { clearTimeout(timer); return v; }
  function fail(e) { clearTimeout(timer); throw e; }

  return fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
    signal: ctl ? ctl.signal : undefined
  }).then(
    function (r) { return r.text(); },
    function () {
      /* فشل شبكة أو انتهت المهلة — يُحفظ محليًا ويُعاد لاحقًا */
      var e = netErr();
      if (timedOut) e.message = 'الخادم لم يستجب خلال المهلة';
      throw e;
    }
  ).then(function (txt) {
    var d;
    /* رد غير JSON يعني خطأ في الخادم لا انقطاعًا في الشبكة —
       التمييز مهم وإلا حُفظت العملية محليًا وأُعيد إرسالها بلا فائدة. */
    try { d = JSON.parse(txt); }
    catch (x) { throw new Error('رد الخادم غير مفهوم — تحقق من رابط الخادم أو أعد نشره'); }
    if (d && d.error) {
      if (d.error === 'NO_SESSION') { S.token = ''; localStorage.removeItem('mzr_token'); }
      throw new Error(ERR[d.error] || d.error);
    }
    return d;
  }).then(done, fail);
}

/* ═══════════ التخزين المحلي (IndexedDB) ═══════════ */
var DB = null;
var DB_DEAD = false;

function idb() {
  if (DB) return Promise.resolve(DB);
  if (DB_DEAD) return Promise.reject(new Error('no-idb'));
  return new Promise(function (res, rej) {
    var settled = false;
    function ok(v) { if (!settled) { settled = true; res(v); } }
    function no(e) { if (!settled) { settled = true; DB_DEAD = true; rej(e); } }

    /* في وضع التصفح الخاص أو عند تعارض التبويبات قد لا يرد المتصفح إطلاقًا،
       فنتوقف بعد خمس ثوانٍ بدل تعليق التطبيق على شاشة التحميل. */
    var guardTimer = setTimeout(function () { no(new Error('idb-timeout')); }, 5000);

    var rq;
    try { rq = indexedDB.open('mzr', 1); }
    catch (x) { clearTimeout(guardTimer); no(x); return; }

    rq.onupgradeneeded = function () {
      var d = rq.result;
      if (!d.objectStoreNames.contains('queue')) d.createObjectStore('queue', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('cache')) d.createObjectStore('cache', { keyPath: 'key' });
    };
    rq.onsuccess = function () { clearTimeout(guardTimer); DB = rq.result; ok(DB); };
    rq.onerror = function () { clearTimeout(guardTimer); no(rq.error); };
    rq.onblocked = function () { clearTimeout(guardTimer); no(new Error('idb-blocked')); };
  });
}
function idbDo(store, mode, fn) {
  return idb().then(function (d) {
    return new Promise(function (res, rej) {
      var tx = d.transaction(store, mode), rq = fn(tx.objectStore(store));
      tx.oncomplete = function () { res(rq && rq.result); };
      tx.onerror = function () { rej(tx.error); };
    });
  }).catch(function () { return null; });
}
function idbPut(store, obj) { return idbDo(store, 'readwrite', function (s) { return s.put(obj); }); }
function idbDel(store, id) { return idbDo(store, 'readwrite', function (s) { return s.delete(id); }); }
function idbAll(store) { return idbDo(store, 'readonly', function (s) { return s.getAll(); }).then(function (r) { return r || []; }); }

/* ═══════════ طابور العمليات غير المرسلة ═══════════ */
function opId() { return 'q' + Date.now() + Math.random().toString(36).slice(2, 7); }

function queueOp(t2, rec, img) {
  var item = { id: opId(), t2: t2, rec: rec, img: img || '', at: new Date().toISOString(), status: 'pending', error: '' };
  return idbPut('queue', item).then(function () {
    S.queue.push(item);
    return { queued: true, id: item.id };
  });
}

/* بصمة فريدة لكل عملية: لو انقطع الاتصال بعد أن يحفظ الخادم
   وأُعيد الإرسال، يتعرّف الخادم عليها ولا يسجّلها مرتين. */
function stamp(rec) {
  if (rec && !rec.opId) rec.opId = opId();
  return rec;
}

/* يرسل العملية فورًا، وإن تعذّر الاتصال يحفظها للرفع لاحقًا */
function submitOp(t2, rec, img) {
  stamp(rec);
  if (!navigator.onLine) return queueOp(t2, rec, img);
  return call('add', { t2: t2, rec: rec, img: img }).catch(function (e) {
    if (e.offline) return queueOp(t2, rec, img);
    throw e;
  });
}

function loadQueue() {
  return idbAll('queue').then(function (q) {
    S.queue = q.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
    return S.queue;
  });
}

function pendingCount() {
  return S.queue.filter(function (q) { return q.status === 'pending'; }).length;
}
function failedCount() {
  return S.queue.filter(function (q) { return q.status === 'failed'; }).length;
}

/* يرفع الطابور بالترتيب — يتوقف فور انقطاع الشبكة */
function syncQueue(loud) {
  if (S.syncing || !navigator.onLine || !S.token) return Promise.resolve(0);
  var items = S.queue.filter(function (q) { return q.status === 'pending'; });
  if (!items.length) return Promise.resolve(0);
  S.syncing = true;
  if (loud) toast('جارٍ رفع ' + num(items.length) + ' عملية محفوظة…');

  var done = 0;
  function step(i) {
    if (i >= items.length) return Promise.resolve();
    var it = items[i];
    return call('add', { t2: it.t2, rec: it.rec, img: it.img })
      .then(function () {
        done++;
        S.queue = S.queue.filter(function (q) { return q.id !== it.id; });
        return idbDel('queue', it.id).then(function () { return step(i + 1); });
      })
      .catch(function (e) {
        if (e.offline) return;
        it.status = 'failed'; it.error = e.message;
        return idbPut('queue', it).then(function () { return step(i + 1); });
      });
  }

  /* العلم يُفكّ في كل المسارات — لو بقي مرفوعًا توقف الرفع للأبد */
  function release(v) { S.syncing = false; return v; }

  return step(0).then(function () {
    S.syncing = false;
    if (done) {
      return refresh().then(function () {
        render();
        toast('تم رفع ' + num(done) + ' عملية', 'good');
        return done;
      }).catch(function () { render(); return done; });
    }
    if (failedCount()) render();
    return done;
  }).then(release, function () { release(); return 0; });
}

function retryFailed() {
  S.queue.forEach(function (q) {
    if (q.status === 'failed') { q.status = 'pending'; q.error = ''; idbPut('queue', q); }
  });
  render();
  return syncQueue(true);
}

function dropQueued(id) {
  S.queue = S.queue.filter(function (q) { return q.id !== id; });
  return idbDel('queue', id).then(function () { render(); });
}

/* ═══════════ ضغط الصور ═══════════ */
function shrink(file, max, q) {
  max = max || 1280; q = q || 0.72;
  return new Promise(function (res, rej) {
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      var w = im.naturalWidth, h = im.naturalHeight;
      var s = Math.min(1, max / Math.max(w, h));
      w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', q).split(',')[1]);
    };
    im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('تعذر قراءة الصورة')); };
    im.src = url;
  });
}

/* ═══════════ الكاميرا المباشرة ═══════════ */
var CAM = { stream: null, shot: null };

function camStop() {
  if (CAM.stream) { CAM.stream.getTracks().forEach(function (t) { t.stop(); }); CAM.stream = null; }
  CAM.shot = null;
}

function openCamera(title) {
  modal('<h3>' + esc(title) + '</h3><p id="camMsg">جارٍ تشغيل الكاميرا…</p>' +
    '<div class="cam-stage"><video id="camVid" playsinline autoplay muted class="hidden"></video>' +
    '<img id="camShot" class="hidden" alt="الصورة الملتقطة"><div class="spin" id="camSpin"></div></div>' +
    '<p class="cam-meta hidden" id="camMeta"></p>' +
    '<div class="modal-actions">' +
      '<button data-act="camClose" id="camCancel">إلغاء</button>' +
      '<button class="go" id="camGo" disabled>التقاط</button></div>' +
    '<div id="camFallback"></div>');

  var vid = document.getElementById('camVid');
  var go = document.getElementById('camGo');
  var msg = document.getElementById('camMsg');

  navigator.mediaDevices && navigator.mediaDevices.getUserMedia ?
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false
    }).then(function (stream) {
      CAM.stream = stream;
      vid.srcObject = stream;
      vid.className = '';
      document.getElementById('camSpin').className = 'spin hidden';
      msg.textContent = 'وجّه الكاميرا نحو المحصول ثم اضغط التقاط';
      go.disabled = false;
      go.onclick = camCapture;
    }).catch(function (err) { camFail(err); })
    : camFail(new Error('no-api'));

  function camFail(err) {
    var denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    document.getElementById('camSpin').className = 'spin hidden';
    msg.innerHTML = denied
      ? 'لم تسمح للمتصفح باستخدام الكاميرا. اسمح بالكاميرا من إعدادات المتصفح ثم أعد المحاولة.'
      : 'تعذر تشغيل الكاميرا على هذا الجهاز.';
    go.className = 'go hidden';
    document.getElementById('camFallback').innerHTML =
      '<label class="camera-box" id="fbBox" style="margin-top:16px!important">' +
      '<input type="file" accept="image/*" capture="environment" id="fbIn">' +
      '<span class="camera-icon">▣</span><b>التقاط بكاميرا الجهاز</b>' +
      '<small>سيُسجَّل أن الصورة لم تُلتقط داخل التطبيق</small></label>';
    document.getElementById('fbIn').onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f || !/^image\//.test(f.type)) return toast('الملف ليس صورة', 'bad');
      shrink(f).then(function (b64) { commit(b64, 'file'); })
        .catch(function (x) { toast(x.message, 'bad'); });
    };
  }

  function camCapture() {
    if (!CAM.stream) return;
    var w = vid.videoWidth, h = vid.videoHeight;
    if (!w || !h) return toast('الكاميرا لم تجهز بعد', 'bad');
    var max = 1280, s = Math.min(1, max / Math.max(w, h));
    var c = document.createElement('canvas');
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext('2d').drawImage(vid, 0, 0, c.width, c.height);
    commit(c.toDataURL('image/jpeg', 0.72).split(',')[1], 'camera');
  }

  function commit(b64, source) {
    camStop();
    S.photo = b64;
    S.photoSource = source;
    S.photoAt = new Date().toISOString();
    S.photoGeo = S.geo || null;
    closeModal();
    render();
    toast(source === 'camera' ? 'تم التقاط الصورة' : 'تم إرفاق الصورة', 'good');
  }
}

/* ═══════════ الذكاء الاصطناعي ═══════════ */
function aiCall(mode, img) {
  if (!navigator.onLine) return Promise.reject(new Error('التحليل يحتاج اتصالًا بالإنترنت'));
  return call('ai', { mode: mode, img: img }).then(function (r) { return r.data || {}; });
}

/* قراءة الفاتورة وتعبئة الحقول */
function readInvoice(btn) {
  if (!S.photo) return toast('صوّر الفاتورة أولًا', 'bad');
  if (S.aiBusy) return;
  S.aiBusy = true;
  var old = btn.textContent;
  btn.disabled = true; btn.textContent = 'جارٍ قراءة الفاتورة…';
  aiCall('invoice', S.photo).then(function (d) {
    S.aiBusy = false; btn.disabled = false; btn.textContent = old;
    var got = [];
    if (d.amount > 0) { document.getElementById('eAmt').value = d.amount; got.push('المبلغ'); }
    if (d.category && CATEGORIES.indexOf(d.category) >= 0) {
      document.getElementById('eCat').value = d.category; got.push('التصنيف');
    }
    var notes = document.getElementById('eNotes');
    var extra = [];
    if (d.supplier) extra.push('المورّد: ' + d.supplier);
    if (d.date) extra.push('تاريخ الفاتورة: ' + d.date);
    if (extra.length && notes && !notes.value.trim()) { notes.value = extra.join(' · '); got.push('الملاحظات'); }

    var conf = Math.round((Number(d.confidence) || 0) * 100);
    var box = document.getElementById('aiHint');
    if (box) {
      box.className = 'ai-hint ' + (conf >= 70 ? 'ok' : 'warn');
      box.innerHTML = got.length
        ? '<b>تمت قراءة: ' + esc(got.join('، ')) + '</b><small>دقة التعرّف ' + num(conf) + '٪ — راجع الأرقام قبل الحفظ</small>'
        : '<b>تعذّرت قراءة بيانات واضحة</b><small>أدخل البيانات يدويًا</small>';
    }
    if (!got.length) toast('لم أتمكن من قراءة الفاتورة، أدخلها يدويًا', 'bad');
  }).catch(function (e) {
    S.aiBusy = false; btn.disabled = false; btn.textContent = old;
    toast(e.message, 'bad');
  });
}

/* تقدير عدد السلال وتقييم الجودة */
function reviewHarvest(btn) {
  if (!S.photo) return toast('التقط صورة المحصول أولًا', 'bad');
  if (S.aiBusy) return;
  S.aiBusy = true;
  var old = btn.textContent;
  btn.disabled = true; btn.textContent = 'جارٍ تحليل الصورة…';
  aiCall('harvest', S.photo).then(function (d) {
    S.aiBusy = false;
    S.aiBaskets = Number(d.baskets) || '';
    S.aiQuality = Number(d.quality) || '';
    S.aiNotes = d.notes || '';
    S.aiConf = Number(d.confidence) || 0;
    render();
  }).catch(function (e) {
    S.aiBusy = false; btn.disabled = false; btn.textContent = old;
    toast(e.message, 'bad');
  });
}

function aiHarvestBox() {
  if (!S.aiBaskets && !S.aiQuality) return '';
  var mine = S.baskets || 0, ai = Number(S.aiBaskets) || 0;
  var gap = mine && ai ? Math.abs(ai - mine) / mine : 0;
  var big = gap > 0.2 && S.aiConf >= 0.4;
  return '<div class="ai-hint ' + (big ? 'warn' : 'ok') + '">' +
    '<b>' + (S.aiQuality ? 'جودة المحصول ' + num(S.aiQuality) + '٪' : 'تحليل الصورة') + '</b>' +
    '<small>' + (S.aiNotes ? esc(S.aiNotes) + ' · ' : '') +
    (ai ? 'تقدير آلي: ' + num(ai) + ' ' + (S.unit || S.units[0]) + (mine ? ' مقابل ' + num(mine) + ' أدخلتها' : '') : 'تعذّر عدّ السلال') +
    (big ? ' — الفارق كبير، تأكد من العدد' : '') + '</small></div>';
}

/* ═══════════ رموز QR ═══════════ */
function qrSvg(text, size) {
  try {
    if (typeof qrcode.stringToBytesFuncs !== 'undefined' && qrcode.stringToBytesFuncs['UTF-8']) {
      qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    }
    var q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    var n = q.getModuleCount(), cell = size / n, r = '';
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (q.isDark(y, x)) {
          r += '<rect x="' + (x * cell).toFixed(2) + '" y="' + (y * cell).toFixed(2) +
               '" width="' + cell.toFixed(2) + '" height="' + cell.toFixed(2) + '"/>';
        }
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size +
      '" width="' + size + '" height="' + size + '" shape-rendering="crispEdges">' +
      '<rect width="' + size + '" height="' + size + '" fill="#fff"/>' +
      '<g fill="#14211c">' + r + '</g></svg>';
  } catch (e) { return '<p class="empty-state">تعذّر توليد الرمز</p>'; }
}

function labelModal(kind, value, title, sub, caption) {
  var payload = 'MZR:' + kind + ':' + value;
  modal('<h3>' + esc(title) + '</h3><p>' + esc(sub) + '</p>' +
    '<div class="qr-label" id="qrLabel">' + qrSvg(payload, 320) +
      '<b>' + esc(caption || value) + '</b><small>مزرعة قرضة ورظف للفراولة</small></div>' +
    '<div class="modal-actions"><button data-act="closeModal">إغلاق</button>' +
    '<button class="go" data-act="printQR">طباعة</button></div>');
}

function printLabel() {
  var el = document.getElementById('qrLabel');
  if (!el) return;
  var w = window.open('', '_blank', 'width=420,height=560');
  if (!w) return toast('اسمح بالنوافذ المنبثقة للطباعة', 'bad');
  w.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
    '<title>ملصق</title><style>body{font-family:Tahoma,Arial,sans-serif;text-align:center;padding:24px}' +
    'svg{width:280px;height:280px}b{display:block;font-size:19px;margin-top:14px;letter-spacing:1px}' +
    'small{display:block;color:#666;margin-top:6px}</style></head><body>' +
    el.innerHTML + '</body></html>');
  w.document.close();
  setTimeout(function () { w.print(); }, 400);
}

/* الماسح الضوئي */
var SCAN = { stream: null, raf: 0, cb: null };
function stopScan() {
  if (SCAN.raf) { cancelAnimationFrame(SCAN.raf); SCAN.raf = 0; }
  if (SCAN.stream) { SCAN.stream.getTracks().forEach(function (t) { t.stop(); }); SCAN.stream = null; }
}

function openScanner(onCode) {
  modal('<h3>مسح الرمز</h3><p id="scanMsg">جارٍ تشغيل الكاميرا…</p>' +
    '<div class="cam-stage"><video id="scanVid" playsinline autoplay muted class="hidden"></video>' +
    '<div class="spin" id="scanSpin"></div><div class="scan-frame hidden" id="scanBox"></div></div>' +
    '<details class="manual"><summary>إدخال الرقم يدويًا</summary>' +
      '<label>رقم التشغيلة أو رمز البوابة<input id="scanManual" placeholder="QAR-20260808-001"></label>' +
      '<button class="mini" data-act="scanManualGo">تأكيد</button></details>' +
    '<div class="modal-actions"><button data-act="scanClose">إلغاء</button></div>');

  SCAN.cb = onCode;
  var vid = document.getElementById('scanVid');
  var msg = document.getElementById('scanMsg');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg.textContent = 'الكاميرا غير متاحة على هذا الجهاز';
    document.getElementById('scanSpin').className = 'spin hidden';
    return;
  }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
    .then(function (stream) {
      SCAN.stream = stream;
      vid.srcObject = stream;
      vid.className = '';
      document.getElementById('scanSpin').className = 'spin hidden';
      document.getElementById('scanBox').className = 'scan-frame';
      msg.textContent = 'وجّه الكاميرا نحو الرمز';
      var c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });
      /* تحليل إطار بدقة كاملة (١٩٢٠×١٠٨٠ ≈ مليونا بكسل) في كل رسمة
         يخنق معالج الجوال ويجمّد الواجهة. نصغّر الإطار ونحلّل
         ست مرات في الثانية فقط — أسرع من قدرة اليد على التثبيت. */
      var MAXW = 640, MIN_GAP = 160, lastRun = 0;

      (function tick(now) {
        if (!SCAN.stream) return;
        SCAN.raf = requestAnimationFrame(tick);
        if (!now) now = Date.now();
        if (now - lastRun < MIN_GAP) return;
        lastRun = now;

        if (vid.readyState !== vid.HAVE_ENOUGH_DATA || typeof jsQR !== 'function') return;
        var vw = vid.videoWidth, vh = vid.videoHeight;
        if (!vw || !vh) return;

        var scale = Math.min(1, MAXW / vw);
        var w = Math.max(1, Math.round(vw * scale));
        var h = Math.max(1, Math.round(vh * scale));
        if (c.width !== w) { c.width = w; c.height = h; }

        ctx.drawImage(vid, 0, 0, w, h);
        var hit;
        try {
          var img = ctx.getImageData(0, 0, w, h);
          hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        } catch (x) { return; }

        if (hit && hit.data) {
          stopScan(); closeModal();
          onCode(String(hit.data).trim());
        }
      })();
    })
    .catch(function () {
      msg.textContent = 'لم تسمح للمتصفح باستخدام الكاميرا';
      document.getElementById('scanSpin').className = 'spin hidden';
    });
}

/* تفسير الرمز الممسوح */
function handleCode(code) {
  var m = /^MZR:(GATE|BATCH):(.+)$/.exec(code);
  if (!m) return toast('رمز غير معروف: ' + code.slice(0, 30), 'bad');
  var kind = m[1], value = m[2];

  if (kind === 'GATE') {
    var name = null;
    FARM_NAMES.forEach(function (f) { if (FARMS[f].code === value || f === value) name = f; });
    if (!name) return toast('رمز بوابة غير معروف', 'bad');
    value = name;
    S.farm = value; S.gate = value; S.located = true;
    render();
    toast('تم تأكيد الحضور في مزرعة ' + value, 'good');
    return;
  }
  var h = S.db.harvests.filter(function (r) { return r.batch === value; })[0];
  if (!h) return toast('لا توجد تشغيلة بهذا الرقم', 'bad');
  batchModal(h);
}

function batchModal(h) {
  modal('<h3>تشغيلة ' + esc(h.batch) + '</h3><p>مزرعة ' + esc(h.farm) + ' · ' + esc(dt(h.date)) + ' — ' + esc(tm(h.date)) + '</p>' +
    '<div class="sum-line"><span>الكمية</span><b>' + num(h.baskets) + ' ' + esc(unitOf(h)) + '</b></div>' +
    (h.aiQuality ? '<div class="sum-line"><span>الجودة المقدَّرة</span><b>' + num(h.aiQuality) + '٪</b></div>' : '') +
    (h.aiNotes ? '<div class="sum-line"><span>ملاحظة</span><b>' + esc(h.aiNotes) + '</b></div>' : '') +
    '<div class="sum-line"><span>سجّلها</span><b>' + esc(h.userName) + '</b></div>' +
    (isVoid(h) ? '<p class="login-error" style="margin-top:14px!important">ملغاة: ' + esc(h.voidReason || '') + '</p>' : '') +
    '<div class="modal-actions"><button data-act="closeModal">إغلاق</button>' +
    (h.photo ? '<button class="go" data-act="img" data-id="' + esc(h.photo) + '">عرض الصورة</button>' : '') +
    '</div>');
}

/* ═══════════ الموقع الجغرافي ═══════════ */
function grabGeo() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(function (p) {
    S.geo = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) };
  }, function () {}, { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 });
}

/* أقرب مزرعة للإحداثيات + المسافة */
function nearestFarm(lat, lng) {
  var best = null, bestD = Infinity;
  FARM_NAMES.forEach(function (f) {
    var d = distKm(lat, lng, FARMS[f].lat, FARMS[f].lng);
    if (d < bestD) { bestD = d; best = f; }
  });
  return { farm: best, km: bestD };
}

/* ═══════════ الحسابات ═══════════ */
function live(list) {
  return (list || []).filter(function (r) { return r['void'] !== true && r['void'] !== 'TRUE'; });
}
function D() {
  return {
    H: live(S.db.harvests), Sa: live(S.db.sales),
    E: live(S.db.expenses), P: live(S.db.payments), K: live(S.db.packing)
  };
}

/* السجلات القديمة سُجّلت قبل إضافة الأنواع فتُنسب لـ«سلة» */
function unitOf(r) {
  var v = String(r.unit == null ? '' : r.unit).trim();
  return v || 'سلة';
}
function stockOf(farm, unit) {
  var d = D(), t = 0;
  d.H.forEach(function (r) { if (r.farm === farm && unitOf(r) === unit) t += Number(r.baskets) || 0; });
  d.Sa.forEach(function (r) { if (r.farm === farm && unitOf(r) === unit) t -= Number(r.baskets) || 0; });
  d.K.forEach(function (r) {
    if (r.farm !== farm) return;
    if (String(r.fromUnit) === unit) t -= Number(r.fromQty) || 0;
    if (String(r.toUnit) === unit) t += Number(r.toQty) || 0;
  });
  /* العمليات المحفوظة محليًا تُحتسب حتى لا يُباع أكثر من المتاح دون إنترنت */
  S.queue.forEach(function (q) {
    if (q.status !== 'pending' || !q.rec || q.rec.farm !== farm) return;
    var qu = String(q.rec.unit || '').trim();
    if (q.t2 === 'Harvests' && qu === unit) t += Number(q.rec.baskets) || 0;
    if (q.t2 === 'Sales' && qu === unit) t -= Number(q.rec.baskets) || 0;
    if (q.t2 === 'Packing') {
      if (String(q.rec.fromUnit) === unit) t -= Number(q.rec.fromQty) || 0;
      if (String(q.rec.toUnit) === unit) t += Number(q.rec.toQty) || 0;
    }
  });
  return t;
}

/* يجمع كميات قائمة حسب نوع التعبئة ويكتبها «100 صندوق · 30 بوكس» */
function byUnit(list, qtyOf, unitFn) {
  var m = {}, order = [];
  (list || []).forEach(function (r) {
    var u = (unitFn || unitOf)(r), q = Number(qtyOf(r)) || 0;
    if (!(u in m)) { m[u] = 0; order.push(u); }
    m[u] += q;
  });
  return order.filter(function (u) { return m[u] !== 0; })
              .map(function (u) { return { unit: u, qty: m[u] }; });
}
function byUnitText(list, qtyOf, unitFn) {
  var a = byUnit(list, qtyOf, unitFn);
  return a.length ? a.map(function (x) { return num(x.qty) + ' ' + x.unit; }).join(' · ') : '0';
}
function baskOf(r) { return r.baskets; }

/* الأنواع التي لها حركة فعلية — لعرض المخزون بلا أصفار لا معنى لها */
function activeUnits() {
  var seen = {}, out = [];
  S.units.forEach(function (x) { seen[x] = true; });
  D().H.forEach(function (r) { seen[unitOf(r)] = true; });
  D().K.forEach(function (r) { seen[String(r.toUnit)] = true; seen[String(r.fromUnit)] = true; });
  for (var k in seen) if (seen[k]) out.push(k);
  return out;
}

function totalStock(unit) { return FARM_NAMES.reduce(function (a, f) { return a + stockOf(f, unit); }, 0); }

/* ملخص المخزون: [{unit, qty}] للأنواع التي فيها رصيد أو حركة */
function stockSummary() {
  return activeUnits().map(function (un) {
    return { unit: un, qty: totalStock(un) };
  }).filter(function (x) { return x.qty !== 0; });
}

function paidFor(saleId) {
  return D().P.reduce(function (a, p) { return p.saleId === saleId ? a + (Number(p.amount) || 0) : a; }, 0);
}
function openCredits() {
  return D().Sa.filter(function (s) { return s.ptype === 'credit'; })
    .map(function (s) {
      var paid = paidFor(s.id);
      return { sale: s, paid: paid, left: (Number(s.net) || 0) - paid };
    })
    .filter(function (x) { return x.left > 0; })
    .sort(function (a, b) { return String(a.sale.due).localeCompare(String(b.sale.due)); });
}
function outstanding() { return openCredits().reduce(function (a, x) { return a + x.left; }, 0); }
function overdue() {
  var t = today();
  return openCredits().filter(function (x) { return x.sale.due && String(x.sale.due) < t; });
}

function sumBy(list, field, filter) {
  return list.reduce(function (a, r) {
    return (!filter || filter(r)) ? a + (Number(r[field]) || 0) : a;
  }, 0);
}

/* توزيع المصروف على المزرعتين (المشترك يُقسَّم بالتساوي) */
function expenseOfFarm(farm) {
  return D().E.reduce(function (a, e) {
    var amt = Number(e.amount) || 0;
    if (e.farm === farm) return a + amt;
    if (e.farm === 'مشترك') return a + Math.round(amt / 2);
    return a;
  }, 0);
}

function partnerBook() {
  var d = D();
  var totalNet = sumBy(d.Sa, 'net');
  var totalExp = sumBy(d.E, 'amount');
  var profit = totalNet - totalExp;
  return PARTNERS.map(function (name) {
    var paid = sumBy(d.E, 'amount', function (e) { return e.payer === name; });
    var share = Math.round(profit / PARTNERS.length);
    return { name: name, paid: paid, share: share, balance: paid + share };
  });
}

/* ═══════════ العرض ═══════════ */
var NAV = [
  ['home', '⌂', 'الرئيسية', 0],
  ['harvest', '▣', 'تسجيل قطاف', 0],
  ['sale', '﷼', 'تسجيل بيع', 0],
  ['expense', '▤', 'تسجيل فاتورة', 0],
  ['pack', '⇄', 'تعبئة', 0],
  ['collect', '✓', 'التحصيل', 0],
  ['log', '≡', 'سجل الحركات', 0],
  ['admin', '◫', 'لوحة الإدارة', 1]
];

function roleName(r) { return r === 'admin' ? 'المدير' : r === 'operator' ? 'مشغّل' : 'مطّلع'; }

function render() {
  if (!S.user) {
    if (S.authMode === 'forgot' || S.authMode === 'reset') {
      root.innerHTML = viewForgot(); bindForgot(); return;
    }
    root.innerHTML = viewAuth(); bindAuth(); return;
  }
  var body =
    S.view === 'harvest' ? viewHarvest() :
    S.view === 'sale' ? viewSale() :
    S.view === 'expense' ? viewExpense() :
    S.view === 'pack' ? viewPack() :
    S.view === 'collect' ? viewCollect() :
    S.view === 'log' ? viewLog() :
    S.view === 'admin' ? viewAdmin() : viewHome();
  root.innerHTML = '<div dir="rtl" class="layout">' + sidebar() + '<div class="main">' + mobileBar() + body + '</div></div>' +
    '<div class="scrim' + (S.menu ? ' show' : '') + '" data-act="menuClose"></div>';
  bind();
  window.scrollTo(0, 0);
}

function sidebar() {
  var initial = esc(String(S.user.name || '؟').trim().charAt(0));
  var late = overdue().length;
  var admin = S.user.role === 'admin';
  return '<aside class="sidebar' + (S.menu ? ' open' : '') + '">' +
    '<div class="side-brand"><span class="brand-mark">ف</span>' +
      '<span><b>مزرعة قرضة ورظف</b><small>للفراولة</small></span></div>' +
    '<div class="side-user"><span class="side-avatar">' + initial + '</span>' +
      '<span><b>' + esc(S.user.name) + '</b><small>' + roleName(S.user.role) + '</small></span></div>' +
    netStrip() +
    '<nav class="side-nav">' + NAV.filter(function (n) { return !n[3] || admin; }).map(function (n) {
      var badge = n[0] === 'collect' && late ? '<span class="nav-badge">' + num(late) + '</span>' : '';
      var pend = pendingCount() + failedCount();
      if (n[0] === 'log' && pend) badge = '<span class="nav-badge' + (failedCount() ? '' : ' amber') + '">' + num(pend) + '</span>';
      return '<button class="nav-item' + (S.view === n[0] ? ' active' : '') + '" data-act="go" data-v="' + n[0] + '">' +
        '<span class="ni">' + n[1] + '</span><span>' + n[2] + '</span>' + badge + '</button>';
    }).join('') + '</nav>' +
    '<div class="side-foot">' +
      '<button class="nav-item" data-act="sync"><span class="ni">⟳</span><span>تحديث البيانات</span></button>' +
      '<button class="nav-item danger" data-act="logout"><span class="ni">⏻</span><span>تسجيل الخروج</span></button>' +
    '</div></aside>';
}

function netStrip() {
  var pend = pendingCount(), fail = failedCount();
  if (S.online && !pend && !fail) return '';
  var cls = !S.online ? 'off' : fail ? 'bad' : 'wait';
  var txt = !S.online
    ? 'بدون إنترنت — العمليات تُحفظ محليًا'
    : fail ? num(fail) + ' عملية فشل رفعها'
    : 'جارٍ رفع ' + num(pend) + ' عملية…';
  return '<div class="netstrip ' + cls + '" data-act="go" data-v="log">' +
    '<span></span>' + esc(txt) + '</div>';
}

function mobileBar() {
  var title = (NAV.filter(function (n) { return n[0] === S.view; })[0] || [, , 'الرئيسية'])[2];
  return '<header class="mobilebar">' +
    '<button class="menu-btn" data-act="menuOpen" aria-label="القائمة">☰</button>' +
    '<b>' + esc(title) + '</b>' +
    '<span class="brand-mark sm">ف</span></header>';
}

/* ── تسجيل الدخول ── */
function viewAuth() {
  if (!apiReady()) {
    return '<main dir="rtl" class="login-page"><form class="login-card" id="apiForm">' +
      '<span class="login-logo">ف</span><h1>ربط النظام</h1>' +
      '<p>ألصق رابط الخادم (Apps Script) لمرة واحدة على هذا الجهاز</p>' +
      '<label>رابط الخادم<input id="apiUrl" required placeholder="https://script.google.com/macros/s/.../exec"></label>' +
      '<button class="primary">حفظ الرابط</button></form></main>';
  }
  var mode = S.authMode || 'loading';
  if (mode === 'loading') {
    return '<main dir="rtl" class="login-page"><div class="login-card"><span class="login-logo">ف</span><h1>جارٍ فتح المنصة…</h1><div class="spin"></div></div></main>';
  }
  var setup = mode === 'setup';
  return '<main dir="rtl" class="login-page"><form class="login-card" id="authForm">' +
    '<span class="login-logo">ف</span><h1>مزرعة قرضة ورظف</h1>' +
    '<p>' + (setup ? 'أنشئ حساب المدير لأول مرة' : 'أدخل بياناتك للوصول إلى المنصة') + '</p>' +
    (setup ? '<label>الاسم<input id="aName" required value="عبدالاله آل جابر"></label>' : '') +
    '<label>البريد الإلكتروني<input id="aId" required type="' + (setup ? 'email' : 'text') + '" ' +
      'inputmode="email" autocomplete="' + (setup ? 'email' : 'username') + '" dir="ltr" ' +
      'placeholder="name@example.com"></label>' +
    (setup
      ? '<label>رقم الجوال<input id="aPhone" required inputmode="tel" dir="ltr" placeholder="05xxxxxxxx"></label>'
      : '<p class="hintline">تقدر تدخل برقم جوالك أيضًا إن كان حسابك بلا بريد</p>') +
    '<label>كلمة المرور<input id="aPass" required type="password" minlength="8" autocomplete="' +
      (setup ? 'new-password' : 'current-password') + '" placeholder="8 خانات على الأقل"></label>' +
    (setup ? '<p class="password-hint">البريد يُستخدم للدخول ولاستعادة كلمة المرور — تأكد من صحته.</p>' : '') +
    '<p class="login-error hidden" id="aErr"></p>' +
    '<button class="primary" id="aBtn">' + (setup ? 'إنشاء حساب المدير' : 'تسجيل الدخول') + '</button>' +
    (setup ? '' : '<button type="button" class="linkbtn" data-act="forgotOpen">نسيت كلمة المرور؟</button>') +
    '<small>اتصال مشفر · البيانات محفوظة في حسابك على Google</small>' +
    '</form></main>';
}

function bindAuth() {
  var apiForm = document.getElementById('apiForm');
  if (apiForm) {
    apiForm.onsubmit = function (e) {
      e.preventDefault();
      var v = document.getElementById('apiUrl').value.trim();
      if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(v)) return toast('الرابط يجب أن ينتهي بـ /exec', 'bad');
      localStorage.setItem('mzr_api', v); API = v; boot();
    };
    return;
  }
  var f = document.getElementById('authForm');
  if (!f) return;
  f.onsubmit = function (e) {
    e.preventDefault();
    var btn = document.getElementById('aBtn'), errBox = document.getElementById('aErr');
    var setup = S.authMode === 'setup';
    var idv = (val('aId') || '').trim();
    var pass = val('aPass') || '';
    var name = setup ? (val('aName') || '').trim() : '';

    function fail(m) {
      errBox.textContent = m; errBox.className = 'login-error';
      btn.disabled = false; btn.textContent = setup ? 'إنشاء حساب المدير' : 'تسجيل الدخول';
    }
    errBox.className = 'login-error hidden';

    var payload = { pass: pass, name: name };
    if (setup) {
      if (idv.indexOf('@') < 0) return fail('أدخل بريدًا إلكترونيًا صحيحًا');
      payload.email = idv;
      try { payload.phone = phoneNorm(val('aPhone')); }
      catch (x) { return fail(x.message); }
    } else {
      if (!idv) return fail('أدخل بريدك الإلكتروني');
      /* الجوال مقبول أيضًا للحسابات القديمة بلا بريد */
      payload.id = idv.indexOf('@') >= 0 ? idv : (function () {
        try { return phoneNorm(idv); } catch (x) { return idv; }
      })();
    }

    btn.disabled = true; btn.textContent = 'جارٍ التحقق…';
    call(setup ? 'setup' : 'login', payload)
      .then(function (d) {
        S.token = d.t; S.user = d.user;
        localStorage.setItem('mzr_token', d.t);
        return refresh();
      })
      .then(function () { S.view = 'home'; render(); toast('أهلًا بك ' + S.user.name, 'good'); })
      .catch(function (x) { fail(x.message); });
  };
}

/* ── الرئيسية ── */
function viewHome() {
  var d = D(), t = today();
  var todayList = d.H.filter(function (r) { return dayOf(r.date) === t; });
  var todayMix = byUnit(todayList, baskOf);
  var todaySales = sumBy(d.Sa, 'net', function (r) { return dayOf(r.date) === t; });
  var late = overdue();
  var acts = recentActivity(6);

  var hour = new Date().getUTCHours() + 3;
  var greet = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء الخير';

  return '' +
  '<section class="hero"><div><span class="eyebrow">' + esc(dt(new Date().toISOString())) + '</span>' +
    '<h1>' + greet + '، ' + esc(String(S.user.name).split(' ')[0]) + '</h1>' +
    '<p>' + (d.H.length ? stockLine() : 'النظام جاهز لاستقبال أول عملية.') + '</p></div></section>' +

  '<section class="quick-actions four">' +
    action('harvest', 'green', '▣', 'سجل قطاف', 'صوّر وأدخل عدد السلال') +
    action('sale', 'red', '﷼', 'سجل بيع', 'نقدي أو آجل') +
    action('expense', 'gold', '▤', 'صوّر فاتورة', 'سجّل مصروفًا جديدًا') +
    action('collect', 'green', '✓', 'تحصيل', 'سداد المبالغ الآجلة') +
  '</section>' +

  '<section class="content-grid"><div>' +
    '<div class="section-title"><div><h2>نظرة سريعة</h2><p>ملخص المشروع اليوم</p></div></div>' +
    '<div class="stats">' +
      stat('إنتاج اليوم', num(todayMix.length ? todayMix[0].qty : 0), todayMix.length ? todayMix[0].unit : '',
           todayMix.length > 1 ? todayMix.slice(1).map(function (x) { return num(x.qty) + ' ' + x.unit; }).join(' · ') : '') +
      stockStat() +
      stat('مبيعات اليوم', num(Math.round(todaySales / 100)), 'ر.س') +
      stat('المستحق الآجل', num(Math.round(outstanding() / 100)), 'ر.س', late.length ? num(late.length) + ' متأخرة' : '', late.length > 0) +
    '</div>' +
    '<div class="farms">' + FARM_NAMES.map(farmCard).join('') + '</div>' +
  '</div>' +
  '<aside class="activity">' +
    '<div class="section-title"><div><h2>آخر العمليات</h2><p>آخر التحديثات المسجلة</p></div></div>' +
    (acts.length ? acts.map(function (a) {
      return '<div class="activity-row"><span class="' + a.tone + '">●</span><div><b>' + esc(a.kind) + '</b>' +
        '<small>' + esc(a.detail) + '</small></div><time>' + esc(ago(a.date)) + '</time></div>';
    }).join('') : '<p class="empty-state">لا توجد عمليات مسجلة بعد.</p>') +
  '</aside></section>' +

  '<section class="alerts"><div><span>' + (late.length ? '!' : '✓') + '</span><div>' +
    '<b>' + (late.length ? num(late.length) + ' مبلغ آجل تجاوز موعد الاستحقاق' : 'لا توجد مبالغ متأخرة') + '</b>' +
    '<small>' + (late.length ? 'إجمالي ' + riyal(late.reduce(function (a, x) { return a + x.left; }, 0)) : 'جميع التحصيلات في موعدها') + '</small>' +
  '</div></div>' +
  '<button data-act="go" data-v="' + (late.length ? 'collect' : 'admin') + '">' + (late.length ? 'فتح التحصيل ←' : 'فتح لوحة الإدارة ←') + '</button></section>';
}

/* منتقي نوع التعبئة — أزرار كبيرة مناسبة للاستخدام في الحقل */
function unitPicker(cur, act, key) {
  return '<div class="unit-pick">' + S.units.map(function (u) {
    return '<button type="button" data-act="' + act + '"' + (key ? ' data-k="' + key + '"' : '') +
      ' data-u="' + esc(u) + '" class="' + (cur === u ? 'active' : '') + '">' + esc(u) + '</button>';
  }).join('') + '</div>';
}

function stockLine() {
  var sum = stockSummary();
  if (!sum.length) return 'لا يوجد مخزون متاح للبيع.';
  return 'المخزون: ' + sum.map(function (x) { return num(x.qty) + ' ' + x.unit; }).join(' · ');
}

function stockStat() {
  var sum = stockSummary();
  if (!sum.length) return stat('المخزون الحالي', '0', '', 'لا يوجد مخزون');
  var main = sum[0], rest = sum.slice(1);
  return '<div class="stat"><span>المخزون الحالي</span>' +
    '<div><b>' + num(main.qty) + '</b><small>' + esc(main.unit) + '</small></div>' +
    (rest.length ? '<p>' + esc(rest.map(function (x) { return num(x.qty) + ' ' + x.unit; }).join(' · ')) + '</p>' : '') +
    '</div>';
}

function farmStockText(f) {
  var parts = activeUnits().map(function (un) { return { u: un, q: stockOf(f, un) }; })
    .filter(function (x) { return x.q !== 0; });
  if (!parts.length) return '0';
  return parts.map(function (x) { return num(x.q) + ' <small>' + esc(x.u) + '</small>'; }).join('<br>');
}

function action(v, tone, icon, title, sub) {
  return '<button data-act="go" data-v="' + v + '"><span class="action-icon ' + tone + '">' + icon + '</span>' +
    '<b>' + title + '</b><small>' + sub + '</small><i>←</i></button>';
}
/* إجمالي الإنتاج قد يكون بأكثر من نوع — نُبرز الأكبر ونذكر البقية تحته */
function prodStat(list) {
  var mix = byUnit(list, baskOf);
  if (!mix.length) return stat('إجمالي الإنتاج', '0', '');
  return stat('إجمالي الإنتاج', num(mix[0].qty), mix[0].unit,
    mix.length > 1 ? mix.slice(1).map(function (x) { return num(x.qty) + ' ' + x.unit; }).join(' · ') : '');
}
function stat(label, value, suffix, note, warn) {
  return '<div class="stat"><span>' + esc(label) + '</span><div><b>' + value + '</b><small>' + esc(suffix) + '</small></div>' +
    (note ? '<p class="' + (warn ? 'warn' : '') + '">' + esc(note) + '</p>' : '') + '</div>';
}
function farmCard(f) {
  var d = D();
  var mine = d.H.filter(function (r) { return r.farm === f; });
  var last = mine.length ? mine[mine.length - 1] : null;
  var t = today();
  var todayB = byUnitText(mine.filter(function (r) { return dayOf(r.date) === t; }), baskOf);
  return '<div class="farm-card"><div class="farm-name"><span>♧</span><div><b>مزرعة ' + esc(f) + '</b>' +
    '<small>' + (last ? 'آخر جولة ' + esc(dtShort(last.date)) + ' · ' + esc(last.batch) : 'لا توجد عمليات بعد') + '</small></div>' +
    '<em>' + (mine.length ? num(mine.length) + ' جولة' : 'جديدة') + '</em></div>' +
    '<div><p><span>آخر جولة</span><b>' + (last ? num(last.baskets) + ' <small>' + esc(unitOf(last)) + '</small>' : '0') + '</b></p>' +
    '<p><span>المخزون</span><b>' + farmStockText(f) + '</b></p>' +
    '<p><span>إنتاج اليوم</span><b>' + todayB + '</b></p></div></div>';
}

function recentActivity(n) {
  var d = D(), out = [];
  d.H.forEach(function (r) { out.push({ date: r.date, tone: 'green', kind: 'قطاف — ' + r.farm, detail: num(r.baskets) + ' ' + unitOf(r) + ' · ' + r.batch }); });
  d.Sa.forEach(function (r) { out.push({ date: r.date, tone: 'red', kind: (r.ptype === 'cash' ? 'بيع نقدي' : 'بيع آجل') + ' — ' + r.farm, detail: num(r.baskets) + ' ' + unitOf(r) + ' · ' + riyal(r.net) + ' صافي' }); });
  d.E.forEach(function (r) { out.push({ date: r.date, tone: 'red', kind: 'مصروف — ' + r.category, detail: riyal(r.amount) + ' · ' + r.farm }); });
  d.P.forEach(function (r) { out.push({ date: r.date, tone: 'green', kind: 'تحصيل', detail: riyal(r.amount) }); });
  return out.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, n);
}

/* ── القطاف ── */
function viewHarvest() {
  return '<section class="flow-page">' + head('تسجيل جولة قطاف', 'صوّر المحصول وسجّل عدد السلال') +
  '<div class="flow-grid"><div class="form-card">' +
    '<div class="step"><span>1</span><b>المزرعة</b></div>' +
    '<div class="farm-pick">' + FARM_NAMES.map(function (f) {
      return '<button data-act="farm" data-f="' + esc(f) + '" class="' + (S.farm === f ? 'active' : '') + '"><span>⌖</span>مزرعة ' + esc(f) +
        '<small>' + (S.farm === f && S.located ? 'الأقرب لموقعك' : 'اختيار يدوي') + '</small></button>';
    }).join('') + '</div>' +
    '<div class="two-btn">' +
      '<button class="locate" data-act="locate">⌖ تحديد من موقعي</button>' +
      '<button class="locate" data-act="scanGate">▦ مسح رمز البوابة</button></div>' +
    (S.gate ? '<div class="ai-hint ok"><b>✓ تم تأكيد الحضور في مزرعة ' + esc(S.gate) + '</b>' +
      '<small>مسحت رمز البوابة، وسيُسجَّل ذلك مع الجولة</small></div>' : '') +
    '<div class="step"><span>2</span><b>صورة المحصول</b></div>' +
    photoBox('صوّر المحصول', 'الكاميرا فقط — لا يمكن الاختيار من الألبوم') +
    (S.photo ? '<button class="ai-btn" data-act="aiHarvest">✨ حلّل الصورة: عدّ السلال وقيّم الجودة</button>' : '') +
    aiHarvestBox() +
    '<div class="step"><span>3</span><b>نوع التعبئة</b></div>' +
    unitPicker(S.unit || S.units[0], 'unit') +
    '<div class="step"><span>4</span><b>الكمية</b></div>' +
    '<div class="counter"><button data-act="dec">−</button><div><strong id="bk">' + num(S.baskets || 0) + '</strong><small>' + esc(S.unit || S.units[0]) + '</small></div><button data-act="inc">+</button></div>' +
    '<div class="quick"><button data-act="add5">+5</button><button data-act="add10">+10</button><button data-act="clr">مسح</button></div>' +
    '<button class="primary" data-act="saveHarvest">حفظ جولة القطاف</button>' +
  '</div>' + aside('قبل الحفظ', ['الصورة إلزامية لكل جولة', 'سيُنشأ رقم تشغيلة تلقائيًا', 'تُضاف السلال للمخزون فورًا', 'يمكن للمدير إلغاء العملية لاحقًا']) +
  '</div></section>';
}

/* زر الكاميرا — لا يفتح ألبوم الصور إطلاقًا */
function photoBox(title, sub) {
  if (S.photo) {
    var live = S.photoSource === 'camera';
    return '<button type="button" class="camera-btn done" data-act="camOpen" data-title="' + esc(title) + '">' +
      '<img class="shot-preview" src="data:image/jpeg;base64,' + S.photo + '" alt="الصورة الملتقطة">' +
      '<b>' + (live ? '✓ صورة مباشرة من الكاميرا' : '⚠ صورة من ملف الجهاز') + '</b>' +
      '<small>' + esc(dt(S.photoAt)) + ' · ' + esc(tm(S.photoAt)) +
      (S.photoGeo ? ' · تم تسجيل الموقع' : ' · بدون موقع') +
      '<br>اضغط لإعادة الالتقاط</small></button>';
  }
  return '<button type="button" class="camera-btn" data-act="camOpen" data-title="' + esc(title) + '">' +
    '<span class="camera-icon">▣</span><b>' + esc(title) + '</b>' +
    '<small>' + esc(sub) + '</small></button>';
}

/* ── سجل الحركات ── */
function allOps() {
  var out = [];
  S.db.harvests.forEach(function (r) {
    out.push({ t: 'harvest', kind: 'جولة قطاف', tone: 'green', icon: '▣', row: r,
      val: num(r.baskets) + ' ' + unitOf(r), sub: 'مزرعة ' + r.farm + ' · ' + r.batch });
  });
  S.db.sales.forEach(function (r) {
    out.push({ t: 'sale', kind: r.ptype === 'cash' ? 'بيع نقدي' : 'بيع آجل', tone: 'red', icon: '﷼', row: r,
      val: riyal(r.net), sub: 'مزرعة ' + r.farm + ' · ' + num(r.baskets) + ' ' + unitOf(r) + (r.customer ? ' · ' + r.customer : '') });
  });
  S.db.expenses.forEach(function (r) {
    out.push({ t: 'expense', kind: 'مصروف — ' + r.category, tone: 'gold', icon: '▤', row: r,
      val: riyal(r.amount), sub: r.farm + ' · ' + r.payer + (r.notes ? ' · ' + r.notes : '') });
  });
  S.db.packing.forEach(function (r) {
    out.push({ t: 'packing', kind: 'تعبئة', tone: 'gold', icon: '⇄', row: r,
      val: num(r.fromQty) + ' ' + r.fromUnit + ' ← ' + num(r.toQty) + ' ' + r.toUnit,
      sub: 'مزرعة ' + r.farm + (r.notes ? ' · ' + r.notes : '') });
  });
  S.db.payments.forEach(function (r) {
    var sale = S.db.sales.filter(function (s) { return s.id === r.saleId; })[0];
    out.push({ t: 'payment', kind: 'تحصيل مبلغ آجل', tone: 'green', icon: '✓', row: r,
      val: riyal(r.amount), sub: sale && sale.customer ? 'من ' + sale.customer : 'سداد' });
  });
  return out.sort(function (a, b) { return String(b.row.date).localeCompare(String(a.row.date)); });
}

function viewLog() {
  var ops = allOps();
  var ft = S.logType || 'all', ff = S.logFarm || 'all', fd = S.logDay || '';
  var shown = ops.filter(function (o) {
    if (ft !== 'all' && o.t !== ft) return false;
    if (ff !== 'all' && o.row.farm !== ff) return false;
    if (fd && dayOf(o.row.date) !== fd) return false;
    return true;
  });
  return '<section class="flow-page">' + head('سجل الحركات', 'كل عملية مع تاريخها ووقتها وصورتها والموقع') +
    '<div class="filters">' +
      '<select data-act="lf" data-k="logType">' +
        opt('all', 'كل الأنواع', ft) + opt('harvest', 'قطاف', ft) + opt('sale', 'بيع', ft) +
        opt('expense', 'مصروفات', ft) + opt('payment', 'تحصيل', ft) + '</select>' +
      '<select data-act="lf" data-k="logFarm">' +
        opt('all', 'كل المزارع', ff) + opt('قرضة', 'مزرعة قرضة', ff) + opt('رظف', 'مزرعة رظف', ff) + '</select>' +
      '<input type="date" data-act="lf" data-k="logDay" value="' + esc(fd) + '" max="' + today() + '">' +
      (fd || ft !== 'all' || ff !== 'all' ? '<button class="mini" data-act="lfClear">مسح الفلاتر</button>' : '') +
      '<button class="mini" data-act="scanAny">▦ مسح رمز</button>' +
    '</div>' +
    queuePanel() +
    '<p class="cam-meta" style="text-align:right">' + num(shown.length) + ' عملية من أصل ' + num(ops.length) + '</p>' +
    (shown.length ? shown.map(logCard).join('') : '<p class="empty-state">لا توجد عمليات مطابقة.</p>') +
  '</section>';
}
function queuePanel() {
  if (!S.queue.length) return '';
  var names = { Harvests: 'جولة قطاف', Sales: 'عملية بيع', Expenses: 'مصروف', Payments: 'تحصيل', Packing: 'تعبئة' };
  return '<div class="qpanel">' +
    '<div class="qhead"><b>عمليات لم تُرفع بعد (' + num(S.queue.length) + ')</b>' +
      (failedCount() ? '<button class="mini" data-act="retryQ">إعادة المحاولة</button>' : '') + '</div>' +
    S.queue.map(function (q) {
      var v = q.rec || {};
      var line = q.t2 === 'Harvests' ? num(v.baskets) + ' ' + esc(unitOf(v)) + ' · ' + esc(v.farm || '')
        : q.t2 === 'Sales' ? num(v.baskets) + ' ' + esc(unitOf(v)) + ' · ' + riyal(v.gross)
        : q.t2 === 'Packing' ? num(v.fromQty) + ' ' + esc(String(v.fromUnit || '')) + ' ← ' + num(v.toQty) + ' ' + esc(String(v.toUnit || ''))
        : q.t2 === 'Expenses' ? riyal(v.amount) + ' · ' + esc(v.category || '')
        : riyal(v.amount);
      return '<div class="qrow ' + q.status + '"><span class="qdot"></span>' +
        '<div><b>' + esc(names[q.t2] || q.t2) + '</b><small>' + line + ' · ' + esc(ago(q.at)) + '</small>' +
        (q.status === 'failed' ? '<em>' + esc(q.error) + '</em>' : '') + '</div>' +
        '<button class="mini danger" data-act="dropQ" data-id="' + esc(q.id) + '">حذف</button></div>';
    }).join('') + '</div>';
}

function opt(v, label, cur) {
  return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(label) + '</option>';
}

function logCard(o) {
  var r = o.row, v = isVoid(r);
  var chips = [];
  chips.push('<span class="chip">' + esc(dt(r.date)) + ' — ' + esc(tm(r.date)) + '</span>');
  chips.push('<span class="chip">' + esc(r.userName || '—') + '</span>');

  if (r.lat && r.lng) {
    var near = nearestFarm(Number(r.lat), Number(r.lng));
    var match = r.farm ? near.farm === r.farm && near.km <= 3 : near.km <= 3;
    chips.push('<span class="chip ' + (match ? 'ok' : 'warn') + '">' +
      (match ? '✓ داخل نطاق ' + esc(near.farm) : '⚠ يبعد ' + num(Math.round(near.km)) + ' كم عن ' + esc(near.farm)) + '</span>');
    chips.push('<a class="chip btn" target="_blank" rel="noopener" href="https://www.google.com/maps?q=' +
      encodeURIComponent(r.lat + ',' + r.lng) + '">الخريطة</a>');
  } else if (o.t === 'harvest' || o.t === 'expense') {
    chips.push('<span class="chip warn">بدون موقع</span>');
  }

  if (r.photo) {
    chips.push('<span class="chip ' + (r.device === 'camera' ? 'ok' : 'warn') + '">' +
      (r.device === 'camera' ? '✓ كاميرا مباشرة' : r.device === 'file' ? '⚠ صورة من ملف' : 'صورة') + '</span>');
    chips.push('<button class="chip btn" data-act="img" data-id="' + esc(r.photo) + '">عرض الصورة</button>');
  }
  if (o.t === 'harvest' && r.gate) chips.push('<span class="chip ok">✓ رمز البوابة</span>');
  if (o.t === 'harvest' && r.aiQuality) {
    chips.push('<span class="chip">جودة ' + num(r.aiQuality) + '٪</span>');
  }
  if (o.t === 'harvest' && Number(r.aiBaskets) > 0) {
    var mine = Number(r.baskets) || 0, est = Number(r.aiBaskets);
    var off = mine ? Math.abs(est - mine) / mine : 0;
    if (off > 0.2) chips.push('<span class="chip warn">تقدير آلي ' + num(est) + ' ' + esc(unitOf(r)) + '</span>');
  }
  if (o.t === 'harvest') {
    chips.push('<button class="chip btn" data-act="label" data-b="' + esc(r.batch) + '">ملصق QR</button>');
  }
  if (r.capturedAt && Math.abs(new Date(r.date) - new Date(r.capturedAt)) > 300000) {
    chips.push('<span class="chip warn">وقت الجهاز ' + esc(tm(r.capturedAt)) + '</span>');
  }
  if (v) chips.push('<span class="chip bad">ملغاة: ' + esc(r.voidReason || '—') + '</span>');
  else if (S.user.role === 'admin' && o.t !== 'payment') {
    chips.push('<button class="chip btn" data-act="void" data-t="' +
      (o.t === 'harvest' ? 'Harvests' : o.t === 'sale' ? 'Sales' : o.t === 'packing' ? 'Packing' : 'Expenses') +
      '" data-id="' + esc(r.id) + '">إلغاء</button>');
  }

  return '<div class="logcard' + (v ? ' void' : '') + '">' +
    '<span class="lic ' + o.tone + '">' + o.icon + '</span>' +
    '<b>' + esc(o.kind) + '</b><span class="lval">' + o.val + '</span>' +
    '<span class="lsub">' + esc(o.sub) + '</span>' +
    '<span class="lmeta">' + chips.join('') + '</span></div>';
}

/* ── البيع ── */
function viewSale() {
  var un = S.unit || S.units[0];
  var st = stockOf(S.farm, un);
  var customers = uniq(D().Sa.map(function (s) { return s.customer; }).filter(Boolean));
  return '<section class="flow-page">' + head('تسجيل بيع', 'سجّل بيع الحراج النقدي أو الآجل') +
  '<div class="flow-grid"><div class="form-card">' +
    '<label>المزرعة<select id="sFarm">' + FARM_NAMES.map(function (f) {
      return '<option' + (S.farm === f ? ' selected' : '') + '>' + esc(f) + '</option>';
    }).join('') + '</select></label>' +
    '<div class="step"><span>◆</span><b>نوع التعبئة</b></div>' +
    unitPicker(un, 'unit') +
    '<div class="stock-line"><span>المخزون المتاح</span><b>' + num(st) + ' ' + esc(un) + '</b></div>' +
    (st > 0 ? '<button class="full-crop" data-act="allStock">بيع كامل المتاح <small>' + num(st) + ' ' + esc(un) + ' تلقائيًا</small></button>'
            : '<p class="empty-state">لا يوجد مخزون في هذه المزرعة. سجّل جولة قطاف أولًا.</p>') +
    '<div class="two"><label>الكمية (' + esc(un) + ')<input id="sBk" inputmode="numeric" type="number" min="1" max="' + st + '"></label>' +
    '<label>إجمالي البيع (ر.س)<input id="sGross" inputmode="decimal" type="number" min="0" step="0.01"></label></div>' +
    '<div class="two"><label>عمولة الحراج (ر.س)<input id="sComm" inputmode="decimal" type="number" min="0" step="0.01"></label>' +
    '<label>تكلفة النقل (ر.س)<input id="sTrans" inputmode="decimal" type="number" min="0" step="0.01"></label></div>' +
    '<div class="pay-tabs"><button data-act="pay" data-p="cash" class="' + (S.ptype !== 'credit' ? 'active' : '') + '">نقدي</button>' +
    '<button data-act="pay" data-p="credit" class="' + (S.ptype === 'credit' ? 'active' : '') + '">آجل</button></div>' +
    (S.ptype === 'credit' ? '<div class="two"><label>العميل<input id="sCust" list="custList" placeholder="اسم العميل أو المؤسسة">' +
      '<datalist id="custList">' + customers.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></label>' +
      '<label>تاريخ الاستحقاق<input id="sDue" type="date" min="' + today() + '"></label></div>' : '') +
    '<div class="calc" id="calcBox">' + calcHtml(0, 0, 0) + '</div>' +
    '<button class="primary" data-act="saveSale"' + (st > 0 ? '' : ' disabled') + '>حفظ عملية البيع</button>' +
  '</div>' + aside('تذكير', ['لا يمكن بيع أكثر من المخزون', 'الآجل يتطلب عميلًا وتاريخ استحقاق', 'العمولة والنقل تُخصم من الصافي', 'يُخصم المخزون فور الحفظ']) +
  '</div></section>';
}
function calcHtml(perB, net, netPerB) {
  return '<div><small>سعر الوحدة</small><b>' + riyal(perB) + '</b></div>' +
    '<div><small>صافي الحصيلة</small><b>' + riyal(net) + '</b></div>' +
    '<div><small>صافي سعر الوحدة</small><b>' + riyal(netPerB) + '</b></div>';
}
function updateCalc() {
  var box = document.getElementById('calcBox');
  if (!box) return;
  var bk = numOf(val('sBk')), gross = Math.round(numOf(val('sGross')) * 100);
  var comm = Math.round(numOf(val('sComm')) * 100), tr = Math.round(numOf(val('sTrans')) * 100);
  var net = gross - comm - tr;
  box.innerHTML = calcHtml(bk ? Math.round(gross / bk) : 0, net, bk ? Math.round(net / bk) : 0);
}
function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }

/* ── المصروفات ── */
function viewExpense() {
  return '<section class="flow-page">' + head('تسجيل فاتورة', 'صوّر الفاتورة ثم أكد بيانات المصروف') +
  '<div class="flow-grid"><div class="form-card">' +
    photoBox('صوّر الفاتورة أو الإيصال', 'الكاميرا فقط') +
    (S.photo ? '<button class="ai-btn" data-act="aiInvoice">✨ اقرأ الفاتورة تلقائيًا</button>' : '') +
    '<div id="aiHint"></div>' +
    '<div class="two"><label>المبلغ (ر.س)<input id="eAmt" type="number" inputmode="decimal" min="0" step="0.01"></label>' +
    '<label>التصنيف<select id="eCat">' + CATEGORIES.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label></div>' +
    '<label>المزرعة المستفيدة<select id="eFarm"><option value="قرضة">مزرعة قرضة</option><option value="رظف">مزرعة رظف</option><option value="مشترك">مشترك بين المزرعتين</option></select></label>' +
    '<label>طريقة الدفع<select id="ePayer">' + PAYERS.map(function (p) {
      return '<option value="' + esc(p) + '">' + esc(p === 'صندوق المشروع' ? 'من صندوق المشروع' : 'دفعه ' + p.split(' ')[0] + ' شخصيًا') + '</option>';
    }).join('') + '</select></label>' +
    '<label>ملاحظات<textarea id="eNotes" placeholder="تفاصيل اختيارية…"></textarea></label>' +
    '<button class="primary" data-act="saveExpense">حفظ المصروف</button>' +
  '</div>' + aside('تصنيف سريع', ['يُحفظ المصروف مع صورته', 'المشترك يُقسَّم مناصفة على المزرعتين', 'الدفع الشخصي يُضاف لحساب الشريك', 'لا تُحتسب مساهمة الشريك كإيراد']) +
  '</div></section>';
}

/* ── التعبئة: تحويل من نوع إلى نوع ── */
function viewPack() {
  var from = S.pkFrom || S.units[0];
  var to = S.pkTo || (S.units[1] || S.units[0]);
  var avail = stockOf(S.farm, from);
  return '<section class="flow-page">' + head('تعبئة', 'حوّل من نوع تعبئة إلى آخر') +
  '<div class="flow-grid"><div class="form-card">' +
    '<label>المزرعة<select id="kFarm">' + FARM_NAMES.map(function (f) {
      return '<option' + (S.farm === f ? ' selected' : '') + '>' + esc(f) + '</option>';
    }).join('') + '</select></label>' +
    '<div class="step"><span>1</span><b>من نوع</b></div>' +
    unitPicker(from, 'punit', 'pkFrom') +
    '<div class="stock-line"><span>المتاح من ' + esc(from) + '</span><b>' + num(avail) + '</b></div>' +
    '<div class="step"><span>2</span><b>إلى نوع</b></div>' +
    unitPicker(to, 'punit', 'pkTo') +
    (from === to ? '<p class="notice">اختر نوعين مختلفين</p>' : '') +
    '<div class="two">' +
      '<label>الكمية المستهلكة (' + esc(from) + ')<input id="kFrom" type="number" inputmode="numeric" min="1" max="' + avail + '"></label>' +
      '<label>الناتج (' + esc(to) + ')<input id="kTo" type="number" inputmode="numeric" min="1"></label>' +
    '</div>' +
    '<label>ملاحظات<textarea id="kNotes" placeholder="اختياري…"></textarea></label>' +
    '<button class="primary" data-act="savePack"' + (avail > 0 && from !== to ? '' : ' disabled') + '>حفظ التعبئة</button>' +
  '</div>' + aside('كيف تعمل', [
    'تُنقص الكمية المستهلكة من مخزون النوع الأول',
    'وتضيف الناتج إلى مخزون النوع الثاني',
    'لا نفترض نسبة ثابتة — أدخل العدد الفعلي',
    'الفرق يظهر في التقارير كنسبة تحويل'
  ]) + '</div></section>';
}

function savePack(btn) {
  var from = S.pkFrom || S.units[0], to = S.pkTo || (S.units[1] || S.units[0]);
  if (from === to) return toast('اختر نوعين مختلفين', 'bad');
  var fq = Math.round(numOf(val('kFrom'))), tq = Math.round(numOf(val('kTo')));
  if (!(fq > 0)) return toast('أدخل الكمية المستهلكة', 'bad');
  if (!(tq > 0)) return toast('أدخل الناتج', 'bad');
  var avail = stockOf(S.farm, from);
  if (fq > avail) return toast('المتاح ' + num(avail) + ' ' + from + ' فقط', 'bad');
  guard(btn, 'حفظ التعبئة', submitOp('Packing', mix({
    farm: S.farm, fromUnit: from, fromQty: fq, toUnit: to, toQty: tq,
    notes: (val('kNotes') || '').trim()
  }), '').then(function (d) {
    return d.queued ? 'حُفظت التعبئة محليًا وستُرفع عند عودة الإنترنت'
                    : 'تم تسجيل التعبئة · ' + num(fq) + ' ' + from + ' ← ' + num(tq) + ' ' + to;
  }));
}

/* ── التحصيل ── */
function viewCollect() {
  var list = openCredits(), t = today();
  return '<section class="flow-page">' + head('تحصيل المبالغ الآجلة', 'المبالغ غير المسددة من المبيعات الآجلة') +
  '<div class="form-card">' +
    '<div class="sum-line total"><span>إجمالي المستحق</span><span>' + riyal(outstanding()) + '</span></div>' +
    (list.length ? '<div class="tablewrap"><table class="data"><thead><tr>' +
      '<th>التاريخ</th><th>العميل</th><th>المزرعة</th><th>الصافي</th><th>المسدَّد</th><th>المتبقي</th><th>الاستحقاق</th><th></th>' +
      '</tr></thead><tbody>' + list.map(function (x) {
        var late = x.sale.due && String(x.sale.due) < t;
        return '<tr><td>' + esc(dtShort(x.sale.date)) + '</td><td>' + esc(x.sale.customer || '—') + '</td>' +
          '<td>' + esc(x.sale.farm) + '</td><td>' + riyal(x.sale.net) + '</td><td>' + riyal(x.paid) + '</td>' +
          '<td><b>' + riyal(x.left) + '</b></td>' +
          '<td class="' + (late ? 'due-soon' : '') + '">' + esc(x.sale.due ? dtShort(x.sale.due) : '—') + (late ? ' ⚠' : '') + '</td>' +
          '<td><button class="mini" data-act="payFor" data-id="' + esc(x.sale.id) + '">تسجيل سداد</button></td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<p class="empty-state">لا توجد مبالغ آجلة غير مسددة.</p>') +
  '</div></section>';
}

function head(title, sub) {
  return '<div class="page-head"><button data-act="go" data-v="home">→</button><div><h1>' + esc(title) + '</h1><p>' + esc(sub) + '</p></div></div>';
}
function aside(title, items) {
  return '<aside class="help-card"><h3>' + esc(title) + '</h3>' +
    items.map(function (i) { return '<p><span>✓</span>' + esc(i) + '</p>'; }).join('') + '</aside>';
}

/* ═══════════ لوحة الإدارة ═══════════ */
/* «من دخل ومتى» في المقدمة عمدًا: الشريط يُمرَّر أفقيًا على الجوال،
   وما بعد الثالث لا يُرى إلا بتمرير فيظن المستخدم أنه غير موجود. */
var TABS = [
  ['overview', 'نظرة عامة'], ['access', 'من دخل ومتى'], ['harvests', 'الإنتاج'],
  ['sales', 'المبيعات'], ['expenses', 'المصروفات'], ['partners', 'الشركاء'],
  ['users', 'المستخدمون'], ['tools', 'الرموز والأدوات']
];

function viewAdmin() {
  return '<section class="admin-page">' + head('لوحة الإدارة والتحليل', 'المشروع كاملًا · ' + num(D().H.length + D().Sa.length + D().E.length) + ' عملية مسجلة') +
    '<div class="admin-tabs">' + TABS.map(function (t) {
      return '<button data-act="tab" data-t="' + t[0] + '" class="' + (S.tab === t[0] ? 'active' : '') + '">' + t[1] + '</button>';
    }).join('') + '</div>' +
    (S.tab === 'harvests' ? tabHarvests() : S.tab === 'sales' ? tabSales() :
     S.tab === 'expenses' ? tabExpenses() : S.tab === 'partners' ? tabPartners() :
     S.tab === 'users' ? tabUsers() : S.tab === 'access' ? tabAccess() :
     S.tab === 'tools' ? tabTools() : tabOverview()) +
  '</section>';
}

function tabOverview() {
  var d = D();
  var totalB = sumBy(d.H, 'baskets');
  var netSales = sumBy(d.Sa, 'net');
  var grossSales = sumBy(d.Sa, 'gross');
  var exp = sumBy(d.E, 'amount');
  var profit = netSales - exp;

  var days = [], i;
  for (i = 6; i >= 0; i--) days.push(daysAgo(i));
  var perDay = days.map(function (day) {
    return { day: day, v: sumBy(d.H, 'baskets', function (r) { return dayOf(r.date) === day; }) };
  });
  var maxV = Math.max.apply(null, perDay.map(function (x) { return x.v; }).concat([1]));

  var cats = {};
  d.E.forEach(function (e) { cats[e.category] = (cats[e.category] || 0) + (Number(e.amount) || 0); });
  var catList = Object.keys(cats).map(function (k) { return { k: k, v: cats[k] }; })
    .sort(function (a, b) { return b.v - a.v; });

  return '<div class="admin-kpis">' +
      prodStat(d.H) +
      stat('صافي المبيعات', num(Math.round(netSales / 100)), 'ر.س', 'الإجمالي ' + riyal(grossSales)) +
      stat('المصروفات', num(Math.round(exp / 100)), 'ر.س') +
      stat(profit >= 0 ? 'الربح التقديري' : 'الخسارة التقديرية', num(Math.abs(Math.round(profit / 100))), 'ر.س', '', profit < 0) +
    '</div>' +
    '<div class="analysis-grid">' +
      '<div class="chart-card"><h2>العبوات المقطوفة — آخر 7 أيام</h2>' +
        '<p class="password-hint" style="margin:-6px 0 10px!important">مجموع العبوات بكل أنواعها · ' +
          esc(byUnitText(d.H.filter(function (r) { return days.indexOf(dayOf(r.date)) > -1; }), baskOf)) + '</p>' +
        (totalB ? '<div class="bars2">' + perDay.map(function (x) {
          return '<div><b>' + (x.v ? num(x.v) : '') + '</b><i style="height:' + Math.round((x.v / maxV) * 100) + '%"></i><span>' + esc(dtShort(x.day)) + '</span></div>';
        }).join('') + '</div>' : '<p class="empty-state">سيظهر الرسم بعد تسجيل جولات القطاف.</p>') +
      '</div>' +
      '<div class="chart-card"><h2>توزيع المصروفات</h2>' +
        (catList.length ? catList.map(function (c) {
          return '<div class="catrow"><div><span>' + esc(c.k) + '</span><b>' + riyal(c.v) + '</b></div>' +
            '<i><em style="width:' + Math.round((c.v / catList[0].v) * 100) + '%"></em></i></div>';
        }).join('') : '<p class="empty-state">لا توجد مصروفات مسجلة.</p>') +
      '</div></div>' +
    '<div class="chart-card" style="margin-top:15px"><h2>ملخص كل مزرعة</h2>' +
      FARM_NAMES.map(function (f) {
        var fn = sumBy(d.Sa, 'net', function (r) { return r.farm === f; });
        var fe = expenseOfFarm(f);
        return '<div class="sum-line"><span>مزرعة ' + esc(f) + ' · ' + byUnitText(d.H.filter(function (r) { return r.farm === f; }), baskOf) + '</span>' +
          '<span>مبيعات ' + riyal(fn) + ' — مصروفات ' + riyal(fe) + ' = <b>' + riyal(fn - fe) + '</b></span></div>';
      }).join('') + '</div>';
}

function tabHarvests() {
  var rows = S.db.harvests.slice().sort(byDateDesc);
  return '<div class="chart-card">' +
    '<div class="sum-line total"><span>إجمالي الإنتاج</span><span>' + byUnitText(D().H, baskOf) + '</span></div>' +
    (rows.length ? '<div class="tablewrap"><table class="data"><thead><tr><th>التاريخ</th><th>الوقت</th><th>المزرعة</th><th>رقم التشغيلة</th><th>الكمية</th><th>النوع</th><th>المستخدم</th><th>الصورة</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr class="' + (isVoid(r) ? 'void' : '') + '"><td>' + esc(dtShort(r.date)) + '</td><td>' + esc(tm(r.date)) + '</td>' +
          '<td>' + esc(r.farm) + '</td><td>' + esc(r.batch) + '</td><td><b>' + num(r.baskets) + '</b></td>' +
          '<td>' + esc(unitOf(r)) + '</td><td>' + esc(r.userName) + '</td>' +
          '<td>' + (r.photo ? '<button class="mini" data-act="img" data-id="' + esc(r.photo) + '">عرض</button>' : '—') + '</td>' +
          '<td>' + rowAction(r, 'Harvests') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="empty-state">لا توجد جولات قطاف.</p>') + '</div>';
}

function tabSales() {
  var rows = S.db.sales.slice().sort(byDateDesc);
  var d = D();
  return '<div class="chart-card">' +
    '<div class="sum-line"><span>إجمالي البيع</span><span>' + riyal(sumBy(d.Sa, 'gross')) + '</span></div>' +
    '<div class="sum-line"><span>العمولات والنقل</span><span>−' + riyal(sumBy(d.Sa, 'commission') + sumBy(d.Sa, 'transport')) + '</span></div>' +
    '<div class="sum-line total"><span>صافي المبيعات</span><span>' + riyal(sumBy(d.Sa, 'net')) + '</span></div>' +
    (rows.length ? '<div class="tablewrap"><table class="data"><thead><tr><th>التاريخ</th><th>المزرعة</th><th>الكمية</th><th>النوع</th><th>الإجمالي</th><th>عمولة</th><th>نقل</th><th>الصافي</th><th>النوع</th><th>العميل</th><th>الحالة</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        var paid = paidFor(r.id), left = (Number(r.net) || 0) - paid;
        var status = r.ptype === 'cash' ? '<span class="tag">نقدي</span>'
          : left <= 0 ? '<span class="tag">مسدَّد</span>'
          : '<span class="tag red">متبقي ' + riyal(left) + '</span>';
        return '<tr class="' + (isVoid(r) ? 'void' : '') + '"><td>' + esc(dtShort(r.date)) + '</td><td>' + esc(r.farm) + '</td>' +
          '<td>' + num(r.baskets) + '</td><td>' + esc(unitOf(r)) + '</td><td>' + riyal(r.gross) + '</td><td>' + riyal(r.commission) + '</td>' +
          '<td>' + riyal(r.transport) + '</td><td><b>' + riyal(r.net) + '</b></td>' +
          '<td>' + (r.ptype === 'cash' ? 'نقدي' : 'آجل') + '</td><td>' + esc(r.customer || '—') + '</td>' +
          '<td>' + (isVoid(r) ? '<span class="tag grey">ملغاة</span>' : status) + '</td>' +
          '<td>' + rowAction(r, 'Sales') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="empty-state">لا توجد مبيعات.</p>') + '</div>';
}

function tabExpenses() {
  var rows = S.db.expenses.slice().sort(byDateDesc);
  return '<div class="chart-card">' +
    '<div class="sum-line total"><span>إجمالي المصروفات</span><span>' + riyal(sumBy(D().E, 'amount')) + '</span></div>' +
    (rows.length ? '<div class="tablewrap"><table class="data"><thead><tr><th>التاريخ</th><th>التصنيف</th><th>المبلغ</th><th>المزرعة</th><th>الدافع</th><th>ملاحظات</th><th>الفاتورة</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr class="' + (isVoid(r) ? 'void' : '') + '"><td>' + esc(dtShort(r.date)) + '</td><td>' + esc(r.category) + '</td>' +
          '<td><b>' + riyal(r.amount) + '</b></td><td>' + esc(r.farm) + '</td><td>' + esc(r.payer) + '</td>' +
          '<td>' + esc(r.notes || '—') + '</td>' +
          '<td>' + (r.photo ? '<button class="mini" data-act="img" data-id="' + esc(r.photo) + '">عرض</button>' : '—') + '</td>' +
          '<td>' + rowAction(r, 'Expenses') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="empty-state">لا توجد مصروفات.</p>') + '</div>';
}

function tabPartners() {
  var book = partnerBook(), d = D();
  var profit = sumBy(d.Sa, 'net') - sumBy(d.E, 'amount');
  return '<div class="chart-card">' +
    '<div class="sum-line"><span>صافي المبيعات</span><span>' + riyal(sumBy(d.Sa, 'net')) + '</span></div>' +
    '<div class="sum-line"><span>إجمالي المصروفات</span><span>−' + riyal(sumBy(d.E, 'amount')) + '</span></div>' +
    '<div class="sum-line total"><span>' + (profit >= 0 ? 'الربح القابل للتوزيع' : 'الخسارة') + '</span><span>' + riyal(Math.abs(profit)) + '</span></div>' +
    '</div>' +
    '<div class="partners"><h2>حسابات الشركاء</h2>' +
      book.map(function (p) {
        return '<div><b>' + esc(p.name) + '</b><span>نسبة الملكية 50% · دفع من جيبه ' + riyal(p.paid) + '</span>' +
          '<strong>' + riyal(p.balance) + '</strong></div>';
      }).join('') +
      '<p class="password-hint" style="margin-top:18px!important">الرصيد = ما دفعه الشريك من جيبه + حصته من الربح (50%). المبلغ الموجب يعني أن المشروع مدين له.</p>' +
    '</div>';
}

function tabUsers() {
  var us = S.db.users || [];
  return '<div class="chart-card"><h2>المستخدمون</h2>' +
    (us.length ? us.map(function (u) {
      var active = u.active === true || u.active === 'TRUE';
      var role = u.role === 'admin' ? 'مدير' : u.role === 'operator' ? 'مشغّل' : 'مطّلع';
      return '<div class="userrow"><div><b>' + esc(u.name) + ' <span class="tag' + (active ? '' : ' grey') + '">' + role + '</span></b>' +
        '<small>' + esc(phoneShow(u.phone)) + ' · ' + (active ? 'نشط' : 'معطّل') +
        (u.email ? ' · ' + esc(u.email) : ' · <b style="color:var(--red)">بلا بريد</b>') + '</small></div>' +
        '<button class="mini" data-act="chmail" data-id="' + esc(u.id) + '" data-name="' + esc(u.name) +
        '" data-email="' + esc(u.email || '') + '">البريد</button>' +
        '<button class="mini" data-act="chpass" data-id="' + esc(u.id) + '" data-name="' + esc(u.name) + '">كلمة المرور</button>' +
        (u.id === S.user.id ? '<span class="tag">أنت</span>'
          : '<button class="mini ' + (active ? 'danger' : '') + '" data-act="toggleUser" data-id="' + esc(u.id) + '" data-on="' + (active ? '0' : '1') + '">' + (active ? 'تعطيل' : 'تفعيل') + '</button>') +
      '</div>';
    }).join('') : '<p class="empty-state">لا يوجد مستخدمون.</p>') +
    '<button class="addbtn" data-act="newUser">+ إضافة مستخدم جديد</button></div>';
}

/* من دخل ومتى — يقرأ من سجل الخادم مباشرة */
var ACCESS_KINDS = {
  login:          { label: 'دخول',           tone: '',      icon: '→' },
  logout:         { label: 'خروج',           tone: 'grey',  icon: '←' },
  'login-failed': { label: 'محاولة فاشلة',   tone: 'red',   icon: '✕' },
  'login-locked': { label: 'قفل بعد المحاولات', tone: 'red', icon: '⊘' }
};

function tabAccess() {
  var rowsAll = S.db.authLog || [];
  var names = uniq(rowsAll.map(function (r) { return r.userName; }).filter(function (x) { return x && x !== '-'; }));
  var who = S.accWho || '';
  var onlyBad = S.accBad === 1;
  var list = rowsAll.filter(function (r) {
    if (who && r.userName !== who) return false;
    if (onlyBad && r.action.indexOf('failed') < 0 && r.action.indexOf('locked') < 0) return false;
    return true;
  });

  var lastBy = {};
  rowsAll.forEach(function (r) {
    if (r.action !== 'login' || !r.userName || r.userName === '-') return;
    if (!lastBy[r.userName]) lastBy[r.userName] = r.date;
  });
  var bad = rowsAll.filter(function (r) { return r.action.indexOf('failed') > -1 || r.action.indexOf('locked') > -1; });

  return '<div class="chart-card"><h2>من دخل ومتى</h2>' +
    '<p class="password-hint" style="margin:-4px 0 14px!important">آخر ' + num(rowsAll.length) + ' حركة دخول وخروج · تُحدَّث مع «تحديث البيانات»</p>' +

    (Object.keys(lastBy).length ? '<div style="margin-bottom:14px">' + Object.keys(lastBy).map(function (n) {
      return '<div class="sum-line"><span>' + esc(n) + '</span><span>آخر دخول ' + esc(dtShort(lastBy[n])) + ' — ' + esc(tm(lastBy[n])) + ' <small>(' + esc(ago(lastBy[n])) + ')</small></span></div>';
    }).join('') + '</div>' : '') +

    (bad.length ? '<div class="sum-line total"><span>محاولات فاشلة في السجل</span><span class="tag red">' + num(bad.length) + '</span></div>' : '') +

    /* أزرار حبّية لا شريط تبويبات — حتى لا تلتبس بتبويبات اللوحة فوقها */
    '<div class="unit-pick" style="margin:14px 0;flex-wrap:wrap">' +
      '<button type="button" data-act="accWho" data-w="" class="' + (who ? '' : 'active') + '">الكل</button>' +
      names.map(function (n) {
        return '<button type="button" data-act="accWho" data-w="' + esc(n) + '" class="' + (who === n ? 'active' : '') + '">' + esc(n) + '</button>';
      }).join('') +
      '<button type="button" data-act="accBad" class="' + (onlyBad ? 'active' : '') + '">✕ الفاشلة فقط</button>' +
    '</div>' +

    (list.length ? '<div class="tablewrap"><table class="data"><thead><tr>' +
      '<th>التاريخ</th><th>الوقت</th><th>المستخدم</th><th>الحدث</th><th>التفاصيل</th><th>منذ</th>' +
      '</tr></thead><tbody>' + list.map(function (r) {
        var k = ACCESS_KINDS[r.action] || { label: r.action, tone: '', icon: '·' };
        return '<tr><td>' + esc(dtShort(r.date)) + '</td><td>' + esc(tm(r.date)) + '</td>' +
          '<td><b>' + esc(r.userName === '-' ? 'غير معروف' : r.userName) + '</b></td>' +
          '<td><span class="tag ' + k.tone + '">' + k.icon + ' ' + esc(k.label) + '</span></td>' +
          '<td>' + esc(r.detail || '—') + '</td><td>' + esc(ago(r.date)) + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<p class="empty-state">لا توجد حركات دخول مطابقة.<br><small>الحركات تُسجَّل من لحظة تحديث كود الخادم — لن تظهر عمليات دخول أقدم منه.</small></p>') +
  '</div>';
}

function tabTools() {
  return '<div class="chart-card"><h2>أنواع التعبئة</h2>' +
    '<p class="password-hint" style="margin:0 0 14px!important">الأنواع المستخدمة في القطاف والبيع والتعبئة. حذف نوع لا يمس السجلات القديمة، لكنه يمنع استخدامه في عمليات جديدة.</p>' +
    S.units.map(function (u, i) {
      var used = totalStock(u);
      return '<div class="unitrow"><b>' + esc(u) + '</b>' +
        '<span class="tag' + (used ? '' : ' grey') + '">' + num(used) + ' في المخزون</span>' +
        (S.units.length > 1
          ? '<button class="mini danger" data-act="delUnit" data-i="' + i + '">حذف</button>'
          : '<span class="tag grey">الأخير</span>') + '</div>';
    }).join('') +
    '<button class="addbtn" data-act="addUnit">+ إضافة نوع تعبئة</button>' +
  '</div>' +
  '<div class="chart-card" style="margin-top:15px"><h2>رموز بوابات المزارع</h2>' +
    '<p class="password-hint" style="margin:0 0 16px!important">اطبع رمز كل مزرعة وثبّته عند البوابة. مسحه أثناء تسجيل القطاف يثبت الحضور الفعلي في الموقع — أقوى من الموقع الجغرافي لأنه لا يمكن تزويره من مكان آخر.</p>' +
    FARM_NAMES.map(function (f) {
      return '<div class="userrow"><div><b>مزرعة ' + esc(f) + '</b>' +
        '<small>' + FARMS[f].lat + ', ' + FARMS[f].lng + ' · رمز ' + FARMS[f].code + '</small></div>' +
        '<button class="mini" data-act="gateLabel" data-f="' + esc(f) + '">عرض وطباعة الرمز</button></div>';
    }).join('') +
    '</div>' +
    '<div class="chart-card" style="margin-top:15px"><h2>الذكاء الاصطناعي</h2>' +
      '<p class="password-hint" style="margin:0 0 14px!important">قراءة الفواتير وتقدير عدد السلال وتقييم الجودة تعمل عبر Gemini. تُضبط بمفتاح مجاني في إعدادات الخادم.</p>' +
      '<div class="sum-line"><span>الحالة</span><span id="aiState">' +
        (S.aiState || '<button class="mini" data-act="aiPing">فحص الاتصال</button>') + '</span></div>' +
    '</div>' +
    '<div class="chart-card" style="margin-top:15px"><h2>التطبيق</h2>' +
      '<div class="sum-line"><span>إصدار التطبيق على هذا الجهاز</span><span><b>' + esc(APP_V) + '</b></span></div>' +
      '<div class="sum-line"><span>إصدار كود الخادم</span><span>' +
        (S.srv ? '<b>' + esc(String(S.srv)) + '</b>'
               : '<span class="tag red">قديم — لم يُحدَّث بعد</span>') + '</span></div>' +
      '<div class="sum-line"><span>وضع العمل بدون إنترنت</span><span>' +
        ('serviceWorker' in navigator ? 'مفعّل' : 'غير مدعوم في هذا المتصفح') + '</span></div>' +
      '<div class="sum-line"><span>عمليات لم تُرفع</span><span>' + num(S.queue.length) + '</span></div>' +
      (S.cachedAt ? '<div class="sum-line"><span>آخر نسخة محفوظة محليًا</span><span>' + esc(dt(S.cachedAt)) + ' — ' + esc(tm(S.cachedAt)) + '</span></div>' : '') +
    '</div>';
}

function isVoid(r) { return r['void'] === true || r['void'] === 'TRUE'; }
function byDateDesc(a, b) { return String(b.date).localeCompare(String(a.date)); }
function rowAction(r, table) {
  if (S.user.role !== 'admin') return '';
  if (isVoid(r)) return '<span class="tag grey">ملغاة</span>';
  return '<button class="mini danger" data-act="void" data-t="' + table + '" data-id="' + esc(r.id) + '">إلغاء</button>';
}

/* ═══════════ النوافذ ═══════════ */
function closeModal() { camStop(); stopScan(); modalBox.innerHTML = ''; }
function modal(html) {
  modalBox.innerHTML = '<div class="modal" data-act="backdrop"><div class="modal-card">' + html + '</div></div>';
}
function confirmBox(title, sub, label, danger, onYes) {
  modal('<h3>' + esc(title) + '</h3><p>' + esc(sub) + '</p>' +
    '<div class="modal-actions"><button data-act="closeModal">إلغاء</button>' +
    '<button class="go' + (danger ? ' danger' : '') + '" id="mYes">' + esc(label) + '</button></div>');
  document.getElementById('mYes').onclick = onYes;
}

/* ═══════════ الأحداث ═══════════ */
function bind() {
  ['sBk', 'sGross', 'sComm', 'sTrans'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.oninput = updateCalc;
  });
  var sf = document.getElementById('sFarm');
  if (sf) sf.onchange = function () { S.farm = sf.value; render(); };
  var kf = document.getElementById('kFarm');
  if (kf) kf.onchange = function () { S.farm = kf.value; render(); };
  [].forEach.call(document.querySelectorAll('[data-act="lf"]'), function (el) {
    el.onchange = function () { S[el.getAttribute('data-k')] = el.value; render(); };
  });
}

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]');
  if (!el) return;
  var a = el.getAttribute('data-act');

  if (a === 'backdrop') { if (e.target === el) closeModal(); return; }
  if (a === 'closeModal' || a === 'camClose') return closeModal();
  if (a === 'forgotOpen') { S.authMode = 'forgot'; S.fgEmail = ''; render(); return; }
  if (a === 'forgotBack') { S.authMode = 'login'; render(); return; }
  if (a === 'forgotAgain') { S.authMode = 'forgot'; render(); return; }
  if (a === 'menuOpen') { S.menu = true; render(); return; }
  if (a === 'menuClose') { S.menu = false; render(); return; }
  if (a === 'camOpen') return openCamera(el.getAttribute('data-title') || 'التقاط صورة');
  if (a === 'lf') return;
  if (a === 'aiPing') {
    el.disabled = true; el.textContent = 'جارٍ الفحص…';
    call('ai', { mode: 'ping' })
      .then(function (d) { S.aiState = '<span class="tag">متصل · ' + esc(d.model || '') + '</span>'; render(); })
      .catch(function (e) { S.aiState = '<span class="tag red">' + esc(e.message) + '</span>'; render(); });
    return;
  }
  if (a === 'aiInvoice') return readInvoice(el);
  if (a === 'aiHarvest') return reviewHarvest(el);
  if (a === 'scanGate') return openScanner(handleCode);
  if (a === 'scanAny') return openScanner(handleCode);
  if (a === 'scanClose') { stopScan(); closeModal(); return; }
  if (a === 'scanManualGo') {
    var raw = (val('scanManual') || '').trim();
    if (!raw) return toast('اكتب الرقم أولًا', 'bad');
    var code = /^MZR:/.test(raw) ? raw
      : /^(QAR|RAD)$/i.test(raw) ? 'MZR:GATE:' + raw.toUpperCase()
      : 'MZR:BATCH:' + raw.toUpperCase();
    var cb = SCAN.cb;
    stopScan(); closeModal();
    if (cb) cb(code);
    return;
  }
  if (a === 'label') { var bt = el.getAttribute('data-b'); labelModal('BATCH', bt, 'ملصق التشغيلة', 'الصقه على الصندوق — يُمسح لعرض تفاصيل الجولة'); return; }
  if (a === 'gateLabel') {
    var gf = el.getAttribute('data-f');
    labelModal('GATE', FARMS[gf].code, 'رمز بوابة مزرعة ' + gf, 'ثبّته عند بوابة المزرعة — مسحه يؤكد الحضور', 'مزرعة ' + gf);
    return;
  }
  if (a === 'printQR') return printLabel();
  if (a === 'retryQ') { retryFailed(); return; }
  if (a === 'dropQ') { dropQueued(el.getAttribute('data-id')); return; }
  if (a === 'lfClear') { S.logType = 'all'; S.logFarm = 'all'; S.logDay = ''; render(); return; }
  if (a === 'go') {
    S.view = el.getAttribute('data-v'); S.menu = false; resetForm();
    if (S.view === 'harvest') locate(); else if (S.view === 'sale' || S.view === 'expense') grabGeo();
    render(); return;
  }
  if (a === 'tab') { S.tab = el.getAttribute('data-t'); render(); return; }
  if (a === 'accWho') { S.accWho = el.getAttribute('data-w') || ''; render(); return; }
  if (a === 'accBad') { S.accBad = S.accBad === 1 ? 0 : 1; render(); return; }
  if (a === 'sync') { el.disabled = true; refresh().then(function () { render(); toast('تم تحديث البيانات', 'good'); }).catch(function (x) { el.disabled = false; toast(x.message, 'bad'); }); return; }
  if (a === 'logout') return doLogout();
  if (a === 'farm') { S.farm = el.getAttribute('data-f'); S.located = false; render(); return; }
  if (a === 'locate') return locate(true);
  if (a === 'inc') return setBaskets((S.baskets || 0) + 1);
  if (a === 'dec') return setBaskets(Math.max(0, (S.baskets || 0) - 1));
  if (a === 'add5') return setBaskets((S.baskets || 0) + 5);
  if (a === 'add10') return setBaskets((S.baskets || 0) + 10);
  if (a === 'clr') return setBaskets(0);
  if (a === 'pay') { S.ptype = el.getAttribute('data-p'); render(); return; }
  if (a === 'allStock') { var i = document.getElementById('sBk'); if (i) { i.value = stockOf(S.farm, S.unit || S.units[0]); updateCalc(); } return; }
  if (a === 'unit') { S.unit = el.getAttribute('data-u'); render(); return; }
  if (a === 'punit') {
    var pk = el.getAttribute('data-k'), pv = el.getAttribute('data-u');
    S[pk] = pv;
    /* لو تطابق النوعان نُزحزح الطرف الآخر تلقائيًا بدل ترك الزر معطّلًا */
    var other = pk === 'pkFrom' ? 'pkTo' : 'pkFrom';
    var cur = S[other] || (other === 'pkFrom' ? S.units[0] : (S.units[1] || S.units[0]));
    if (cur === pv) {
      var alt = S.units.filter(function (x) { return x !== pv; })[0];
      S[other] = alt || cur;
    }
    render(); return;
  }
  if (a === 'saveHarvest') return saveHarvest(el);
  if (a === 'saveSale') return saveSale(el);
  if (a === 'saveExpense') return saveExpense(el);
  if (a === 'savePack') return savePack(el);
  if (a === 'payFor') return payModal(el.getAttribute('data-id'));
  if (a === 'img') return showImage(el.getAttribute('data-id'));
  if (a === 'void') return voidModal(el.getAttribute('data-t'), el.getAttribute('data-id'));
  if (a === 'addUnit') return unitModal();
  if (a === 'delUnit') {
    var ix = Number(el.getAttribute('data-i'));
    var nm = S.units[ix];
    confirmBox('حذف نوع التعبئة', 'سيُمنع استخدام «' + nm + '» في العمليات الجديدة. السجلات القديمة تبقى كما هي.',
      'حذف', true, function () {
        var b = this; b.disabled = true;
        var next = S.units.filter(function (x, i) { return i !== ix; });
        call('setunits', { units: next })
          .then(function (d) { S.units = d.units; closeModal(); render(); toast('تم الحذف', 'good'); })
          .catch(function (e) { b.disabled = false; toast(e.message, 'bad'); });
      });
    return;
  }
  if (a === 'newUser') return userModal();
  if (a === 'chpass') return passModal(el.getAttribute('data-id'), el.getAttribute('data-name'));
  if (a === 'chmail') return mailModal(el.getAttribute('data-id'), el.getAttribute('data-name'), el.getAttribute('data-email'));
  if (a === 'toggleUser') return toggleUser(el.getAttribute('data-id'), el.getAttribute('data-on') === '1');
});

function setBaskets(n) {
  S.baskets = n;
  var b = document.getElementById('bk');
  if (b) b.textContent = num(n); else render();
}
function resetForm() {
  camStop();
  S.photo = null; S.photoSource = ''; S.photoAt = ''; S.photoGeo = null;
  S.aiBaskets = ''; S.aiQuality = ''; S.aiNotes = ''; S.aiBusy = false; S.gate = '';
  S.baskets = 0; S.ptype = 'cash'; S.pkFrom = ''; S.pkTo = '';
}

/* البيانات التوثيقية المرفقة مع كل عملية */
function meta() {
  var g = S.photoGeo || S.geo || null;
  return {
    capturedAt: S.photoAt || new Date().toISOString(),
    lat: g ? g.lat : '', lng: g ? g.lng : '',
    device: S.photoSource || 'manual'
  };
}

function locate(loud) {
  if (!navigator.geolocation) { if (loud) toast('الموقع غير متاح، اختر المزرعة يدويًا', 'bad'); return; }
  if (loud) toast('جارٍ تحديد المزرعة الأقرب…');
  navigator.geolocation.getCurrentPosition(function (pos) {
    var best = null, bestD = Infinity;
    FARM_NAMES.forEach(function (f) {
      var d = distKm(pos.coords.latitude, pos.coords.longitude, FARMS[f].lat, FARMS[f].lng);
      if (d < bestD) { bestD = d; best = f; }
    });
    S.geo = { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) };
    S.farm = best; S.located = true;
    if (S.view === 'harvest') render();
    toast('تم تحديد مزرعة ' + best + ' (تبعد ' + num(Math.round(bestD)) + ' كم)', 'good');
  }, function () {
    if (loud) toast('لم تسمح بالموقع، اختر المزرعة يدويًا', 'bad');
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}
function distKm(a, b, c, d) {
  var R = 6371, p = Math.PI / 180;
  var x = (c - a) * p, y = (d - b) * p;
  var q = Math.sin(x / 2) * Math.sin(x / 2) + Math.cos(a * p) * Math.cos(c * p) * Math.sin(y / 2) * Math.sin(y / 2);
  return 2 * R * Math.asin(Math.sqrt(q));
}

/* ── الحفظ ── */
function mix(rec) {
  var m = meta();
  for (var k in m) rec[k] = m[k];
  return rec;
}

function guard(btn, label, promise) {
  if (S.busy) return;
  S.busy = true; btn.disabled = true;
  var old = btn.textContent; btn.textContent = 'جارٍ الحفظ…';
  promise.then(function (msg) {
    /* فشل التحديث بعد الحفظ لا يعني فشل الحفظ — خاصة بلا إنترنت */
    return refresh().catch(function () {}).then(function () {
      S.busy = false; resetForm(); S.view = 'home'; render(); toast(msg, 'good');
    });
  }).catch(function (x) {
    S.busy = false; btn.disabled = false; btn.textContent = old || label;
    toast(x.message, 'bad');
  });
}

function saveHarvest(btn) {
  if (!S.photo) return toast('التقط صورة المحصول أولًا', 'bad');
  if (!(S.baskets > 0)) return toast('أدخل عدد السلال', 'bad');
  guard(btn, 'حفظ جولة القطاف', submitOp('Harvests',
    mix({ farm: S.farm, code: FARMS[S.farm].code, baskets: S.baskets, unit: (S.unit || S.units[0]),
          aiBaskets: S.aiBaskets, aiQuality: S.aiQuality, aiNotes: S.aiNotes, gate: S.gate }),
    S.photo
  ).then(function (d) {
    return d.queued ? 'حُفظت الجولة محليًا وستُرفع عند عودة الإنترنت' : 'تم حفظ الجولة · ' + d.batch;
  }));
}

function saveSale(btn) {
  var bk = Math.round(numOf(val('sBk')));
  var gross = Math.round(numOf(val('sGross')) * 100);
  var comm = Math.round(numOf(val('sComm')) * 100);
  var tr = Math.round(numOf(val('sTrans')) * 100);
  if (!(bk > 0)) return toast('أدخل عدد السلال', 'bad');
  var sUnit = S.unit || S.units[0];
  var avail = stockOf(S.farm, sUnit);
  if (bk > avail) return toast('المتاح ' + num(avail) + ' ' + sUnit + ' فقط', 'bad');
  if (!(gross > 0)) return toast('أدخل إجمالي البيع', 'bad');
  if (gross - comm - tr < 0) return toast('العمولة والنقل أكبر من إجمالي البيع', 'bad');
  var rec = mix({ farm: S.farm, baskets: bk, unit: sUnit, gross: gross, commission: comm, transport: tr, ptype: S.ptype || 'cash' });
  if (rec.ptype === 'credit') {
    rec.customer = (val('sCust') || '').trim();
    rec.due = val('sDue');
    if (!rec.customer) return toast('أدخل اسم العميل', 'bad');
    if (!rec.due) return toast('أدخل تاريخ الاستحقاق', 'bad');
  }
  guard(btn, 'حفظ عملية البيع', submitOp('Sales', rec, '')
    .then(function (d) {
      return d.queued ? 'حُفظ البيع محليًا وسيُرفع عند عودة الإنترنت'
                      : 'تم تسجيل البيع · صافي ' + riyal(d.net);
    }));
}

function saveExpense(btn) {
  if (!S.photo) return toast('صوّر الفاتورة أولًا', 'bad');
  var amt = Math.round(numOf(val('eAmt')) * 100);
  if (!(amt > 0)) return toast('أدخل مبلغ المصروف', 'bad');
  guard(btn, 'حفظ المصروف', submitOp('Expenses',
    mix({
      amount: amt, category: val('eCat'), farm: val('eFarm'),
      payer: val('ePayer'), notes: (val('eNotes') || '').trim()
    }),
    S.photo
  ).then(function (d) {
    return d.queued ? 'حُفظ المصروف محليًا وسيُرفع عند عودة الإنترنت' : 'تم حفظ المصروف';
  }));
}

/* ── النوافذ التفاعلية ── */
function payModal(saleId) {
  var x = openCredits().filter(function (c) { return c.sale.id === saleId; })[0];
  if (!x) return;
  modal('<h3>تسجيل سداد</h3><p>' + esc(x.sale.customer || 'عميل') + ' · المتبقي ' + riyal(x.left) + '</p>' +
    '<label>المبلغ المسدَّد (ر.س)<input id="pAmt" type="number" inputmode="decimal" min="0" step="0.01" value="' + (x.left / 100) + '"></label>' +
    '<label>طريقة السداد<select id="pMethod"><option value="cash">نقدًا</option><option value="transfer">تحويل بنكي</option><option value="check">شيك</option></select></label>' +
    '<div class="modal-actions"><button data-act="closeModal">إلغاء</button><button class="go" id="pGo">تأكيد السداد</button></div>');
  document.getElementById('pGo').onclick = function () {
    var amt = Math.round(numOf(val('pAmt')) * 100);
    if (!(amt > 0)) return toast('أدخل مبلغًا صحيحًا', 'bad');
    if (amt > x.left) return toast('المبلغ أكبر من المتبقي', 'bad');
    var b = this; b.disabled = true; b.textContent = 'جارٍ الحفظ…';
    call('add', { t2: 'Payments', rec: { saleId: saleId, amount: amt, method: val('pMethod') } })
      .then(function () { return refresh(); })
      .then(function () { closeModal(); render(); toast('تم تسجيل السداد', 'good'); })
      .catch(function (e) { b.disabled = false; b.textContent = 'تأكيد السداد'; toast(e.message, 'bad'); });
  };
}

function voidModal(table, id) {
  modal('<h3>إلغاء العملية</h3><p>سيبقى السجل ظاهرًا كملغى مع سبب الإلغاء، ولن يُحتسب في الأرصدة.</p>' +
    '<label>سبب الإلغاء<input id="vR" placeholder="مثال: خطأ في الإدخال"></label>' +
    '<div class="modal-actions"><button data-act="closeModal">تراجع</button><button class="go danger" id="vGo">تأكيد الإلغاء</button></div>');
  document.getElementById('vGo').onclick = function () {
    var reason = (val('vR') || '').trim();
    if (!reason) return toast('اكتب سبب الإلغاء', 'bad');
    var b = this; b.disabled = true; b.textContent = 'جارٍ…';
    call('void', { t2: table, id: id, reason: reason })
      .then(function () { return refresh(); })
      .then(function () { closeModal(); render(); toast('تم إلغاء العملية', 'good'); })
      .catch(function (e) { b.disabled = false; b.textContent = 'تأكيد الإلغاء'; toast(e.message, 'bad'); });
  };
}

function showImage(id) {
  modal('<h3>الصورة المرفقة</h3><p>جارٍ التحميل…</p><div class="spin" id="iSpin"></div>' +
    '<img class="photo-view hidden" id="iImg" alt="الصورة المرفقة">' +
    '<div class="modal-actions"><button data-act="closeModal">إغلاق</button><a class="go" id="iDl" style="display:grid;place-items:center;text-decoration:none;color:#fff;border-radius:11px" download="photo.jpg">تنزيل</a></div>');
  call('img', { id: id }).then(function (d) {
    var src = 'data:image/jpeg;base64,' + d.b64;
    var im = document.getElementById('iImg');
    if (!im) return;
    im.src = src; im.className = 'photo-view';
    document.getElementById('iSpin').className = 'spin hidden';
    document.getElementById('iDl').href = src;
    modalBox.querySelector('.modal-card > p').textContent = 'اضغط تنزيل لحفظ الصورة';
  }).catch(function (e) {
    var s = document.getElementById('iSpin');
    if (s) s.className = 'spin hidden';
    toast(e.message, 'bad');
  });
}

function unitModal() {
  modal('<h3>نوع تعبئة جديد</h3><p>مثل: صندوق · بوكس · سلة · كرتون</p>' +
    '<label>الاسم<input id="unName" placeholder="اسم النوع"></label>' +
    '<div class="modal-actions"><button data-act="closeModal">إلغاء</button><button class="go" id="unGo">إضافة</button></div>');
  document.getElementById('unGo').onclick = function () {
    var v = (val('unName') || '').trim();
    if (!v) return toast('اكتب اسم النوع', 'bad');
    if (S.units.indexOf(v) >= 0) return toast('هذا النوع موجود', 'bad');
    var b = this; b.disabled = true; b.textContent = 'جارٍ…';
    call('setunits', { units: S.units.concat([v]) })
      .then(function (d) { S.units = d.units; closeModal(); render(); toast('تمت الإضافة', 'good'); })
      .catch(function (e) { b.disabled = false; b.textContent = 'إضافة'; toast(e.message, 'bad'); });
  };
}

function userModal() {
  modal('<h3>مستخدم جديد</h3><p>سيتمكن من الدخول برقم جواله وكلمة المرور</p>' +
    '<label>الاسم<input id="uName" required></label>' +
    '<label>رقم الجوال<input id="uPhone" inputmode="tel" placeholder="05xxxxxxxx"></label>' +
    '<label>البريد الإلكتروني<input id="uEmail" type="email" inputmode="email" dir="ltr" placeholder="name@example.com"></label>' +
    '<label>الصلاحية<select id="uRole"><option value="operator">مشغّل — يسجّل العمليات</option><option value="viewer">مطّلع — قراءة فقط</option><option value="admin">مدير — صلاحية كاملة</option></select></label>' +
    '<label>كلمة المرور<input id="uPass" type="password" minlength="8" placeholder="8 خانات على الأقل"></label>' +
    '<div class="modal-actions"><button data-act="closeModal">إلغاء</button><button class="go" id="uGo">إضافة</button></div>');
  document.getElementById('uGo').onclick = function () {
    var name = (val('uName') || '').trim(), phone;
    if (!name) return toast('أدخل الاسم', 'bad');
    try { phone = phoneNorm(val('uPhone')); } catch (x) { return toast(x.message, 'bad'); }
    if ((val('uPass') || '').length < 8) return toast('كلمة المرور 8 خانات على الأقل', 'bad');
    var b = this; b.disabled = true; b.textContent = 'جارٍ…';
    call('adduser', { name: name, phone: phone, role: val('uRole'), pass: val('uPass'), email: (val('uEmail') || '').trim() })
      .then(function () { return refresh(); })
      .then(function () { closeModal(); render(); toast('تمت إضافة المستخدم', 'good'); })
      .catch(function (e) { b.disabled = false; b.textContent = 'إضافة'; toast(e.message, 'bad'); });
  };
}

function passModal(id, name) {
  modal('<h3>تغيير كلمة المرور</h3><p>' + esc(name) + '</p>' +
    '<label>كلمة المرور الجديدة<input id="npPass" type="password" minlength="8" placeholder="8 خانات على الأقل"></label>' +
    '<div class="modal-actions"><button data-act="closeModal">إلغاء</button><button class="go" id="npGo">حفظ</button></div>');
  document.getElementById('npGo').onclick = function () {
    if ((val('npPass') || '').length < 8) return toast('كلمة المرور 8 خانات على الأقل', 'bad');
    var b = this; b.disabled = true; b.textContent = 'جارٍ…';
    call('setuser', { id: id, pass: val('npPass') })
      .then(function () { closeModal(); toast('تم تغيير كلمة المرور', 'good'); })
      .catch(function (e) { b.disabled = false; b.textContent = 'حفظ'; toast(e.message, 'bad'); });
  };
}

function mailModal(id, name, email) {
  modal('<h3>البريد الإلكتروني</h3><p>' + esc(name) + ' — يُستخدم لاستعادة كلمة المرور</p>' +
    '<label>البريد<input id="emVal" type="email" dir="ltr" placeholder="name@example.com" value="' + esc(email || '') + '"></label>' +
    '<div class="modal-actions"><button data-act="closeModal">إلغاء</button><button class="go" id="emGo">حفظ</button></div>');
  document.getElementById('emGo').onclick = function () {
    var b = this; b.disabled = true; b.textContent = 'جارٍ…';
    call('setuser', { id: id, email: (val('emVal') || '').trim() })
      .then(function () { return refresh(); })
      .then(function () { closeModal(); render(); toast('تم حفظ البريد', 'good'); })
      .catch(function (e) { b.disabled = false; b.textContent = 'حفظ'; toast(e.message, 'bad'); });
  };
}

function toggleUser(id, on) {
  confirmBox(on ? 'تفعيل المستخدم' : 'تعطيل المستخدم',
    on ? 'سيتمكن من الدخول مرة أخرى.' : 'لن يتمكن من الدخول للنظام.',
    on ? 'تفعيل' : 'تعطيل', !on, function () {
      var b = this; b.disabled = true;
      call('setuser', { id: id, active: on })
        .then(function () { return refresh(); })
        .then(function () { closeModal(); render(); toast('تم التحديث', 'good'); })
        .catch(function (e) { b.disabled = false; toast(e.message, 'bad'); });
    });
}

function doLogout() {
  confirmBox('تسجيل الخروج', 'ستحتاج لإدخال بياناتك مرة أخرى.', 'خروج', true, function () {
    call('logout', {}).catch(function () {});
    localStorage.removeItem('mzr_token');
    S.token = ''; S.user = null; S.authMode = 'login';
    closeModal(); render();
  });
}

/* ═══════════ الإقلاع ═══════════ */
function refresh() {
  return call('all', {}).then(function (d) {
    S.user = d.user;
    S.db = { harvests: d.harvests || [], sales: d.sales || [], expenses: d.expenses || [],
             payments: d.payments || [], packing: d.packing || [], users: d.users || [],
             authLog: d.authLog || [] };
    if (d.units && d.units.length) S.units = d.units;
    S.srv = d.srv || 0;
    idbPut('cache', { key: 'db', user: d.user, db: S.db, at: new Date().toISOString() });
    return d;
  });
}

/* عند غياب الشبكة نعرض آخر نسخة محفوظة بدل شاشة فارغة */
function loadCache() {
  return idbDo('cache', 'readonly', function (st) { return st.get('db'); }).then(function (c) {
    if (!c || !c.db) return false;
    S.user = c.user; S.db = c.db; S.cachedAt = c.at;
    return true;
  });
}

function watchNet() {
  function set(on) {
    S.online = on;
    render();
    if (on) syncQueue(true);
  }
  window.addEventListener('online', function () { set(true); });
  window.addEventListener('offline', function () { set(false); });
  setInterval(function () {
    if (navigator.onLine !== S.online) set(navigator.onLine);
    else if (navigator.onLine) syncQueue(false);
  }, 45000);
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(function () {});
}

function boot() {
  registerSW();
  watchNet();
  if (!apiReady()) { S.user = null; render(); return; }

  /* أي فشل في التخزين المحلي يجب ألا يمنع فتح التطبيق */
  loadQueue().catch(function () { S.queue = []; }).then(function () {
    if (S.token) {
      return refresh()
        .then(function () { S.view = 'home'; render(); syncQueue(false); })
        .catch(function (e) {
          if (e.offline) {
            return loadCache().then(function (ok) {
              if (ok) { S.view = 'home'; render(); toast('بدون إنترنت — تُعرض آخر نسخة محفوظة'); }
              else { S.authMode = 'login'; S.user = null; render(); toast(e.message, 'bad'); }
            });
          }
          S.token = ''; localStorage.removeItem('mzr_token');
          S.user = null;
          return askStatus();
        });
    }
    S.authMode = 'loading'; render();
    return askStatus();
  });
}

function askStatus() {
  return call('status', {})
    .then(function (d) { S.authMode = d.needsSetup ? 'setup' : 'login'; render(); })
    .catch(function (x) { S.authMode = 'login'; render(); if (!x.offline) toast(x.message, 'bad'); });
}

/* منفذ اختبار محلي فقط — لا يعمل على النطاق المنشور */
if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
  window.__t = { S: S, call: call, submitOp: submitOp, mix: mix, stockOf: stockOf,
                 stockSummary: stockSummary, activeUnits: activeUnits, render: render, FARMS: FARMS,
                 refresh: refresh, stockLine: stockLine, partnerBook: partnerBook };
}

boot();
})();
