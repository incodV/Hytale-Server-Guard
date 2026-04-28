import { jsonResponse, listReports, publicReport } from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "GET") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const reports = await listReports();
    return jsonResponse({
        ok: true,
        reports: reports.filter((report) => report.status === "Aprovado").map(publicReport)
    });
};
