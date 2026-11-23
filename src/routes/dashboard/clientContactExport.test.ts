/**
 * Contact list export — Ref., name, email and phone only, for labeling the
 * team's WhatsApp groups. Nothing else from the client record may leak in.
 */
import { describe, it, expect } from 'vitest';
import { buildClientContactRecords, serializeClientContacts, type Client } from './store.ts';

const client = (over: Record<string, unknown>) =>
  ({ id: 'id', name: '', surname: '', email: '', phone: '', shortId: '', rawDoc: { transcript: 'secret' }, ...over }) as unknown as Client;

describe('contact list export', () => {
  const list = [
    client({ name: 'Zoe', surname: 'Ruiz', email: 'z@x.com', phone: ' +506 8888 0000 ', shortId: '3fa9c1d2' }),
    client({ name: '', email: 'anon@x.com' }),
    client({ name: 'Ana', surname: '', email: ' ana@x.com ', shortId: 'a1b2c3d4' }),
  ];

  it('keeps only ref, name, email and phone, trimmed', () => {
    const rows = buildClientContactRecords(list);
    expect(rows[0]).toEqual({ ref: 'a1b2c3d4', name: 'Ana', email: 'ana@x.com', phone: '' });
    expect(rows[1]).toEqual({ ref: '3fa9c1d2', name: 'Zoe Ruiz', email: 'z@x.com', phone: '+506 8888 0000' });
    expect(Object.keys(rows[0]).sort()).toEqual(['email', 'name', 'phone', 'ref']);
  });

  it('sorts by name and puts unnamed clients last', () => {
    expect(buildClientContactRecords(list).map((r) => r.email)).toEqual(['ana@x.com', 'z@x.com', 'anon@x.com']);
  });

  it('never includes anything else from the record', () => {
    const json = serializeClientContacts(list);
    expect(json).not.toContain('secret');
    expect(JSON.parse(json).count).toBe(3);
  });
});
