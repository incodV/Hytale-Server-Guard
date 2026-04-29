import {
    getUserFromToken,
    jsonResponse,
    publicUser,
    readJsonBody,
    sanitize,
    saveUser
} from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const user = await getUserFromToken(request);
    if (!user) {
        return jsonResponse({ error: "Sessao invalida." }, 401);
    }

    const body = await readJsonBody(request);
    if (!body) {
        return jsonResponse({ error: "JSON invalido." }, 400);
    }

    const hytaleNickname = sanitize(body.hytaleNickname);
    const serverName = sanitize(body.serverName);

    if (!hytaleNickname) {
        return jsonResponse({ error: "Informe seu nick do Hytale." }, 400);
    }

    user.hytaleNickname = hytaleNickname;
    if (serverName) {
        user.serverName = serverName;
    }
    user.updatedAt = new Date().toISOString();
    await saveUser(user);

    return jsonResponse({
        ok: true,
        user: publicUser(user)
    });
};
