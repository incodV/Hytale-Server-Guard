import { getUserFromToken, jsonResponse, listReports } from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "GET") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const user = await getUserFromToken(request);
    if (!user) {
        return jsonResponse({ error: "Sessão inválida." }, 401);
    }

    const reports = await listReports();
    const mine = reports.filter((report) => report.reporterId === user.id);

    return jsonResponse({
        ok: true,
        reports: mine
    });
};
