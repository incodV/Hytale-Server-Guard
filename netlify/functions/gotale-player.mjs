const GOTALE_BASE_URL = "https://gotale.net";

export default async (request) => {
    if (request.method !== "GET") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const apiKey = process.env.GOTALE_API_KEY;
    if (!apiKey) {
        return jsonResponse({ error: "GOTALE_API_KEY não configurada no ambiente do Netlify Functions." }, 500);
    }

    const url = new URL(request.url);
    const player = sanitizeIdentifier(url.searchParams.get("player"));
    const uuid = sanitizeIdentifier(url.searchParams.get("uuid"));
    const identifier = uuid || player;

    if (!identifier) {
        return jsonResponse({ error: "Informe o parâmetro player ou uuid." }, 400);
    }

    try {
        const profileResponse = await fetch(`${GOTALE_BASE_URL}/api/avatar/${encodeURIComponent(identifier)}/profile`, {
            headers: {
                "X-API-Key": apiKey,
                "Accept": "application/json"
            }
        });

        if (!profileResponse.ok) {
            const errorText = await profileResponse.text();
            return jsonResponse(
                {
                    error: "Falha ao consultar o perfil na Gotale.",
                    upstreamStatus: profileResponse.status,
                    details: errorText.slice(0, 300)
                },
                profileResponse.status
            );
        }

        const rawProfile = await profileResponse.json();
        const profile = normalizeProfile(rawProfile, identifier);
        const avatarUrl = `/api/gotale/avatar?player=${encodeURIComponent(profile.lookup)}`;

        return jsonResponse({
            ok: true,
            player: profile.player,
            uuid: profile.uuid,
            lookup: profile.lookup,
            avatarUrl,
            profile
        });
    } catch (error) {
        return jsonResponse(
            {
                error: "Erro inesperado ao consultar a Gotale.",
                details: error.message
            },
            502
        );
    }
};

function normalizeProfile(rawProfile, identifier) {
    const player = pickFirstString([
        rawProfile?.username,
        rawProfile?.name,
        rawProfile?.player?.username,
        rawProfile?.player?.name,
        identifier
    ]);

    const uuid = pickFirstString([
        rawProfile?.id,
        rawProfile?.uuid,
        rawProfile?.player?.id,
        rawProfile?.player?.uuid,
        ""
    ]);

    return {
        player,
        uuid,
        lookup: uuid || player,
        raw: rawProfile
    };
}

function pickFirstString(values) {
    return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function sanitizeIdentifier(value) {
    return String(value || "").trim();
}

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=300"
        }
    });
}
