#!/usr/bin/env python3
"""Rebuilds public/site/content.json (the list of texts and pictures Veyra HQ can edit) from public/site/index.html.
New text keys are 't' + the first 8 hex characters of sha1(text). Run: python3 tools/site-content.py"""
import json, re, html, sys, os
from html.parser import HTMLParser
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'public/site/index.html'); OUT = os.path.join(ROOT, 'public/site/content.json')
VOID = {'img', 'br', 'input', 'meta', 'link', 'hr', 'source'}

class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True); s.stack = []; s.items = []; s.section = 'Top of page'; s.sec_items = []; s.in_sec = 0; s.h2 = None
    def handle_starttag(s, tag, attrs):
        a = dict(attrs)
        if tag == 'section': s.in_sec = 1; s.sec_items = []; s.h2 = None; s.secdepth = len(s.stack)
        if tag == 'footer': s.section = 'Footer'
        if tag == 'img' and a.get('data-k'):
            s.items.append({'k': a['data-k'], 'type': 'img', 'src': a.get('src', ''), 'alt': a.get('alt', ''), 'section': None if s.in_sec else s.section}); (s.sec_items if s.in_sec else []).append(s.items[-1])
        if tag in VOID: return
        s.stack.append([tag, a, []])
        if tag == 'h2' and s.in_sec and s.h2 is None: s.h2 = s.stack[-1]
    def handle_endtag(s, tag):
        if tag in VOID: return
        while s.stack:
            t, a, buf = s.stack.pop()
            text = ''.join(buf)
            if s.stack: s.stack[-1][2].append(text)
            if a.get('data-k') and t != 'img':
                it = {'k': a['data-k'], 'type': 'text', 'tag': t, 'text': re.sub(r'\s+', ' ', text).strip(), 'section': None if s.in_sec else s.section}
                s.items.append(it)
                if s.in_sec: s.sec_items.append(it)
            if t == 'h2' and s.in_sec and s.h2 is not None and s.h2[1] is a: s.h2_text = re.sub(r'\s+', ' ', text).strip()
            if t == 'section':
                for it in s.sec_items: it['section'] = getattr(s, 'h2_text', '') or 'Top of page'
                s.in_sec = 0; s.h2_text = ''
            if t == tag: break
    def handle_data(s, d):
        if s.stack: s.stack[-1][2].append(d)

src = open(SRC, encoding='utf8').read()
body = src[src.index('<body'):]
p = P(); p.feed(body)
old = json.load(open(OUT, encoding='utf8'))
prev = {i['k']: i for i in old.get('items', [])}
seen = set(); items = []
for it in p.items:
    if it['k'] in seen: continue
    seen.add(it['k'])
    if it['k'] in prev: # keep the section and order HQ already shows; take the new wording
        o = dict(prev[it['k']]); 
        if o.get('type') == 'text': o['text'] = it['text']
        it = o
    items.append(it)
order = {k: n for n, k in enumerate(prev)}
items.sort(key=lambda i: order.get(i['k'], len(order)))
json.dump({'items': items, 'prices': old.get('prices', {'lifetime': 24999, 'yearly': 5999, 'monthly': 799})}, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(items), 'items')
