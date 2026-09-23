"""Yasal sayfaları (dincerenes/surucum-yasal, GitHub Pages) docs/ metinlerinden üretir.

Kullanım: python3 tools/yasal-site.py <site-klasörü>
Sonra o klasörde commit + push. Markdown → HTML için `npx -y marked`.

Her metnin başındaki `>` notları (hukukçuya sorulacaklar, adresler) iç
nottur, sayfaya girmez: sayfa ilk `**Sürüm` / `**Yürürlük` / `**Son
güncelleme` satırından başlar.
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1])
CONTACT = 'surucumappdestek@gmail.com'

NAV = [
    ('./', 'Gizlilik Politikası'),
    ('kvkk.html', 'KVKK'),
    ('kullanim-kosullari.html', 'Kullanım Koşulları'),
    ('hesap-silme.html', 'Hesabımı sil'),
]

CSS = '''
:root{--bg:#F7F8FA;--card:#FFFFFF;--text:#0F172A;--soft:#475569;--line:#E2E8F0;--accent:#2563EB;--head:#2563EB}
@media (prefers-color-scheme:dark){:root{--bg:#0B1120;--card:#111A2E;--text:#E5E7EB;--soft:#94A3B8;--line:#1E293B;--accent:#60A5FA;--head:#1E3A8A}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
header{background:var(--head);color:#fff;padding:28px 16px}
header .in,main{max-width:760px;margin:0 auto}
header h1{margin:0;font-size:26px}
header p{margin:4px 0 0;opacity:.9}
nav{margin-top:12px;display:flex;gap:8px 16px;flex-wrap:wrap}
nav a{color:#fff;font-weight:600}
nav a[aria-current]{text-decoration:none;border-bottom:2px solid #fff}
main{padding:24px 16px 64px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:8px 20px 20px}
h2{margin-top:32px;font-size:22px}
h3{margin-top:26px;font-size:18px}
a{color:var(--accent)}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:15px;display:block;overflow-x:auto}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
th{background:var(--bg)}
hr{border:0;border-top:1px solid var(--line);margin:24px 0}
footer{color:var(--soft);font-size:14px;text-align:center;margin-top:32px}
li{margin:4px 0}
'''


def body_of(md: str) -> str:
    """İç notları at, üst bilgi satırlarını ayrı satırlarda tut."""
    m = re.search(r'^\*\*(Sürüm|Yürürlük|Son güncelleme)', md, re.M)
    md = md[m.start():] if m else md
    return re.sub(r'^(\*\*(Sürüm|Yürürlük tarihi|Son güncelleme):\*\*.*)$', r'\1  ', md, flags=re.M)


def render(md: str) -> str:
    return subprocess.run(
        ['npx', '-y', 'marked'], input=md, capture_output=True, text=True, check=True,
    ).stdout


def page(href: str, title: str, subtitle: str, html: str) -> str:
    nav = ''.join(
        f'<a href="{h}"{" aria-current=\"page\"" if h == href else ""}>{label}</a>'
        for h, label in NAV
    )
    return f'''<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — Sürücüm</title>
<style>{CSS}</style></head>
<body><header><div class="in"><h1>Sürücüm</h1><p>{subtitle}</p>
<nav>{nav}</nav></div></header>
<main><div class="card">{html}</div>
<footer>Sürücüm · İletişim: <a href="mailto:{CONTACT}">{CONTACT}</a></footer></main>
</body></html>
'''


policy = (ROOT / 'docs/gizlilik-politikasi.md').read_text()
policy_body = body_of(policy)
kvkk_start = policy_body.index('## B. KVKK Aydınlatma Metni')
dates = policy_body[:policy_body.index('---')]

pages = [
    ('index.html', './', 'Gizlilik Politikası', 'Gizlilik Politikası ve KVKK Aydınlatma Metni', policy_body),
    ('kvkk.html', 'kvkk.html', 'KVKK Aydınlatma Metni', 'KVKK Aydınlatma Metni',
     dates + '\n---\n\n' + policy_body[kvkk_start:]),
    ('kullanim-kosullari.html', 'kullanim-kosullari.html', 'Kullanım Koşulları', 'Kullanım Koşulları',
     body_of((ROOT / 'docs/kullanim-kosullari.md').read_text())),
    ('hesap-silme.html', 'hesap-silme.html', 'Hesabımı sil', 'Hesap ve veri silme',
     body_of((ROOT / 'docs/hesap-silme.md').read_text())),
]

for name, href, title, subtitle, md in pages:
    html = render(md).replace('href="./#b-kvkk', 'href="kvkk.html#b-kvkk')
    (OUT / name).write_text(page(href, title, subtitle, html))
    print('yazıldı:', name)
