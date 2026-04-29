import {
    buildAdminSessionCookie,
    createAdminSession,
    hasConfiguredAdminCredentials,
    jsonResponse,
    readJsonBody,
    sanitize,
    verifyAdminCredentials
} from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    if (!hasConfiguredAdminCredentials()) {
        return jsonResponse({ error: "Acesso administrativo indisponivel." }, 503);
    }

    const body = await readJsonBody(request);
    if (!body) {
        return jsonResponse({ error: "JSON invalido." }, 400);
    }

    const username = sanitize(body.username);
    const password = sanitize(body.password);

    if (!username || !password) {
        return jsonResponse({ error: "Informe usuario e senha." }, 400);
    }

    if (!verifyAdminCredentials(username, password)) {
        return jsonResponse({ error: "Credenciais de administrador invalidas." }, 401);
    }

    const session = await createAdminSession();
    return new Response(JSON.stringify({
        ok: true,
        session: {
            username: session.username,
            expiresAt: session.expiresAt
        }
    }), {
        status: 200,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "set-cookie": buildAdminSessionCookie(session.token)
        }
    });
};
