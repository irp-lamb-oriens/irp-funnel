/** Open the client drawer for a deal, or say why it can't (sales-book-v3 §4.3). */
import { fetchClientDetail } from '../../store.ts';
import type { Deal } from '../metrics/engine/sales.ts';

export const NO_DRAWER = 'Invoice-only client: no lead card exists';

export function canOpen(d: Pick<Deal, 'consultationId'>): boolean {
  return !!d.consultationId;
}

export async function openClient(id: string | null | undefined): Promise<string | null> {
  if (!id) return NO_DRAWER;
  try { await fetchClientDetail(id); return null; } catch (err: any) { return err?.message ?? 'Could not open the client.'; }
}
