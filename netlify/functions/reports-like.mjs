import {
    getReport,
    jsonResponse,
    publicReport,
    readJsonBody,
    sanitize,
    saveReport
} from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const body = await readJsonBody(request);
    const id = sanitize(body?.id);

    if (!id) {
        return jsonResponse({ error: "Informe o id da denúncia." }, 400);
    }

    const report = await getReport(id);
    if (!report) {
        return jsonResponse({ error: "Denúncia não encontrada." }, 404);
    }

    report.likesCount = Number(report.likesCount || 0) + 1;
    report.updatedAt = new Date().toISOString();
    await saveReport(report);

    return jsonResponse({
        ok: true,
        report: publicReport(report)
    });
};
