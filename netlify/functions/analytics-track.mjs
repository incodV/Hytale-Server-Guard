import { jsonResponse, readJsonBody, recordVisit, sanitize } from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const body = await readJsonBody(request);
    const page = sanitize(body?.page) || "public";
    const entry = await recordVisit(page);

    return jsonResponse({
        ok: true,
        visit: entry
    });
};
