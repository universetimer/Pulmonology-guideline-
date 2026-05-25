/**
 * POST /api/submit
 *
 * 시험 점수를 KV에 저장하고, 백분위 계산 결과를 반환한다.
 *
 * Body:
 *   { category: "all" | "general" | ..., score: 0~10, total: 10,
 *     elapsedSec: number, breakdown: {catId: {correct, total}}, timestamp }
 *
 * KV namespace binding 이름: SCORES
 * 저장 키:
 *   - aggregate:{category}  = { total, sum, max, scores: [...최근 500개] }
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SCORES) {
    return new Response(JSON.stringify({ error: 'KV namespace not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { category, score, total } = body;
  if (
    typeof category !== 'string' ||
    typeof score !== 'number' ||
    typeof total !== 'number' ||
    score < 0 ||
    score > total ||
    total > 50
  ) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 정규화 (10점 만점 환산)
  const score10 = Math.round((score / total) * 10);

  // 키 (전체 + 분야별)
  const keys = ['aggregate:all'];
  if (category !== 'all') keys.push(`aggregate:${category}`);

  let myCategoryAgg = null;
  for (const key of keys) {
    const cur = (await env.SCORES.get(key, 'json')) || { total: 0, sum: 0, max: 0, scores: [] };
    cur.total += 1;
    cur.sum += score10;
    cur.max = Math.max(cur.max, score10);
    cur.scores.push(score10);
    if (cur.scores.length > 500) cur.scores = cur.scores.slice(-500);
    await env.SCORES.put(key, JSON.stringify(cur));
    if (key === `aggregate:${category}` || (category === 'all' && key === 'aggregate:all')) {
      myCategoryAgg = cur;
    }
  }

  // 백분위 계산 (저장된 최근 500개 기준)
  const agg = myCategoryAgg || (await env.SCORES.get('aggregate:all', 'json'));
  const lower = agg.scores.filter(s => s < score10).length;
  const equal = agg.scores.filter(s => s === score10).length;

  return new Response(
    JSON.stringify({
      total: agg.total,
      sum: agg.sum,
      max: agg.max,
      lower,
      equal,
      myScore: score10,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    }
  );
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
