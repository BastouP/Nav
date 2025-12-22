"""Build pages/pages.json by scanning the pages/ folder.
Run: python scripts/build_index.py
Generates: pages/pages.json

It extracts <title>, meta name="keywords", meta name="description", and meta name="display" (optional).
If no display is provided, it builds one from the filename (lowercased, alphanumeric only).
"""
import os
import re
import json

ROOT = os.path.dirname(os.path.dirname(__file__))
PAGES_DIR = os.path.join(ROOT, 'pages')
OUT_FILE = os.path.join(PAGES_DIR, 'pages.json')

html_files = [f for f in os.listdir(PAGES_DIR) if f.endswith('.html')]

pages = []

def extract_meta(content, name):
    m = re.search(r'<meta\s+name=["\']%s["\']\s+content=["\']([^"\']+)["\']' % re.escape(name), content, re.I)
    return m.group(1).strip() if m else None

for fname in sorted(html_files):
    path = os.path.join(PAGES_DIR, fname)
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    title_m = re.search(r'<title>(.*?)</title>', text, re.I|re.S)
    title = title_m.group(1).strip() if title_m else fname
    desc = extract_meta(text, 'description') or extract_meta(text, 'desc')
    keywords = extract_meta(text, 'keywords')
    display = extract_meta(text, 'display')

    # default display based on filename, lowercased and alphanumeric only
    base = os.path.splitext(fname)[0]
    if not display:
        if base.lower() in ('home', 'index'):
            display = 'https://lapage'
        else:
            cleaned = re.sub(r'[^a-z0-9]', '', base.lower())
            display = 'https://' + (cleaned or base.lower())

    pages.append({
        'url': 'pages/' + fname,
        'title': title,
        'display': display,
        'keywords': keywords or '',
        'desc': desc or ''
    })

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(pages, f, indent=2, ensure_ascii=False)

print(f'Wrote {len(pages)} pages to {OUT_FILE}')