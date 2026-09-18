"""Build the English site (/en/) from the Hebrew pages.

The Hebrew pages are the source of truth. This script copies each one, applies the
translations in en.tsv, switches the page to LTR and rewrites paths/URLs for /en/.

    python _i18n/build_en.py

It stops with an error listing any Hebrew text that has no translation, so the English
pages can never silently fall out of sync with the Hebrew ones.
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = 'https://www.yosef-mobile.co.il/'
PAGES = ['index.html', 'products.html', 'downloads.html']

HEBREW = re.compile(r'[֐-׿יִ-ﭏ]')
LD_JSON = re.compile(r'<script type="application/ld\+json">.*?</script>', re.S)
JSON_STRING = re.compile(r'"((?:[^"\\]|\\.)*)"')
ATTR_VALUE = re.compile(r'(=")([^"]*)(")')
TEXT_NODE = re.compile(r'(>)([^<]+)(<)')

# Snippets whose English word order differs from the Hebrew, so they are translated
# as whole markup before the per-segment pass.
MARKUP = [
    ('נגני אנדרואיד כשרים <span class="grad-text">HPower</span>',
     '<span class="grad-text">HPower</span> kosher Android players'),
    ('המוצרים <span class="grad-text">שלנו</span>',
     'Our <span class="grad-text">products</span>'),
]


def load_translations():
    pairs = {}
    path = os.path.join(HERE, 'en.tsv')
    for n, line in enumerate(io.open(path, encoding='utf-8'), 1):
        line = line.rstrip('\n')
        if not line.strip() or line.startswith('#'):
            continue
        if line.count('\t') != 1:
            sys.exit('en.tsv line %d: expected exactly one TAB' % n)
        he, en = line.split('\t')
        if '"' in en or '\\' in en:
            sys.exit('en.tsv line %d: English text must not contain " or \\ (it is used inside JSON-LD)' % n)
        if he in pairs:
            sys.exit('en.tsv line %d: duplicate Hebrew text' % n)
        pairs[he] = en
    return pairs


def translate_segments(html, pairs, used):
    """Translate each Hebrew text node, attribute value and JSON-LD string as a whole.

    Only exact, complete matches are replaced, so a short entry can never rewrite part of
    a longer word or sentence. Returns the new html and the Hebrew segments with no entry.
    """
    missing = set()

    def swap(text):
        key = text.strip()
        if not HEBREW.search(key):
            return text
        if key in pairs:
            used.add(key)
            return text.replace(key, pairs[key])
        missing.add(key)
        return text

    # JSON-LD first: its strings all sit inside one script text node
    html = LD_JSON.sub(
        lambda block: JSON_STRING.sub(lambda s: '"%s"' % swap(s.group(1)), block.group(0)), html)
    html = ATTR_VALUE.sub(lambda m: m.group(1) + swap(m.group(2)) + m.group(3), html)
    # JSON-LD blocks are Hebrew-free by now, so they pass through this untouched
    html = TEXT_NODE.sub(lambda m: m.group(1) + swap(m.group(2)) + m.group(3), html)
    return html, missing


def localize_urls(html, page):
    """Point the page's own URLs at /en/ while leaving hreflang links and asset URLs alone."""
    path = '' if page == 'index.html' else page
    html = html.replace('<link rel="canonical" href="%s%s">' % (SITE, path),
                        '<link rel="canonical" href="%sen/%s">' % (SITE, path))
    html = html.replace('<meta property="og:url" content="%s%s">' % (SITE, path),
                        '<meta property="og:url" content="%sen/%s">' % (SITE, path))

    def fix_ld(m):
        block = re.sub(re.escape(SITE) + r'(?!assets/|en/)', SITE + 'en/', m.group(0))
        return block.replace('"inLanguage": "he-IL"', '"inLanguage": "en"')
    return LD_JSON.sub(fix_ld, html)


def relocate_paths(html):
    """The English pages live one directory down."""
    html = re.sub(r'(?<=["\s,])assets/', '../assets/', html)
    html = html.replace('href="site.webmanifest"', 'href="../site.webmanifest"')
    html = re.sub(r'href="([A-Za-z]+\.(?:apk|zip))"', r'href="../\1"', html)
    return html


def switch_to_hebrew_link(html, page):
    he_href = '../' if page == 'index.html' else '../' + page
    return re.sub(
        r'<a class="lang-switch" href="[^"]*" hreflang="en" lang="en" aria-label="English version">'
        r'(<svg[^>]*>.*?</svg>)English</a>',
        r'<a class="lang-switch" href="%s" hreflang="he" lang="he" dir="rtl" aria-label="גרסה עברית">\1עברית</a>'
        % he_href,
        html)


def build():
    pairs = load_translations()
    used = set()
    problems = []
    os.makedirs(os.path.join(ROOT, 'en'), exist_ok=True)

    for page in PAGES:
        html = io.open(os.path.join(ROOT, page), encoding='utf-8').read()

        html = html.replace('<html lang="he" dir="rtl">', '<html lang="en" dir="ltr">')
        html = html.replace('content="he_IL"', 'content="en_US"')
        html = localize_urls(html, page)
        html = relocate_paths(html)

        for he, en in MARKUP:
            if he in html:
                html = html.replace(he, en)
                used.add(he)
        html, missing = translate_segments(html, pairs, used)
        html = html.replace('‏', '')  # right-to-left marks left over from Hebrew punctuation

        if missing:
            problems.append((page, sorted(missing)))
            continue

        html = switch_to_hebrew_link(html, page)
        io.open(os.path.join(ROOT, 'en', page), 'w', encoding='utf-8', newline='\n').write(html)
        print('en/%s written' % page)

    if problems:
        print('\nUntranslated Hebrew - add these to _i18n/en.tsv:')
        for page, texts in problems:
            print('\n  %s:' % page)
            for t in texts:
                print('    ' + t)
        sys.exit(1)

    unused = [he for he in pairs if he not in used] + [he for he, _ in MARKUP if he not in used]
    if unused:
        print('\nNote - translations no longer used anywhere (safe to delete from en.tsv):')
        for he in unused:
            print('    ' + he)


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    build()
