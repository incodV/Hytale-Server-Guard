import { jsonResponse, requireAdminSession } from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "GET") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const session = await requireAdminSession(request);
    if (!session) {
        return jsonResponse({ ok: false, authenticated: false }, 401);
    }

    return jsonResponse({
        ok: true,
        authenticated: true,
        session: {
            username: session.username,
            expiresAt: session.expiresAt
        }
    });
};
