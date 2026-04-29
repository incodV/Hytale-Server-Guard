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

const INCLUDE_REPORTER_IDENTITY = String(process.env.DISCORD_INCLUDE_REPORTER_IDENTITY || "false").toLowerCase() === "true";

export async function notifyCaseStatusChange({ request, report, previousStatus }) {
    if (!WEBHOOKS.status) {
        return skippedResult("status", "Webhook de status nao configurado.");
    }

    const statusKey = getStatusKey(report.status);
    return executeWebhook("status", WEBHOOKS.status, {
        username: "Hytale Server Guard",
        avatar_url: buildWebhookAvatar(request),
        embeds: [buildBaseEmbed({
            request,
            report,
            title: `${report.playerName} agora esta como ${report.status}`,
            author: "Status de caso atualizado",
            description: shorten(report.reason, 260),
            color: COLORS[statusKey],
            fields: compactFields([
                inlineField("Status anterior", previousStatus || "Nao informado"),
                inlineField("Status atual", report.status),
                inlineField("Servidor", report.server),
                inlineField("UUID", report.uuid || "N/A"),
                includeReporterFields(report, true),
                fullField("Provas", formatProofLinks(report.proofLinks)),
                fullField("Caso", buildCaseMeta(report))
            ]),
            footer: `Caso ${report.id}`,
            timestamp: report.updatedAt || report.createdAt
        })],
        allowed_mentions: {
            parse: []
        }
    });
}

export async function notifyApprovedCase({ request, report }) {
    if (!WEBHOOKS.approved) {
        return skippedResult("approved", "Webhook de aprovados nao configurado.");
    }

    return executeWebhook("approved", WEBHOOKS.approved, {
        username: "Hytale Server Guard",
        avatar_url: buildWebhookAvatar(request),
        embeds: [buildBaseEmbed({
            request,
            report,
            title: report.playerName,
            author: "Caso aprovado na base publica",
            description: shorten(report.reason, 320),
            color: COLORS.approved,
            url: resolvePublicUrl(request),
            fields: compactFields([
                inlineField("Servidor", report.server),
                inlineField("UUID", report.uuid || "N/A"),
                includeReporterFields(report, false),
                fullField("Provas", formatProofLinks(report.proofLinks)),
                fullField("Publicacao", "Registro aprovado pela moderacao e enviado para a base publica.")
            ]),
            footer: "Registro aprovado pela moderacao",
            timestamp: report.updatedAt || report.createdAt
        })],
        allowed_mentions: {
            parse: []
        }
    });
}

export async function notifyRiskAlert({ request, report, reports }) {
    if (!WEBHOOKS.risk) {
        return skippedResult("risk", "Webhook de risco nao configurado.");
    }

    const alert = buildRiskAlert(report, reports);
    if (!alert) {
        return skippedResult("risk", "Nenhum criterio de risco acionado para este caso.");
    }

    return executeWebhook("risk", WEBHOOKS.risk, {
        username: "Hytale Server Guard",
        avatar_url: buildWebhookAvatar(request),
        embeds: [buildBaseEmbed({
            request,
            report,
            title: alert.title,
            author: "Alerta de risco detectado",
            description: alert.description,
            color: COLORS.risk,
            fields: compactFields([
                inlineField("Jogador", report.playerName),
                inlineField("Servidor", report.server),
                inlineField("UUID", report.uuid || "N/A"),
                fullField("Contexto", alert.context),
                fullField("Provas do novo caso", formatProofLinks(report.proofLinks))
            ]),
            footer: `Caso ${report.id} • revisao recomendada`,
            timestamp: report.createdAt
        })],
        allowed_mentions: {
            parse: []
        }
    });
}

async function executeWebhook(kind, url, payload) {
    if (!url) {
        return skippedResult(kind, "URL de webhook ausente.");
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const body = await safeReadText(response);
            console.error(`[discord:${kind}] webhook falhou`, {
                status: response.status,
                body
            });

            return {
                ok: false,
                skipped: false,
                channel: kind,
                status: response.status,
                error: body || `Falha HTTP ${response.status}`
            };
        }

        return {
            ok: true,
            skipped: false,
            channel: kind,
            status: response.status
        };
    } catch (error) {
        console.error(`[discord:${kind}] erro ao enviar webhook`, error?.message || error);
        return {
            ok: false,
            skipped: false,
            channel: kind,
            status: 0,
            error: error?.message || "Erro desconhecido ao enviar webhook."
        };
    }
}

function buildBaseEmbed({ request, report, title, author, description, color, fields, footer, timestamp, url }) {
    return {
        author: {
            name: author,
            url: resolvePublicUrl(request)
        },
        title,
        url,
        color,
        description,
        thumbnail: report.avatarUrl ? { url: absoluteUrl(request, report.avatarUrl) } : undefined,
        fields,
        footer: {
            text: footer
        },
        timestamp
    };
}

function includeReporterFields(report, allowIdentity) {
    if (!allowIdentity || !INCLUDE_REPORTER_IDENTITY) {
        return inlineField("Origem", "Identidade protegida na automacao do Discord");
    }

    return [
        inlineField("Denunciante", report.reporterName || report.discord || "Nao informado"),
        inlineField("Conta", report.reporterRole === "owner" ? `Dono • ${report.reporterServerName || "Sem servidor"}` : "Jogador")
    ];
}

function skippedResult(channel, reason) {
    return {
        ok: true,
        skipped: true,
        channel,
        reason
    };
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
            description: `Esse jogador ja apareceu ${samePlayer.length} vez(es) na base e merece revisao mais rigida.`,
            context: `Servidor atual: ${report.server}\nCasos do mesmo jogador: ${samePlayer.length}\nUltimo registro: ${formatDateTime(report.createdAt)}`
        };
    }

    if (sameServerRecent.length >= 3) {
        return {
            title: `Volume anormal em ${report.server}`,
            description: `${sameServerRecent.length} denuncias foram registradas para esse servidor nas ultimas 24 horas.`,
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
    return absoluteUrl(request, "/logo-sem-fundo.png");
}

function formatProofLinks(proofLinks) {
    const links = normalizeLinks(proofLinks);
    if (links.length === 0) {
        return "Sem links informados.";
    }

    const lines = [];
    let currentLength = 0;

    links.forEach((link, index) => {
        const line = `[Prova ${index + 1}](${link})`;
        if (currentLength + line.length + 1 > 950) {
            return;
        }

        lines.push(line);
        currentLength += line.length + 1;
    });

    if (lines.length < links.length) {
        lines.push(`+ ${links.length - lines.length} link(s) adicional(is)`);
    }

    return lines.join("\n");
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
    return fields.flat().filter(Boolean).slice(0, 25);
}

function inlineField(name, value) {
    return {
        name,
        value: sanitize(value) || "Nao informado",
        inline: true
    };
}

function fullField(name, value) {
    return {
        name,
        value: sanitize(value) || "Nao informado",
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

async function safeReadText(response) {
    try {
        return await response.text();
    } catch (error) {
        return "";
    }
}
