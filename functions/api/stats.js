/**
 * GET /api/stats?category=all|general|...
 *
 * 전체 응시 통계 반환.
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.SCORES) {
    return new Response(JSON.stringify({ error: 'KV namespace not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const category = url.searchParams.get('category') || 'all';
  const key = `aggregate:${category}`;
  const agg = (await env.SCORES.get(key, 'json')) || { total: 0, sum: 0, max: 0, scores: [] };

  return new Response(
    JSON.stringify({
      category,
      total: agg.total,
      sum: agg.sum,
      max: agg.max,
      // scores 원본은 반환 안 함 (개인정보 보호 차원에서 통계만)
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30',
      },
    }
  );
}
