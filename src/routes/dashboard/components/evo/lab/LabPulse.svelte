<script lang="ts">
  /**
   * LabPulse — six headline tiles per view (spec §7.2). The view changes only
   * the tiles. Every tile carries its definition behind ⓘ.
   */
  import type { Lab } from '../engine/lab.ts';
  import type { EvoCube } from '../engine/types.ts';
  import type { LabView } from './labState.ts';
  import { STATE_LABEL } from '../engine/rules.ts';
  import { armLabel } from '../engine/join.ts';
  import { int, money, pct, per100, weeks } from './words.ts';

  export let view: LabView;
  export let lab: Lab;
  export let fullLab: Lab;
  export let cube: EvoCube;
  export let currency = 'USD';
  export let decisions: any[] = [];
  export let onOpen: (key: string, tab?: any) => void;

  let openDef: string | null = null;

  interface Tile { key: string; label: string; value: string; sub?: string; def: string; tone?: 'good' | 'bad' | 'watch'; open?: () => void }

  function units() { return lab.joined.filter((j) => j.def.surface !== 'email').flatMap((j) => j.units); }
  /** De-duplicate visitors across experiments (a visitor is in several tests). */
  function people() { return new Set(units().map((u) => u.vid)).size; }
  function credited() {
    const ids = new Set<string>();
    for (const u of units()) if (u.leadId) ids.add(u.leadId);
    return [...ids].map((id) => lab.leads.get(id)).filter(Boolean) as any[];
  }
  function rateOf(key: string) {
    let n = 0, x = 0, maturing = 0;
    for (const a of lab.analyses) {
      if (a.def.surface === 'email') continue;
      const r = [a.primary, ...a.guardrails, ...a.secondary].find((m) => m.key === key);
      if (!r) continue;
      for (const arm of r.arms) { n += arm.n; x += arm.x; maturing += arm.maturing; }
    }
    return { rate: n ? x / n : null, n, maturing };
  }
  function nextDecision() {
    const f = fullLab.analyses.filter((a) => a.forecast?.medianWeeks !== null && a.forecast).sort((a, b) => (a.forecast!.medianWeeks! - b.forecast!.medianWeeks!));
    return f[0] ?? null;
  }

  $: L = credited();
  $: won = L.filter((l) => l.won);
  $: booked = won.reduce((s, l) => s + (l.money?.[currency]?.booked ?? 0), 0);
  $: next = nextDecision();
  $: shipped = decisions.filter((d) => d.decision === 'ship' && !d.revertedBy);
  $: running = cube.experiments.filter((d) => d.status === 'running').length;
  $: tiles = ((): Tile[] => {
    const lead = rateOf('lead'), call = rateOf('callBooked'), show = rateOf('showRate'), wonR = rateOf('wonMature'), drop = rateOf('dropped');
    const click = rateOf('step:cta_click');
    const drip = fullLab.analyses.find((a) => a.def.componentKey === 'EmailDripSubject')?.primary;
    const dripN = drip ? drip.arms.reduce((s, a) => s + a.n, 0) : 0;
    const dripX = drip ? drip.arms.reduce((s, a) => s + a.x, 0) : 0;
    const healthTone: Tile['tone'] = fullLab.health.tone === 'good' ? 'good' : fullLab.health.tone === 'bad' ? 'bad' : 'watch';
    const maturing = lead.maturing;
    const med = (() => { const v = won.map((l) => l.daysToClose).filter((d) => d !== null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; })();
    const best = fullLab.audiences.effects.find((e) => e.significant);
    const unknownSrc = (() => { const us = units(); const n = new Set(us.map((u) => u.vid)).size; const unk = new Set(us.filter((u) => (u.ctx?.landingSource ?? '(direct)') === '(direct)').map((u) => u.vid)).size; return n ? unk / n : null; })();
    const holds = fullLab.analyses.filter((a) => a.decision.state === 'guardrail_hold').length;
    const T: Record<string, Tile> = {
      running: { key: 'running', label: 'Running experiments', value: int(running), sub: `${cube.experiments.length} registered`, def: 'Experiments with status "running" in the registry. Each splits its visitors 50/50 between two versions.' },
      people: { key: 'people', label: 'People tested', value: int(people()), sub: 'unique visitors in web/chat tests', def: 'Unique visitors with at least one assignment after the experiments restarted, excluding bots, dev traffic and tests. A visitor is usually in several tests at once.' },
      waiting: { key: 'waiting', label: 'Decisions waiting', value: int(fullLab.waiting.length), sub: fullLab.waiting[0] ? `${fullLab.waiting[0].def.title}: ${STATE_LABEL[fullLab.waiting[0].decision.state]}` : 'none yet', def: 'Experiments whose verdict at the last Monday decision point is Ready to ship, Keep control, No meaningful difference, Guardrail hold or Data problem.', tone: fullLab.waiting.length ? 'watch' : undefined, open: fullLab.waiting[0] ? () => onOpen(fullLab.waiting[0].def.componentKey) : undefined },
      next: { key: 'next', label: 'Next decision expected', value: next ? weeks(next.forecast!.medianWeeks) : '—', sub: next ? next.def.title : 'no test has enough traffic to forecast', def: 'Simulated from current traffic and results: the median number of weeks until the decision rules reach a verdict. Updated with every refresh.', open: next ? () => onOpen(next.def.componentKey) : undefined },
      won: { key: 'won', label: 'Won deals from tested people', value: int(won.length), sub: won.length ? `${money(booked, currency, true)} booked` : 'none yet', def: 'Leads credited to a tested visitor that became clients (Sales Report deals). Open an experiment → Clients to see who they are.' },
      health: { key: 'health', label: 'Tracking health', value: fullLab.health.tone === 'good' ? 'Healthy' : fullLab.health.tone === 'bad' ? 'Problem' : 'Check', sub: fullLab.health.text, def: 'Whether events arrive, arms are balanced and nothing is contaminated. Details in Operations → Data health.', tone: healthTone },
      leads: { key: 'leads', label: 'Leads from tested people', value: int(L.length), sub: `${int(lead.n)} mature visitors`, def: 'Consultations credited to a tested visitor: the earliest lead of that person within the lead window after their first visit.' },
      call: { key: 'call', label: 'Call booked rate', value: pct(call.rate), sub: `of ${int(call.n)} visitors (mature)`, def: 'Share of tested visitors whose credited lead booked a call. Counted only once a visitor is old enough (window + 30 days).' },
      show: { key: 'show', label: 'Show rate', value: pct(show.rate), sub: `${int(show.n)} bookers`, def: 'Among visitors whose lead booked a call, the share who attended. Descriptive: variants can change who books.' },
      winR: { key: 'winR', label: 'Win rate (60 d)', value: pct(wonR.rate), sub: `${int(wonR.n)} mature visitors`, def: 'Share of tested visitors who became clients within 60 days of their lead (the Metrics Hub definition).' },
      close: { key: 'close', label: 'Median days to close', value: med === null ? '—' : `${med} d`, sub: `${won.length} won deals`, def: 'Lead to accepted quote, for won deals credited to tested visitors.' },
      maturing: { key: 'maturing', label: 'Visitors still maturing', value: int(maturing), sub: 'too recent to count for leads yet', def: 'Visitors assigned less than the lead window ago. They are not counted as non-converters, which would bias against newer arms.' },
      bookedT: { key: 'bookedT', label: 'Booked from tested people', value: money(booked, currency, true), sub: `${currency} · ${won.length} deals`, def: 'Booked amount (Sales Report ledger) of won deals credited to tested visitors, in the reporting currency.' },
      holds: { key: 'holds', label: 'Guardrail holds', value: int(holds), sub: holds ? 'a leading variant hurts quality' : 'none', def: 'Experiments where the leading variant looks worse on a guardrail (leads, calls, drops) by more than 20 %.', tone: holds ? 'bad' : undefined },
      dealsArm: (() => {
        const a = fullLab.analyses.filter((x) => x.def.surface !== 'email').sort((x, y) => y.primary.arms.reduce((s, r) => s + r.n, 0) - x.primary.arms.reduce((s, r) => s + r.n, 0))[0];
        const w = a ? [...a.guardrails, ...a.secondary].find((m) => m.key === 'wonMature') : null;
        return { key: 'dealsArm', label: 'Won deals per arm', value: w ? w.arms.map((r) => int(r.x)).join(' vs ') : '—', sub: a ? `${a.def.title}: ${a.arms.map((k) => armLabel(a.def, k)).join(' vs ')}` : '', def: 'Won deals (60 days) per arm in the experiment with the most traffic. Too few deals for statistics; the Clients tab names them.' } as Tile;
      })(),
      drop: { key: 'drop', label: 'Drop rate', value: pct(drop.rate), sub: `${int(drop.n)} mature visitors`, def: 'Share of tested visitors whose lead dropped out.' },
      exposed: { key: 'exposed', label: 'People tested', value: int(people()), sub: 'web and chat', def: 'Unique tested visitors after exclusions.' },
      click: { key: 'click', label: 'CTA click rate', value: pct(click.rate), sub: `${int(click.n)} visitors (7-day)`, def: 'Share of tested visitors who clicked the hero CTA within 7 days of their first visit.' },
      leadRate: { key: 'leadRate', label: 'Lead rate', value: pct(lead.rate), sub: `${int(lead.n)} mature visitors`, def: 'Share of tested visitors who became a lead within the lead window.' },
      dripClick: { key: 'dripClick', label: 'Drip click rate', value: dripN ? pct(dripX / dripN) : '—', sub: `${int(dripN)} assignees reached`, def: 'Share of nurture-email assignees who clicked a link within 14 days.' },
      audience: { key: 'audience', label: 'Best audience effect', value: best ? `${best.value}` : 'Locked', sub: best ? `${best.componentKey} (${best.dimLabel}): ${per100(best.shrunkDiff)} per 100 visitors` : (fullLab.audiences.locked[0] ? `needs ${fullLab.audiences.locked[0].need} conversions (has ${fullLab.audiences.locked[0].have})` : 'no significant audience effect'), def: 'The strongest variant effect specific to an audience (device, language, landing source …) that survives false-discovery control.' },
      unknown: { key: 'unknown', label: 'Unknown landing source', value: pct(unknownSrc), sub: 'direct or untagged visits', def: 'Share of tested visitors with no UTM tag and no referrer. Tag campaign links to make audience results useful.' },
    };
    const sets: Record<LabView, string[]> = {
      leadership: ['running', 'people', 'waiting', 'next', 'won', 'health'],
      sales: ['leads', 'call', 'show', 'winR', 'close', 'maturing'],
      finance: ['won', 'bookedT', 'holds', 'dealsArm', 'drop', 'maturing'],
      marketing: ['exposed', 'click', 'leadRate', 'dripClick', 'audience', 'unknown'],
    };
    const out = sets[view].map((k) => T[k]);
    if (view === 'leadership' && shipped.length) out.splice(4, 0, { key: 'shipped', label: 'Shipped winners', value: int(shipped.length), sub: 'lifts as measured at decision time', def: 'Experiments with a recorded Ship decision. Lifts measured when a winner is picked tend to overstate the long-run effect.' });
    return out.slice(0, view === 'leadership' && shipped.length ? 7 : 6);
  })();
</script>

<div class="evo-pulse" role="group" aria-label="Headline numbers">
  {#each tiles as t (t.key)}
    <article class="pt-tile evo-tile" class:evo-tile--good={t.tone === 'good'} class:evo-tile--bad={t.tone === 'bad'} class:evo-tile--watch={t.tone === 'watch'}>
      <div class="pt-top">
        <h4 class="pt-label">{t.label}</h4>
        <button class="pt-info" aria-expanded={openDef === t.key} aria-label="What is {t.label}?" on:click={() => (openDef = openDef === t.key ? null : t.key)}>i</button>
      </div>
      <div class="pt-value">{t.value}</div>
      {#if t.sub}<div class="evo-tile__sub">{t.sub}</div>{/if}
      {#if t.open}<button class="mh-link evo-tile__more" on:click={t.open}>Open →</button>{/if}
      {#if openDef === t.key}<p class="pt-def">{t.def}</p>{/if}
    </article>
  {/each}
</div>
