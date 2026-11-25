#!/usr/bin/env python3
"""Build the static preview (no server): python3 mkdemo.py OUT_DIR
Fills index.html placeholders with default prices and copies every public file the apps need."""
import os, re, shutil, sys
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(SRC):
    if f in ('sw.js',):
        continue
    shutil.copy(os.path.join(SRC, f), os.path.join(OUT, f))
h = open(os.path.join(SRC, 'index.html'), encoding='utf-8').read()
for k, v in {'{{TRIAL}}': '10', '{{MONTHLY_F}}': '999', '{{YEARLY_F}}': '7,999', '{{MONTHLY}}': '999', '{{YEARLY}}': '7999', '{{URL}}': ''}.items():
    h = h.replace(k, v)
h = h.replace('href="/manifest.webmanifest"', 'href="manifest.webmanifest"').replace('href="/icon.svg"', 'href="icon.svg"').replace('href="/icon-180.png"', 'href="icon-180.png"')
h = h.replace('<link rel="canonical" href="/">', '').replace('<meta property="og:url" content="/">', '').replace('content="/og.png"', 'content="og.png"')
h = h.replace('<!--CFG-->', '')
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(h)
print('preview built in', OUT)
