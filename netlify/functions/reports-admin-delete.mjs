import {
    deleteReportById,
    getReport,
    isAdminAuthorized,
    jsonResponse,
    readJsonBody,
    sanitize
} from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    if (!isAdminAuthorized(request)) {
        return jsonResponse({ error: "Não autorizado." }, 401);
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

    await deleteReportById(id);
    return jsonResponse({ ok: true });
};
