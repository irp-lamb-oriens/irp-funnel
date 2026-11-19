import { describe, it, expect } from 'vitest';
import { tabs } from './a11yTabs.ts';

function row(html: string) {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

describe('use:tabs', () => {
  it('adds tablist/tab roles and mirrors a class-driven active state', async () => {
    const n = row('<button>A</button><button class="active">B</button><button>C</button>');
    tabs(n, { label: 'Sections' });
    const [a, b, c] = Array.from(n.children) as HTMLButtonElement[];
    expect(n.getAttribute('role')).toBe('tablist');
    expect(n.getAttribute('aria-label')).toBe('Sections');
    expect([a, b, c].map((x) => x.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect([a, b, c].map((x) => x.tabIndex)).toEqual([-1, 0, -1]);

    b.classList.remove('active');
    c.classList.add('active');
    await flush();
    expect(c.getAttribute('aria-selected')).toBe('true');
    expect(c.tabIndex).toBe(0);
  });

  it('arrow keys move focus, wrap, skip disabled and activate in tabs mode', () => {
    const n = row('<button class="active">A</button><button disabled>B</button><button>C</button>');
    const clicks: string[] = [];
    n.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => clicks.push(b.textContent!)));
    tabs(n);
    const [a, , c] = Array.from(n.children) as HTMLButtonElement[];
    a.focus();
    key(a, 'ArrowRight');
    expect(document.activeElement).toBe(c);
    expect(clicks).toEqual(['C']);
    key(c, 'ArrowRight');
    expect(document.activeElement).toBe(a);
    key(a, 'End');
    expect(document.activeElement).toBe(c);
  });

  it('toggle mode keeps aria-pressed and does not activate on arrows', () => {
    const n = row('<button aria-pressed="true">A</button><button aria-pressed="false">B</button>');
    let clicked = false;
    n.children[1].addEventListener('click', () => (clicked = true));
    tabs(n, { mode: 'toggle' });
    expect(n.getAttribute('role')).toBe('group');
    expect(n.children[0].getAttribute('role')).toBeNull();
    (n.children[0] as HTMLElement).focus();
    key(n.children[0], 'ArrowRight');
    expect(document.activeElement).toBe(n.children[1]);
    expect(clicked).toBe(false);
  });

  it('respects component-owned aria-selected', () => {
    const n = row('<button aria-selected="false">A</button><button aria-selected="true">B</button>');
    tabs(n);
    expect(n.children[1].getAttribute('aria-selected')).toBe('true');
    expect((n.children[1] as HTMLElement).tabIndex).toBe(0);
  });
});
