#!/usr/bin/env python3
"""
dashboard-tokenize.py — move every dashboard style onto the --irp-* design tokens.

Rewrites, inside <style> blocks of src/routes/dashboard/**/*.svelte and the
global partials in src/routes/dashboard/styles/:
  • hex colours  → nearest ramp step (OKLab ΔE ≤ 0.045), named by ROLE where the
                   property makes the role obvious (color → --irp-text-*, border →
                   --irp-line, background → --irp-surface-*), and bumped to an
                   AA-passing ink when a low-contrast colour is used as text on a
                   light surface.
  • font-size    → --irp-fs-* type scale (floor 11px)
  • border-radius→ --irp-r-* radius scale
Idempotent: a second run changes nothing. Usage:
  python3 scripts/dashboard-tokenize.py [--dry] [--report]
The matching guard is src/routes/dashboard/styles.guard.test.ts.
"""
import math, os, re, sys
from collections import Counter, defaultdict

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'routes', 'dashboard')
SKIP_FILES = {
    '_tokens.scss', '_mixins.scss', '_primitives.scss', '_foundation.scss', 'irp-tokens.scss',
    # Mirrors the server-rendered PDF, which has its own fixed print palette.
    'InvoiceDocument.svelte',
}

RAMPS = {
  'slate': {0:'#ffffff',25:'#fafbfc',50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155',800:'#1e293b',900:'#0f172a',950:'#020617'},
  'teal':  {50:'#effcfc',100:'#d5f6f7',200:'#a8ecee',300:'#6cdde1',400:'#2fc9ce',500:'#02b5bb',600:'#02999e',700:'#0a7c81',800:'#0b6367',900:'#0d4f52'},
  'red':   {50:'#fef2f2',100:'#fee2e2',200:'#fecaca',300:'#fca5a5',400:'#f87171',500:'#ef4444',600:'#dc2626',700:'#c62426',800:'#991b1b',900:'#7f1d1d'},
  'amber': {50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f'},
  'green': {50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b'},
  'blue':  {50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a'},
  'violet':{50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',500:'#8b5cf6',600:'#7c3aed',700:'#6d28d9',800:'#5b21b6',900:'#4c1d95'},
}
DE_MAX = 0.045
DE_MAX_NEUTRAL = 0.08   # near-greys (chroma < 0.03) fold into slate more loosely

# Off-ramp colours that are clearly meant as one of our steps: Tailwind's
# green/indigo/sky/orange families, legacy greys, the old --text-dim.
ALIASES = {
  '#16a34a': ('green', 600), '#15803d': ('green', 700), '#22c55e': ('green', 500), '#4ade80': ('green', 400),
  '#4338ca': ('violet', 700), '#3730a3': ('violet', 800), '#6366f1': ('violet', 500), '#818cf8': ('violet', 400),
  '#6250d6': ('violet', 600),
  '#38bdf8': ('blue', 400), '#0ea5e9': ('blue', 500), '#0284c7': ('blue', 600), '#0369a1': ('blue', 700), '#075985': ('blue', 800),
  '#fed7aa': ('amber', 200), '#fdba74': ('amber', 300),
  '#a21caf': ('violet', 700), '#888888': ('slate', 400), '#4a4a7c': ('slate', 600), '#2e2e4e': ('slate', 800),
  '#8b93a7': ('slate', 500), '#3f6212': ('green', 800), '#0f7a37': ('green', 700), '#92700e': ('amber', 800),
  '#f97316': ('amber', 500),
  # Lavender-greys from the voice-intake flow (AddClientModal) → slate text roles.
  '#5555a0': ('slate', 600), '#6666a0': ('slate', 500), '#8888b0': ('slate', 400), '#9090b8': ('slate', 400),
  '#b0b0cc': ('slate', 400), '#b8b8d0': ('slate', 400), '#b8b8e0': ('slate', 300), '#d4c4fb': ('violet', 200),
  '#111111': ('slate', 900), '#000000': ('slate', 950), '#0b3b3d': ('teal', 900), '#868e96': ('slate', 500),
}

def srgb_to_oklab(h):
    r, g, b = (int(h[i:i+2], 16) / 255 for i in (1, 3, 5))
    def lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = lin(r), lin(g), lin(b)
    l = 0.4122214708*r + 0.5363325363*g + 0.0514459929*b
    m = 0.2119034982*r + 0.6806995451*g + 0.1073969566*b
    s = 0.0883024619*r + 0.2817188376*g + 0.6299787005*b
    l, m, s = (x ** (1/3) if x > 0 else 0 for x in (l, m, s))
    return (0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
            1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
            0.0259040371*l + 0.7827717662*m - 0.8086757660*s)

RAMP_LAB = [(fam, step, srgb_to_oklab(hx)) for fam, steps in RAMPS.items() for step, hx in steps.items()]

def nearest(hx):
    if hx in ALIASES:
        fam, step = ALIASES[hx]; return fam, step, 0.0
    lab = srgb_to_oklab(hx)
    if math.hypot(lab[1], lab[2]) < 0.03:
        best = min((t for t in RAMP_LAB if t[0] == 'slate'), key=lambda t: math.dist(lab, t[2]))
        d = math.dist(lab, best[2])
        if d <= DE_MAX_NEUTRAL: return best[0], best[1], 0.0
    best = min(RAMP_LAB, key=lambda t: sum((a - b) ** 2 for a, b in zip(lab, t[2])))
    return best[0], best[1], math.dist(lab, best[2])

def expand(hx):
    h = hx[1:].lower()
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    return '#' + h if len(h) == 6 else None

def is_dark(hx):
    h = expand(hx)
    return bool(h) and srgb_to_oklab(h)[0] < 0.4

def category(prop):
    p = prop.lower()
    if p.startswith('--'):
        if re.search(r'(bg|surface|soft|fill|background|paper|tint|wash)', p): return 'bg'
        if re.search(r'(border|line|divider|rule|stroke|ring|edge|sep)', p): return 'border'
        if re.search(r'(text|ink|fg|muted|faint|dim|body|label|title|heading|strong|color)', p): return 'text'
        return 'other'
    if p in ('color', '-webkit-text-fill-color', 'caret-color', 'text-decoration-color'): return 'text'
    if p.startswith('border') or p.startswith('outline') or p == 'column-rule': return 'border'
    if p.startswith('background'): return 'bg'
    return 'other'

# Low-contrast steps used as text → the first AA step of the same family.
TEXT_BUMP = {'slate': {400: 500, 300: 500}, 'teal': {300: 700, 400: 700, 500: 700, 600: 700},
             'red': {400: 600, 500: 600}, 'amber': {400: 700, 500: 700, 600: 700},
             'green': {400: 700, 500: 700, 600: 700}, 'blue': {400: 600, 500: 600},
             'violet': {400: 600, 500: 600}}

def token_for(fam, step, cat, bump):
    if cat == 'text' and bump:
        step = TEXT_BUMP.get(fam, {}).get(step, step)
    if fam == 'slate':
        if cat == 'text':
            return {0: 'text-inverse', 950: 'text', 900: 'text', 800: 'text', 700: 'text-2', 600: 'text-muted',
                    500: 'text-dim', 400: 'text-faint'}.get(step, f'slate-{step}')
        if cat == 'border':
            return {200: 'line', 300: 'line-strong'}.get(step, f'slate-{step}')
        if cat == 'bg':
            return {0: 'surface', 25: 'bg', 50: 'surface-2', 100: 'surface-3', 200: 'surface-4'}.get(step, f'slate-{step}')
        return f'slate-{step}'
    if fam == 'teal':
        if cat == 'text' and step in (600, 700): return 'accent-ink'
        if cat != 'text' and step == 500: return 'accent'
        if cat != 'text' and step == 600: return 'accent-hover'
    return f'{fam}-{step}'

SCSS_FUNCS = re.compile(r'(rgba?|hsla?|mix|darken|lighten|saturate|desaturate|transparentize|opacify|fade-in|fade-out|adjust-hue|scale-color|adjust-color|change-color|color\.[a-z]+|tint|shade)$')

def enclosing_func(value, idx):
    depth = 0
    for i in range(idx - 1, -1, -1):
        c = value[i]
        if c == ')': depth += 1
        elif c == '(':
            if depth == 0:
                m = re.search(r'([\w.-]+)\s*$', value[:i])
                return m.group(1) if m else ''
            depth -= 1
    return None

FS = [(11, '2xs'), (12, 'xs'), (13, 'sm'), (14, 'md'), (16, 'lg'), (18, 'xl'), (20, '2xl')]
RADII = [(4, '2xs'), (6, 'xs'), (8, 'sm'), (12, 'md'), (16, 'lg'), (20, 'xl'), (24, '2xl')]

def to_px(num, unit):
    return float(num) * (16 if unit == 'rem' else 1)

def snap(px, scale):
    best = None
    for v, name in scale:
        d = abs(px - v)
        if best is None or d < best[0] - 1e-9 or (abs(d - best[0]) < 1e-9 and v > best[1]):
            best = (d, v, name)
            best = (d, v, name)
    return best[2]

stats = Counter()
unmatched = defaultdict(Counter)

def tokenize_style(css, fname):
    # Mask comments so we never rewrite inside them.
    comments = []
    def keep(m):
        comments.append(m.group(0)); return f'\x00{len(comments)-1}\x00'
    css = re.sub(r'/\*.*?\*/', keep, css, flags=re.S)
    css = re.sub(r'(?<!:)//[^\n]*', keep, css) if fname.endswith('.scss') or 'lang="scss"' in fname else css

    # Files that paint dark surfaces never get text-contrast bumps (light text there is intentional).
    dark_file = any(is_dark(h) for h in re.findall(r'background(?:-color)?\s*:[^;]*?(#[0-9a-fA-F]{3,6})\b', css))

    # Block ranges, so a declaration can see its siblings.
    blocks, stack = [], []
    for i, c in enumerate(css):
        if c == '{': stack.append(i)
        elif c == '}' and stack: blocks.append((stack.pop(), i))
    def block_of(pos):
        best = (0, len(css))
        for s, e in blocks:
            if s < pos < e and s >= best[0]: best = (s, e)
        return css[best[0]:best[1]]

    decl = re.compile(r'(?<![\w$#@-])(--[\w-]+|[a-z-]+)(\s*:\s*)([^;{}]+?)(\s*!important)?(\s*(?:;|(?=\})))')

    def repl(m):
        prop, colon, value, imp, end = m.group(1), m.group(2), m.group(3), m.group(4) or '', m.group(5)
        orig = value
        if 'url(' in value: return m.group(0)
        cat = category(prop)
        p = prop.lower()

        # ── font-size ──
        if p == 'font-size':
            mm = re.fullmatch(r'\s*(\d*\.?\d+)(px|rem)\s*', value)
            if mm:
                px = to_px(*mm.groups())
                if px <= 21:
                    value = f'var(--irp-fs-{snap(max(px, 11), FS)})'; stats['font-size'] += 1
        # ── border-radius ──
        elif p in ('border-radius', 'border-top-left-radius', 'border-top-right-radius',
                   'border-bottom-left-radius', 'border-bottom-right-radius', '--radius') or p.endswith('-radius'):
            def rr(t):
                px = to_px(t.group(1), t.group(2))
                if px < 3 or (30 < px < 99): return t.group(0)
                stats['radius'] += 1
                return 'var(--irp-r-full)' if px >= 99 else f'var(--irp-r-{snap(px, RADII)})'
            value = re.sub(r'(?<![\w.(-])(\d*\.?\d+)(px|rem)\b', rr, value)

        # ── SCSS status vars used as text → ink ──
        if cat == 'text' and p == 'color' and not dark_file:
            v = value.strip()
            ink = {'$accent': '$accent-ink', '$success': '$success-ink', '$warning': '$warning-ink', '$info': '$info-ink'}.get(v)
            if ink: value = value.replace(v, ink); stats['scss-ink'] += 1

        # ── hex colours ──
        def hx(t):
            raw = t.group(0)
            fn = enclosing_func(value_ref[0], t.start())
            if fn is not None and SCSS_FUNCS.search(fn): return raw
            h = expand(raw)
            if not h: unmatched[fname][raw.lower()] += 1; return raw
            fam, step, de = nearest(h)
            if de > DE_MAX:
                unmatched[fname][h] += 1; return raw
            bump = cat == 'text' and not dark_file and not dark_block
            stats['hex'] += 1
            return f'var(--irp-{token_for(fam, step, cat, bump)})'
        dark_block = False
        if cat == 'text':
            blk = block_of(m.start())
            dark_block = any(is_dark(h) for h in re.findall(r'background(?:-color)?\s*:[^;]*?(#[0-9a-fA-F]{3,6})\b', blk)) \
                or bool(re.search(r'background[^;]*var\(--irp-(slate-(800|900|950)|text)\)', blk))
        value_ref = [value]
        value = re.sub(r'#[0-9a-fA-F]{3,8}\b', hx, value)
        if value == orig: return m.group(0)
        return f'{prop}{colon}{value}{imp}{end}'

    css = decl.sub(repl, css)
    # A token never needs another token as its fallback: :root always defines it.
    css, n = re.subn(r'var\((--irp-[\w-]+),\s*var\(--irp-[\w-]+\)\)', r'var(\1)', css)
    stats['fallback'] += n
    while '\x00' in css:  # comments can nest placeholders (// line holding a /* */)
        css = re.sub(r'\x00(\d+)\x00', lambda m: comments[int(m.group(1))], css)
    return css

def process(path, dry):
    name = os.path.basename(path)
    if name in SKIP_FILES: return
    src = open(path, encoding='utf-8').read()
    if path.endswith('.scss'):
        out = tokenize_style(src, name)
    else:
        def sty(m):
            return m.group(1) + tokenize_style(m.group(2), name + (' lang="scss"' if 'scss' in m.group(1) else '')) + m.group(3)
        out = re.sub(r'(<style[^>]*>)(.*?)(</style>)', sty, src, flags=re.S)
    if out != src:
        stats['files'] += 1
        if not dry:
            open(path, 'w', encoding='utf-8').write(out)

def main():
    dry = '--dry' in sys.argv
    for d, _, files in os.walk(ROOT):
        for f in sorted(files):
            if f.endswith('.svelte') or (f.endswith('.scss') and d.endswith('styles')):
                process(os.path.join(d, f), dry)
    print(dict(stats))
    if '--report' in sys.argv:
        tot = Counter()
        for f, c in unmatched.items(): tot.update(c)
        print('unmatched hex (top):', tot.most_common(40))
        for f, c in sorted(unmatched.items(), key=lambda kv: -sum(kv[1].values()))[:15]:
            print(f'  {f}: {sum(c.values())}')

if __name__ == '__main__':
    main()
