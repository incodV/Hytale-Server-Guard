import {
    jsonResponse,
    isAdminAuthorized,
    listReports,
    listUsers,
    publicUser
} from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "GET") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    if (!isAdminAuthorized(request)) {
        return jsonResponse({ error: "Não autorizado." }, 401);
    }

    const [users, reports] = await Promise.all([listUsers(), listReports()]);
    const reportCounts = reports.reduce((accumulator, report) => {
        const key = report.reporterId || report.reporterEmail || report.discord;
        accumulator.set(key, Number(accumulator.get(key) || 0) + 1);
        return accumulator;
    }, new Map());

    return jsonResponse({
        ok: true,
        users: users.map((user) => ({
            ...publicUser(user),
            reportsCreated: Number(reportCounts.get(user.id) || reportCounts.get(user.email) || 0)
        }))
    });
};
