import {
    createId,
    deletePartnerServerById,
    isAdminAuthorized,
    jsonResponse,
    listPartnerServers,
    readJsonBody,
    sanitize,
    savePartnerServer
} from "./_shared/backend.mjs";

export default async (request) => {
    if (!isAdminAuthorized(request)) {
        return jsonResponse({ error: "Não autorizado." }, 401);
    }

    if (request.method === "GET") {
        return jsonResponse({ ok: true, partners: await listPartnerServers() });
    }

    if (request.method === "POST") {
        const body = await readJsonBody(request);
        const name = sanitize(body?.name);
        const region = sanitize(body?.region);
        const status = sanitize(body?.status) || "Ativo";
        const note = sanitize(body?.note);

        if (!name || !region) {
            return jsonResponse({ error: "Informe nome e região do servidor parceiro." }, 400);
        }

        const partner = {
            id: sanitize(body?.id) || createId("partner"),
            name,
            region,
            status,
            note,
            createdAt: sanitize(body?.createdAt) || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await savePartnerServer(partner);
        return jsonResponse({ ok: true, partner });
    }

    if (request.method === "DELETE") {
        const body = await readJsonBody(request);
        const id = sanitize(body?.id);

        if (!id) {
            return jsonResponse({ error: "Informe o id do parceiro." }, 400);
        }

        await deletePartnerServerById(id);
        return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Method Not Allowed" }, 405);
};
