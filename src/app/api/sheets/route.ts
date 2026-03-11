import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetData } from '@/lib/sheets';

// In-memory cache — survives between requests on the same server instance
let cache: { data: Awaited<ReturnType<typeof fetchSheetData>>; ts: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('refresh') === 'true';

  // Serve from cache if fresh
  if (!force && cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(cache.data, {
      headers: {
        'X-Cache': 'HIT',
        'X-Cache-Age': String(Math.round((Date.now() - cache.ts) / 1000)),
      },
    });
  }

  try {
    const data = await fetchSheetData();
    cache = { data, ts: Date.now() };
    return NextResponse.json(data, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
