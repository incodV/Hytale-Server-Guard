import {
    createId,
    createToken,
    hashPassword,
    jsonResponse,
    normalizeEmail,
    normalizeRole,
    publicUser,
    readJsonBody,
    sanitize,
    findUserByEmail,
    saveUser
} from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const body = await readJsonBody(request);
    if (!body) {
        return jsonResponse({ error: "JSON inválido." }, 400);
    }

    const name = sanitize(body.name);
    const email = normalizeEmail(body.email);
    const password = sanitize(body.password);
    const role = normalizeRole(body.role);
    const serverName = sanitize(body.serverName);

    if (!name || !email || !password) {
        return jsonResponse({ error: "Nome, email e senha são obrigatórios." }, 400);
    }

    if (password.length < 6) {
        return jsonResponse({ error: "Use uma senha com pelo menos 6 caracteres." }, 400);
    }

    if (role === "owner" && !serverName) {
        return jsonResponse({ error: "Informe o nome do servidor para contas de dono." }, 400);
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
        return jsonResponse({ error: "Já existe uma conta cadastrada com este email." }, 409);
    }

    const { salt, hash } = hashPassword(password);
    const sessionToken = createToken();
    const user = {
        id: createId("user"),
        name,
        email,
        role,
        serverName,
        passwordSalt: salt,
        passwordHash: hash,
        sessionToken,
        createdAt: new Date().toISOString()
    };

    await saveUser(user);

    return jsonResponse({
        ok: true,
        token: sessionToken,
        user: publicUser(user)
    });
};
