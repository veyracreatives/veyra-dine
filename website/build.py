import sys, urllib.parse
name = sys.argv[1]
t = open('template.html').read()
wa = 'https://wa.me/918928246726?text='
rep = {
 '{{NAME}}': name,
 '{{DOWNLOAD}}': 'https://veyracreatives.github.io/dine-in/download/Veyra-Dine-In-Setup.exe',
 '{{WA}}': wa + urllib.parse.quote(f'Hi, I want a free demo of {name} for my restaurant'),
 '{{WA_LIFE}}': wa + urllib.parse.quote(f'Hi, I want to buy {name} Lifetime (₹14,999)'),
 '{{WA_YEAR}}': wa + urllib.parse.quote(f'Hi, I want to buy {name} Yearly (₹5,999)'),
}
for k, v in rep.items(): t = t.replace(k, v)
open('index.html', 'w').write(t)

# ---------- SEO-ready website for real hosting (site/) ----------
import os, re, json, html as H, shutil
from PIL import Image
SITE = (sys.argv[2] if len(sys.argv) > 2 else 'https://veyracreatives.github.io/dine-in').rstrip('/')
os.makedirs('site/img', exist_ok=True)
page = open('index.html').read()
page = page.replace(f'href="{rep["{{DOWNLOAD}}"]}" target="_blank" rel="noopener"', f'href="{rep["{{DOWNLOAD}}"]}" download')
# image width/height (stops layout jumps) + lazy loading below the hero
def sized(m):
    tag, src = m.group(0), m.group(1)
    try: w, h = Image.open(src).size
    except Exception: return tag
    extra = f' width="{w}" height="{h}"'
    if 'menu-new' not in src or 'phones' in tag: extra += ' decoding="async"'
    return tag.replace('<img ', '<img' + extra + ' ', 1)
page = re.sub(r'<img [^>]*?src="([^"]+)"[^>]*>', sized, page)
first = True
def lazy(m):
    global first
    t = m.group(0)
    if first or 'menu-new.jpg" alt="QR' in t: first = False; return t.replace('<img ', '<img fetchpriority="high" ', 1) if 'counter.jpg' in t else t
    return t.replace('<img ', '<img loading="lazy" ', 1)
page = re.sub(r'<img [^>]*>', lazy, page)
page = page.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
title_m = re.search(r'<title>.*?</title>\n?', page); page = page.replace(title_m.group(0), '')
faqs = [(H.unescape(re.sub('<[^>]+>', '', q)), H.unescape(re.sub('<[^>]+>', '', a))) for q, a in re.findall(r'<summary>(.*?)</summary><p>(.*?)</p>', page)]
TITLE = f'{name} · QR Code Table Ordering App for Restaurants in India'
DESC = 'Guests scan the QR code on the table, order from their phone and pay by UPI. Orders reach your counter instantly with the table number. Windows app for restaurants, cafés and dhabas. Free for 30 days.'
ld = {'@context': 'https://schema.org', '@graph': [
  {'@type': 'Organization', '@id': SITE + '/#org', 'name': 'Veyra Lab', 'url': SITE + '/', 'logo': SITE + '/icon-512.png',
   'sameAs': ['https://www.instagram.com/veyralab.in/'],
   'contactPoint': {'@type': 'ContactPoint', 'telephone': '+91-89282-46726', 'contactType': 'sales', 'areaServed': 'IN', 'availableLanguage': ['en', 'hi', 'mr']}},
  {'@type': 'SoftwareApplication', 'name': name, 'applicationCategory': 'BusinessApplication', 'applicationSubCategory': 'Restaurant QR ordering', 'operatingSystem': 'Windows 10, Windows 11',
   'description': DESC, 'url': SITE + '/', 'downloadUrl': rep['{{DOWNLOAD}}'], 'image': SITE + '/og.jpg', 'screenshot': [SITE + '/img/counter.jpg', SITE + '/img/menu-new.jpg'],
   'publisher': {'@id': SITE + '/#org'}, 'areaServed': [{'@type': 'City', 'name': c} for c in ['Navi Mumbai', 'Thane', 'Mumbai']] + [{'@type': 'Country', 'name': 'India'}],
   'offers': [{'@type': 'Offer', 'name': '30-day free trial', 'price': '0', 'priceCurrency': 'INR'},
              {'@type': 'Offer', 'name': 'Lifetime license', 'price': '14999', 'priceCurrency': 'INR'},
              {'@type': 'Offer', 'name': 'Yearly plan', 'price': '5999', 'priceCurrency': 'INR'}]},
  {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faqs]},
]}
head = f'''<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{H.escape(TITLE)}</title>
<meta name="description" content="{H.escape(DESC)}">
<meta name="keywords" content="QR code ordering, QR menu, restaurant ordering app, table ordering system, digital menu, restaurant software India, split bill UPI, Navi Mumbai, Thane">
<link rel="canonical" href="{SITE}/">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#E4572E">
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="apple-touch-icon" href="icon-180.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{H.escape(name)}">
<meta property="og:locale" content="en_IN">
<meta property="og:url" content="{SITE}/">
<meta property="og:title" content="{H.escape(TITLE)}">
<meta property="og:description" content="{H.escape(DESC)}">
<meta property="og:image" content="{SITE}/og.jpg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{H.escape(name)}: guests scan the table QR and the order reaches your counter">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{H.escape(TITLE)}">
<meta name="twitter:description" content="{H.escape(DESC)}">
<meta name="twitter:image" content="{SITE}/og.jpg">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
'''
# the page's own <link>/<style> go in <head>, the rest in <body>
cut = page.index('</style>') + len('</style>')
site = head + page[:cut] + '\n<style>html,body{margin:0} img{max-width:100%;height:auto}</style>\n</head>\n<body>\n' + page[cut:] + '\n</body>\n</html>\n'
open('site/index.html', 'w').write(site)
for f in os.listdir('img'): shutil.copy('img/' + f, 'site/img/' + f)
open('site/robots.txt', 'w').write(f'User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n')
import datetime
open('site/sitemap.xml', 'w').write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>{SITE}/</loc><lastmod>{datetime.date.today()}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>\n</urlset>\n')
ic = Image.open('/mnt/project-files/qr-table-ordering/logo/icon-512.png').convert('RGBA')
ic.save('site/icon-512.png'); ic.resize((180, 180), Image.LANCZOS).save('site/icon-180.png'); ic.resize((32, 32), Image.LANCZOS).save('site/favicon-32.png')
print('site/ built for', SITE, '-', len(faqs), 'FAQs in schema')
