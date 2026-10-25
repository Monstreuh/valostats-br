// Função serverless (Vercel). A chave Riot fica aqui, nunca no navegador.
const KEY = process.env.RIOT_API_KEY;
const REGION = "br"; // plataforma Valorant do Brasil
const ACCOUNT_HOST = "https://americas.api.riotgames.com";
const VAL_HOST = `https://${REGION}.api.riotgames.com`;
const NB_PARTIDAS = 10;

async function riot(url) {
  const r = await fetch(url, { headers: { "X-Riot-Token": KEY } });
  if (r.status === 404) throw Object.assign(new Error("nao_encontrado"), { status: 404 });
  if (r.status === 429) throw Object.assign(new Error("limite"), { status: 429 });
  if (r.status === 401 || r.status === 403) throw Object.assign(new Error("chave"), { status: 502 });
  if (!r.ok) throw Object.assign(new Error("riot_" + r.status), { status: 502 });
  return r.json();
}

function analisar(partida, puuid) {
  const eu = partida.players.find((p) => p.puuid === puuid);
  if (!eu) return null;
  const rounds = eu.stats.roundsPlayed || partida.roundResults?.length || 1;
  let head = 0, total = 0;
  for (const rr of partida.roundResults || []) {
    const ps = rr.playerStats?.find((s) => s.puuid === puuid);
    for (const d of ps?.damage || []) {
      head += d.headshots; total += d.headshots + d.bodyshots + d.legshots;
    }
  }
  const time = partida.teams?.find((t) => t.teamId === eu.teamId);
  return {
    id: partida.matchInfo.matchId,
    data: partida.matchInfo.gameStartMillis,
    fila: partida.matchInfo.queueId,
    vitoria: !!time?.won,
    placar: time ? `${time.roundsWon}-${partida.teams.find((t) => t !== time)?.roundsWon ?? "?"}` : null,
    abates: eu.stats.kills, mortes: eu.stats.deaths, assist: eu.stats.assists,
    acs: Math.round(eu.stats.score / rounds),
    hs: total ? Math.round((head / total) * 100) : 0,
  };
}

export default async function handler(req, res) {
  const { nome, tag } = req.query;
  if (!KEY) return res.status(500).json({ erro: "Chave Riot ausente no servidor." });
  if (!nome || !tag) return res.status(400).json({ erro: "Informe nome e tag." });
  try {
    const conta = await riot(
      `${ACCOUNT_HOST}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(nome)}/${encodeURIComponent(tag)}`
    );
    const lista = await riot(`${VAL_HOST}/val/match/v1/matchlists/by-puuid/${conta.puuid}`);
    const ids = (lista.history || []).slice(0, NB_PARTIDAS).map((h) => h.matchId);
    const brutas = await Promise.all(ids.map((id) => riot(`${VAL_HOST}/val/match/v1/matches/${id}`).catch(() => null)));
    const partidas = brutas.filter(Boolean).map((p) => analisar(p, conta.puuid)).filter(Boolean);

    const n = partidas.length || 1;
    const soma = (k) => partidas.reduce((a, p) => a + p[k], 0);
    const resumo = {
      partidas: partidas.length,
      vitorias: partidas.filter((p) => p.vitoria).length,
      kd: +(soma("abates") / Math.max(1, soma("mortes"))).toFixed(2),
      acs: Math.round(soma("acs") / n),
      hs: Math.round(soma("hs") / n),
    };
    // Cache de 5 min na CDN: protege o limite de requisições da Riot
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ jogador: `${conta.gameName}#${conta.tagLine}`, resumo, partidas });
  } catch (e) {
    const msgs = {
      nao_encontrado: "Jogador não encontrado. Confira o nome e a tag.",
      limite: "Muitas buscas agora. Tente de novo em instantes.",
      chave: "Problema de acesso à API da Riot.",
    };
    res.status(e.status || 500).json({ erro: msgs[e.message] || "Erro ao buscar os dados." });
  }
}
