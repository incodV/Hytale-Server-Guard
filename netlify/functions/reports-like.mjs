import {
    getReport,
    getUserFromToken,
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

    const user = await getUserFromToken(request);
    if (!user) {
        return jsonResponse({ error: "Faca login para apoiar um caso." }, 401);
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

    const likedByUserIds = Array.isArray(report.likedByUserIds) ? report.likedByUserIds : [];
    const alreadyLiked = likedByUserIds.includes(user.id);

    if (!alreadyLiked) {
        likedByUserIds.push(user.id);
        report.likedByUserIds = likedByUserIds;
        report.likesCount = likedByUserIds.length;
        report.updatedAt = new Date().toISOString();
        await saveReport(report);
    }

    return jsonResponse({
        ok: true,
        alreadyLiked,
        report: publicReport(report)
    });
};
