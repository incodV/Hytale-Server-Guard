import { jsonResponse, listReports, requireAdminSession } from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "GET") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    if (!(await requireAdminSession(request))) {
        return jsonResponse({ error: "Nao autorizado." }, 401);
    }

    return jsonResponse({
        ok: true,
        reports: await listReports()
    });
};
