import {
    clearAdminSessionCookie,
    destroyAdminSession,
    jsonResponse
} from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    await destroyAdminSession(request);
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "set-cookie": clearAdminSessionCookie()
        }
    });
};
