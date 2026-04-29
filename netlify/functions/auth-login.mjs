import {
    createToken,
    findUserByEmail,
    jsonResponse,
    normalizeEmail,
    publicUser,
    readJsonBody,
    sanitize,
    saveUser,
    verifyPassword
} from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const body = await readJsonBody(request);
    if (!body) {
        return jsonResponse({ error: "JSON inválido." }, 400);
    }

    const email = normalizeEmail(body.email);
    const password = sanitize(body.password);

    if (!email || !password) {
        return jsonResponse({ error: "Email e senha são obrigatórios." }, 400);
    }

    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
        return jsonResponse({ error: "Credenciais inválidas." }, 401);
    }

    user.sessionToken = createToken();
    user.sessionUpdatedAt = new Date().toISOString();
    await saveUser(user);

    return jsonResponse({
        ok: true,
        token: user.sessionToken,
        user: publicUser(user)
    });
};
