#!/usr/bin/env python3
"""يرفع رقم الإصدار في index.html و sw.js معًا.

لماذا: عامل الخدمة يخزّن `app.js?v=N`. لو تغيّر الرقم في مكان دون الآخر
بقيت الأجهزة على نسخة قديمة إلى الأبد. هذا السكربت يمنع ذلك.

الاستخدام:  python3 bump.py
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, "index.html")
SW = os.path.join(HERE, "sw.js")


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)


def main():
    html = read(INDEX)
    sw = read(SW)

    found = re.findall(r"app\.js\?v=(\d+)", html)
    if not found:
        sys.exit("لم أجد رقم الإصدار في index.html")
    cur = int(found[0])
    new = int(sys.argv[1]) if len(sys.argv) > 1 else cur + 1

    html = re.sub(r"(app\.js\?v=)\d+", r"\g<1>%d" % new, html)
    html = re.sub(r"(styles\.css\?v=)\d+", r"\g<1>%d" % new, html)

    sw = re.sub(r"(var CACHE = 'mzr-v)\d+(')", r"\g<1>%d\g<2>" % new, sw)
    sw = re.sub(r"('\./app\.js\?v=)\d+(')", r"\g<1>%d\g<2>" % new, sw)
    sw = re.sub(r"('\./styles\.css\?v=)\d+(')", r"\g<1>%d\g<2>" % new, sw)

    write(INDEX, html)
    write(SW, sw)

    # تحقّق أن كل المواضع تحمل الرقم نفسه
    nums = set(re.findall(r"app\.js\?v=(\d+)", html + sw))
    nums |= set(re.findall(r"styles\.css\?v=(\d+)", html + sw))
    nums |= set(re.findall(r"mzr-v(\d+)", sw))
    if nums != {str(new)}:
        sys.exit("تحذير: الأرقام غير متطابقة -> %s" % sorted(nums))

    print("الإصدار %d -> %d  (index.html و sw.js متطابقان)" % (cur, new))


if __name__ == "__main__":
    main()
