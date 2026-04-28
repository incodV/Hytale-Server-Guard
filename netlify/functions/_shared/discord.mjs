import { sanitize } from "./backend.mjs";

const WEBHOOKS = {
    status: process.env.DISCORD_WEBHOOK_STATUS || "",
    approved: process.env.DISCORD_WEBHOOK_APPROVED || "",
    risk: process.env.DISCORD_WEBHOOK_RISK || ""
};

const COLORS = {
    pending: 0xd5a43b,
    approved: 0x4fb078,
    rejected: 0xd76c5e,
    risk: 0xe08c3f
};

export async function notifyCaseStatusChange({ request, report, previousStatus }) {
    if (!WEBHOOKS.status) {
        return;
    }

    const statusKey = getStatusKey(report.status);
    await executeWebhook(WEBHOOKS.status, {
        username: "Hytale Server Guard",
        avatar_url: buildWebhookAvatar(request),
        embeds: [{
            author: {
                name: "Status de caso atualizado"
            },
            title: `${report.playerName} agora está como ${report.status}`,
            color: COLORS[statusKey],
            description: shorten(report.reason, 260),
            thumbnail: report.avatarUrl ? { url: absoluteUrl(request, report.avatarUrl) } : undefined,
            fields: compactFields([
                inlineField("Status anterior", previousStatus || "Não informado"),
                inlineField("Status atual", report.status),
                inlineField("Servidor", report.server),
                inlineField("UUID", report.uuid || "N/A"),
                inlineField("Denunciante", report.reporterName || report.discord || "Não informado"),
                inlineField("Conta", report.reporterRole === "owner" ? `Dono • ${report.reporterServerName || "Sem servidor"}` : "Jogador"),
                fullField("Provas", formatProofLinks(report.proofLinks)),
                fullField("Caso", buildCaseMeta(report))
            ]),
            footer: {
                text: `Caso ${report.id}`
            },
            timestamp: report.updatedAt || report.createdAt
        }],
        allowed_mentions: {
            parse: []
        }
    });
}

export async function notifyApprovedCase({ request, report }) {
    if (!WEBHOOKS.approved) {
        return;
    }

    await executeWebhook(WEBHOOKS.approved, {
        username: "Hytale Server Guard",
        avatar_url: buildWebhookAvatar(request),
        embeds: [{
            author: {
                name: "Caso aprovado na base pública"
            },
            title: report.playerName,
            url: resolvePublicUrl(request),
            color: COLORS.approved,
            description: shorten(report.reason, 320),
            thumbnail: report.avatarUrl ? { url: absoluteUrl(request, report.avatarUrl) } : undefined,
            fields: compactFields([
                inlineField("Servidor", report.server),
                inlineField("UUID", report.uuid || "N/A"),
                inlineField("Denunciante", report.reporterName || report.discord || "Não informado"),
                fullField("Provas", formatProofLinks(report.proofLinks)),
                fullField("Origem", report.reporterServerName ? `${report.reporterName || "Conta"} • ${report.reporterServerName}` : (report.reporterName || report.discord || "Não informado"))
            ]),
            footer: {
                text: "Registro aprovado pela moderação"
            },
            timestamp: report.updatedAt || report.createdAt
        }],
        allowed_mentions: {
            parse: []
        }
    });
}

export async function notifyRiskAlert({ request, report, reports }) {
    if (!WEBHOOKS.risk) {
        return;
    }

    const alert = buildRiskAlert(report, reports);
    if (!alert) {
        return;
    }

    await executeWebhook(WEBHOOKS.risk, {
        username: "Hytale Server Guard",
        avatar_url: buildWebhookAvatar(request),
        embeds: [{
            author: {
                name: "Alerta de risco detectado"
            },
            title: alert.title,
            color: COLORS.risk,
            description: alert.description,
            thumbnail: report.avatarUrl ? { url: absoluteUrl(request, report.avatarUrl) } : undefined,
            fields: compactFields([
                inlineField("Jogador", report.playerName),
                inlineField("Servidor", report.server),
                inlineField("UUID", report.uuid || "N/A"),
                fullField("Contexto", alert.context),
                fullField("Provas do novo caso", formatProofLinks(report.proofLinks))
            ]),
            footer: {
                text: `Caso ${report.id} • revisão recomendada`
            },
            timestamp: report.createdAt
        }],
        allowed_mentions: {
            parse: []
        }
    });
}

