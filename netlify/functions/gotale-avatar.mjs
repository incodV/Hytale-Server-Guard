const GOTALE_BASE_URL = "https://gotale.net";

export default async (request) => {
    if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    const apiKey = process.env.GOTALE_API_KEY;
    if (!apiKey) {
        return new Response("GOTALE_API_KEY não configurada.", { status: 500 });
    }

    const url = new URL(request.url);
    const player = String(url.searchParams.get("player") || "").trim();

    if (!player) {
        return new Response("Informe o parâmetro player.", { status: 400 });
    }

    try {
        const avatarResponse = await fetch(`${GOTALE_BASE_URL}/api/avatar/${encodeURIComponent(player)}`, {
            headers: {
                "X-API-Key": apiKey
            }
        });

        if (!avatarResponse.ok) {
            const text = await avatarResponse.text();
            return new Response(text || "Falha ao carregar avatar.", {
                status: avatarResponse.status,
                headers: {
                    "content-type": avatarResponse.headers.get("content-type") || "text/plain; charset=utf-8"
                }
            });
        }

        const contentType = avatarResponse.headers.get("content-type") || "image/png";
        const arrayBuffer = await avatarResponse.arrayBuffer();

        return new Response(arrayBuffer, {
            status: 200,
            headers: {
                "content-type": contentType,
                "cache-control": "public, max-age=86400"
            }
        });
    } catch (error) {
        return new Response(`Erro ao buscar avatar: ${error.message}`, { status: 502 });
    }
};
