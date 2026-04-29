import {
    deleteReportById,
    getReport,
    jsonResponse,
    readJsonBody,
    requireAdminSession,
    sanitize
} from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    if (!(await requireAdminSession(request))) {
        return jsonResponse({ error: "Nao autorizado." }, 401);
    }

    const body = await readJsonBody(request);
    const id = sanitize(body?.id);

    if (!id) {
        return jsonResponse({ error: "Informe o id da denuncia." }, 400);
    }

    const report = await getReport(id);
    if (!report) {
        return jsonResponse({ error: "Denuncia nao encontrada." }, 404);
    }

    await deleteReportById(id);
    return jsonResponse({ ok: true });
};