async function executeWebhook(url, payload) {
    if (!url) {
        return;
    }

    try {
        await fetch(url, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error("Discord webhook error:", error.message);
    }
}

function buildRiskAlert(report, reports) {
    const samePlayer = reports.filter((item) =>
        normalize(item.playerName) === normalize(report.playerName) ||
        (report.uuid && report.uuid !== "N/A" && item.uuid === report.uuid)
    );

    const sameServer = reports.filter((item) => normalize(item.server) === normalize(report.server));
    const sameServerRecent = sameServer.filter((item) => withinLastHours(item.createdAt, 24));

    if (samePlayer.length >= 2) {
        return {
            title: `Jogador recorrente: ${report.playerName}`,
            description: `Esse jogador já apareceu ${samePlayer.length} vez(es) na base e merece revisão mais rígida.`,
            context: `Servidor atual: ${report.server}\nCasos do mesmo jogador: ${samePlayer.length}\nÚltimo registro: ${formatDateTime(report.createdAt)}`
        };
    }

    if (sameServerRecent.length >= 3) {
        return {
            title: `Volume anormal em ${report.server}`,
            description: `${sameServerRecent.length} denúncias foram registradas para esse servidor nas últimas 24 horas.`,
            context: `Casos totais do servidor: ${sameServer.length}\nCasos em 24h: ${sameServerRecent.length}\nNovo registro: ${report.playerName}`
        };
    }

    return null;
}

function buildCaseMeta(report) {
    return [
        `ID: ${report.id}`,
        `Criado em: ${formatDateTime(report.createdAt)}`,
        report.updatedAt ? `Atualizado em: ${formatDateTime(report.updatedAt)}` : ""
    ].filter(Boolean).join("\n");
}

function resolvePublicUrl(request) {
    const configured = sanitize(process.env.PUBLIC_SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL);
    if (configured) {
        return configured;
    }

    const current = new URL(request.url);
    return `${current.protocol}//${current.host}/`;
}

function absoluteUrl(request, value) {
    return new URL(value, resolvePublicUrl(request)).toString();
}

function buildWebhookAvatar(request) {
    return absoluteUrl(request, "/logo.png");
}

function formatProofLinks(proofLinks) {
    const links = normalizeLinks(proofLinks).slice(0, 3);
    if (links.length === 0) {
        return "Sem links informados.";
    }

    return links.map((link, index) => `[Prova ${index + 1}](${link})`).join("\n");
}

function normalizeLinks(value) {
    if (Array.isArray(value)) {
        return value.map((item) => sanitize(item)).filter(Boolean);
    }

    return String(value || "")
        .split(/\r?\n|,/)
        .map((item) => sanitize(item))
        .filter(Boolean);
}

function shorten(value, limit) {
    const text = sanitize(value);
    if (text.length <= limit) {
        return text;
    }

    return `${text.slice(0, limit - 1)}…`;
}

function compactFields(fields) {
    return fields.filter(Boolean).slice(0, 25);
}

function inlineField(name, value) {
    return {
        name,
        value: sanitize(value) || "Não informado",
        inline: true
    };
}

function fullField(name, value) {
    return {
        name,
        value: sanitize(value) || "Não informado",
        inline: false
    };
}

function normalize(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function withinLastHours(dateValue, hours) {
    const timestamp = new Date(dateValue).getTime();
    if (!timestamp) {
        return false;
    }

    return Date.now() - timestamp <= hours * 60 * 60 * 1000;
}

function getStatusKey(status) {
    if (status === "Aprovado") {
        return "approved";
    }
    if (status === "Rejeitado") {
        return "rejected";
    }
    return "pending";
}

function formatDateTime(value) {
    return new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}
