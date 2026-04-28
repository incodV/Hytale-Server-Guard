import {
    createId,
    getUserFromToken,
    jsonResponse,
    readJsonBody,
    sanitize,
    saveReport
} from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const user = await getUserFromToken(request);
    if (!user) {
        return jsonResponse({ error: "Faça login para enviar denúncias." }, 401);
    }

    const body = await readJsonBody(request);
    if (!body) {
        return jsonResponse({ error: "JSON inválido." }, 400);
    }

    const playerName = sanitize(body.playerName);
    const uuid = sanitize(body.uuid) || "N/A";
    const discord = sanitize(body.discord);
    const server = sanitize(body.server);
    const reason = sanitize(body.reason);
    const proofLinks = normalizeProofLinks(body.proofLinks);
    const avatarUrl = sanitize(body.avatarUrl);
    const gotaleLookup = sanitize(body.gotaleLookup);

    if (!playerName || !discord || !server || !reason || proofLinks.length === 0) {
        return jsonResponse({ error: "Campos obrigatórios ausentes." }, 400);
    }

    const report = {
        id: createId("report"),
        playerName,
        uuid,
        discord,
        server,
        reason,
        proofLinks,
        status: "Em análise",
        createdAt: new Date().toISOString(),
        avatarUrl,
        gotaleLookup,
        reporterId: user.id,
        reporterName: user.name,
        reporterEmail: user.email,
        reporterRole: user.role,
        reporterServerName: user.serverName || ""
    };

    await saveReport(report);

    return jsonResponse({
        ok: true,
        report
    });
};

function normalizeProofLinks(value) {
    if (Array.isArray(value)) {
        return value.map((item) => sanitize(item)).filter(Boolean);
    }

    return String(value || "")
        .split(/\r?\n|,/)
        .map((item) => sanitize(item))
        .filter(Boolean);
}
