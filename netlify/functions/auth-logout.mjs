import {
    clearUserSession,
    getUserFromToken,
    jsonResponse
} from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const user = await getUserFromToken(request);
    if (user) {
        await clearUserSession(user);
    }

    return jsonResponse({ ok: true });
};
