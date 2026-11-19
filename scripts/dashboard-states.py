#!/usr/bin/env python3
"""
dashboard-states.py — make every "state" message in the dashboard look and
announce the same, whatever component it lives in.

Finds elements by the ROLE their class name already declares and
  1. normalises their typography in the component's <style> (plain rules only):
       …empty            → readable note (dim, 13px, not italic)
       …error / …err     → danger ink on danger tint, 13px/600
       …hint / …help     → muted helper text, not italic
  2. adds the missing ARIA role in markup:
       …error            → role="alert"
       …empty / …loading → role="status"
Layout declarations (padding, margin, grid…) are never touched. Idempotent.
Usage: python3 scripts/dashboard-states.py [--dry]
"""
import os, re, sys
from collections import Counter

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'routes', 'dashboard')
SKIP = {'InvoiceDocument.svelte', 'Alert.svelte', 'EmptyState.svelte', 'StatusLine.svelte', 'GroupHeader.svelte', 'InfoTip.svelte'}
stats = Counter()

ROLES = [
    (re.compile(r'(?:__|-)empty(?:-state|-msg|-text)?$'), 'empty',
     {'color': 'var(--irp-text-dim)', 'font-size': 'var(--irp-fs-sm)', 'font-style': 'normal', 'letter-spacing': None}),
    (re.compile(r'(?:__|-)(?:error|err)(?:-msg|-text)?$'), 'error',
     {'color': 'var(--irp-danger-ink)', 'font-size': 'var(--irp-fs-sm)', 'font-weight': '600', 'font-style': 'normal'}),
    (re.compile(r'(?:__|-)(?:hint|help|helper)$'), 'hint',
     {'color': 'var(--irp-text-dim)', 'font-style': 'normal'}),
]
ERROR_BOX = {'background': 'var(--irp-danger-bg)', 'border': '1px solid var(--irp-danger-line)', 'border-color': 'var(--irp-danger-line)'}

def role_of(selector):
    sel = selector.strip()
    if ',' in sel or ':' in sel or ' ' in sel or '>' in sel or '&' in sel: return None
    m = re.fullmatch(r'\.([\w-]+)', sel)
    if not m: return None
    for pat, name, decls in ROLES:
        if pat.search(m.group(1)): return name, decls
    return None

def fix_style(css):
    def rule(m):
        r = role_of(m.group(1))
        if not r: return m.group(0)
        name, want = r
        body = m.group(2)
        decls = [d for d in body.split(';')]
        seen, out = set(), []
        has_bg = bool(re.search(r'(?:^|;)\s*background(?:-color)?\s*:', body))
        targets = dict(want)
        if name == 'error' and has_bg: targets.update(ERROR_BOX)
        for d in decls:
            mm = re.match(r'(\s*)([\w-]+)(\s*:\s*)(.+?)(\s*)$', d, flags=re.S)
            if not mm: out.append(d); continue
            prop = mm.group(2).lower()
            key = 'background' if prop == 'background-color' else prop
            if key in targets:
                seen.add(key)
                if targets[key] is None: continue          # drop the declaration
                if key == 'border-color' and 'border' in seen: continue
                out.append(f'{mm.group(1)}{prop if key != "background" else "background"}{mm.group(3)}{targets[key]}{mm.group(5)}')
            else:
                out.append(d)
        indent = re.match(r'\s*', decls[0]).group(0) if decls and decls[0].strip() else ' '
        for k, v in want.items():
            if v is not None and k not in seen:
                tail = out.pop() if out and not out[-1].strip() else None
                out.append(f'{indent}{k}: {v}')
                if tail is not None: out.append(tail)
        new = ';'.join(out)
        if new != body: stats[f'style:{name}'] += 1
        return f'{m.group(1)}{{{new}}}'
    return re.sub(r'([^{}]+)\{([^{}]*)\}', rule, css)

TAG = re.compile(r'<(p|div|span|li)(\s[^<>]*?)?\sclass="([^"{}]*)"([^<>]*?)>')
def fix_markup(html):
    def tag(m):
        whole = m.group(0)
        if 'role=' in whole or 'aria-hidden' in whole: return whole
        classes = m.group(3).split()
        role = None
        for c in classes:
            if re.search(r'(?:__|-)(?:error|err)(?:-msg|-text)?$', c): role = 'alert'; break
            if re.search(r'(?:__|-)(?:empty|loading)(?:-state|-msg|-text)?$', c): role = 'status'
        if not role: return whole
        stats[f'role:{role}'] += 1
        return whole[:-1] + f' role="{role}">'
    return TAG.sub(tag, html)

def main():
    dry = '--dry' in sys.argv
    for d, _, files in os.walk(ROOT):
        for f in sorted(files):
            if not f.endswith('.svelte') or f in SKIP: continue
            p = os.path.join(d, f)
            src = open(p, encoding='utf-8').read()
            m = re.search(r'<style[^>]*>', src)
            head, rest = (src[:m.start()], src[m.start():]) if m else (src, '')
            sm = re.search(r'</script>', head)
            script, markup = (head[:sm.end()], head[sm.end():]) if sm else ('', head)
            # only the LAST script block boundary matters; keep earlier text untouched
            idx = head.rfind('</script>')
            if idx >= 0: script, markup = head[:idx + 9], head[idx + 9:]
            markup = fix_markup(markup)
            if rest and 'lang="scss"' not in rest[:40]:
                rest = re.sub(r'(<style[^>]*>)(.*?)(</style>)', lambda s: s.group(1) + fix_style(s.group(2)) + s.group(3), rest, flags=re.S)
            out = script + markup + rest
            if out != src:
                stats['files'] += 1
                if not dry: open(p, 'w', encoding='utf-8').write(out)
    print(dict(stats))

if __name__ == '__main__':
    main()
