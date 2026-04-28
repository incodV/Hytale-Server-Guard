import { isAdminAuthorized, jsonResponse, listReports } from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "GET") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    if (!isAdminAuthorized(request)) {
        return jsonResponse({ error: "Não autorizado." }, 401);
    }

    return jsonResponse({
        ok: true,
        reports: await listReports()
    });
};
