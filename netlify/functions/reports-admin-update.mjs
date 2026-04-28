import {
    getReport,
    isAdminAuthorized,
    jsonResponse,
    readJsonBody,
    sanitize,
    saveReport
} from "./_shared/backend.mjs";
import { notifyApprovedCase, notifyCaseStatusChange } from "./_shared/discord.mjs";

export default async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    if (!isAdminAuthorized(request)) {
        return jsonResponse({ error: "Não autorizado." }, 401);
    }

    const body = await readJsonBody(request);
    const id = sanitize(body?.id);
    const status = sanitize(body?.status);

    if (!id || !status) {
        return jsonResponse({ error: "Informe id e status." }, 400);
    }

    const report = await getReport(id);
    if (!report) {
        return jsonResponse({ error: "Denúncia não encontrada." }, 404);
    }

    const previousStatus = report.status;
    report.status = status;
    report.updatedAt = new Date().toISOString();
    await saveReport(report);

    if (previousStatus !== status) {
        await notifyCaseStatusChange({
            request,
            report,
            previousStatus
        });

        if (status === "Aprovado") {
            await notifyApprovedCase({
                request,
                report
            });
        }
    }

    return jsonResponse({ ok: true, report });
};
