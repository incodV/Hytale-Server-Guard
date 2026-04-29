const PROFILE_STORAGE_KEY = "hytaleguard_user_session";
const PROFILE_API = {
    reportsMine: "/api/reports/mine",
    logout: "/api/auth/logout",
    update: "/api/profile/update"
};

let profileUser = null;
let profileToken = "";

document.addEventListener("DOMContentLoaded", async () => {
    loadProfileSession();
    bindProfileEvents();
    await renderProfilePage();
});

function loadProfileSession() {
    try {
        const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "null");
        profileUser = stored?.user || null;
        profileToken = stored?.token || "";
    } catch (error) {
        profileUser = null;
        profileToken = "";
    }
}

function bindProfileEvents() {
    const logoutBtn = document.getElementById("profileLogoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", logoutProfileUser);
    }
}

async function renderProfilePage() {
    const shell = document.getElementById("profileShell");
    const logoutBtn = document.getElementById("profileLogoutBtn");
    if (!shell) {
        return;
    }

    if (!profileUser || !profileToken) {
        if (logoutBtn) {
            logoutBtn.hidden = true;
        }

        shell.innerHTML = `
            <article class="profile-surface profile-guest-state">
                <h2>Nenhuma sessao ativa</h2>
                <p>Entre na sua conta pela pagina inicial para acessar seu perfil, avatar e historico.</p>
                <div class="profile-actions-row">
                    <a href="index.html" class="btn-primary">Ir para a Home</a>
                </div>
            </article>
        `;
        return;
    }

    if (logoutBtn) {
        logoutBtn.hidden = false;
    }

    const reportsResponse = await safeFetchJson(PROFILE_API.reportsMine, {
        headers: authHeaders()
    });

    if (reportsResponse && !reportsResponse.ok) {
        localStorage.removeItem(PROFILE_STORAGE_KEY);
        profileUser = null;
        profileToken = "";
        await renderProfilePage();
        return;
    }

    const myReports = reportsResponse?.ok && Array.isArray(reportsResponse.reports)
        ? reportsResponse.reports
        : [];

    const pending = myReports.filter((report) => report.status === "Em análise").length;
    const approved = myReports.filter((report) => report.status === "Aprovado").length;
    const rejected = myReports.filter((report) => report.status === "Rejeitado").length;
    const avatarMarkup = buildProfileAvatar(profileUser);
    const hasNickname = Boolean(profileUser.hytaleNickname);

    shell.innerHTML = `
        <section class="profile-grid">
            <article class="profile-surface profile-card-main">
                <div class="profile-banner"></div>
                <div class="profile-card-body">
                    <div class="profile-avatar-wrap">
                        ${avatarMarkup}
                    </div>

                    <div class="profile-head-copy">
                        <p class="section-kicker">Sessao ativa</p>
                        <h2>${escapeHtml(profileUser.name)}</h2>
                        <p class="profile-subtitle">${escapeHtml(profileUser.role === "owner" ? "Dono de servidor" : "Jogador")}${profileUser.serverName ? ` • ${escapeHtml(profileUser.serverName)}` : ""}</p>
                    </div>

                    <div class="profile-meta-grid">
                        <div class="profile-meta-card">
                            <span>Email</span>
                            <strong>${escapeHtml(profileUser.email)}</strong>
                        </div>
                        <div class="profile-meta-card">
                            <span>Conta criada</span>
                            <strong>${formatDate(profileUser.createdAt)}</strong>
                        </div>
                        <div class="profile-meta-card">
                            <span>Nick do Hytale</span>
                            <strong>${escapeHtml(profileUser.hytaleNickname || "Nao informado")}</strong>
                        </div>
                    </div>

                    <div class="profile-actions-row">
                        <a href="index.html#denuncias" class="btn-primary">Ver Base Publica</a>
                        <a href="index.html#minha-conta" class="btn-secondary">Voltar ao Site</a>
                    </div>
                </div>
            </article>

            <article class="profile-surface profile-stats-card">
                <p class="section-kicker">Resumo</p>
                <h3>Minha Conta</h3>
                <div class="profile-stats-grid">
                    <div class="profile-stat-box">
                        <strong>${myReports.length}</strong>
                        <span>Total</span>
                    </div>
                    <div class="profile-stat-box">
                        <strong>${pending}</strong>
                        <span>Em analise</span>
                    </div>
                    <div class="profile-stat-box">
                        <strong>${approved}</strong>
                        <span>Aprovadas</span>
                    </div>
                    <div class="profile-stat-box">
                        <strong>${rejected}</strong>
                        <span>Rejeitadas</span>
                    </div>
                </div>
            </article>
        </section>

        <section class="profile-surface profile-identity-panel">
            <div class="profile-panel-head">
                <div>
                    <p class="section-kicker">Identidade Hytale</p>
                    <h3>${hasNickname ? "Atualize seu nick e avatar" : "Informe seu nick para ativar o avatar"}</h3>
                </div>
                <span class="profile-panel-note">Usamos esse nick para puxar o avatar do jogador no seu perfil.</span>
            </div>

            <form id="profileIdentityForm" class="profile-identity-form">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="profileHytaleNickname">Nick do Hytale</label>
                        <input id="profileHytaleNickname" type="text" name="hytaleNickname" value="${escapeAttribute(profileUser.hytaleNickname || "")}" placeholder="Seu nick do Hytale">
                    </div>
                    <div class="form-group">
                        <label for="profileServerName">Servidor vinculado</label>
                        <input id="profileServerName" type="text" name="serverName" value="${escapeAttribute(profileUser.serverName || "")}" placeholder="Opcional">
                    </div>
                </div>
                <p class="form-feedback" id="profileIdentityFeedback" hidden></p>
                <button type="submit" class="btn-primary">Salvar identidade</button>
            </form>
        </section>

        <section class="profile-surface profile-reports-panel">
            <div class="profile-panel-head">
                <div>
                    <p class="section-kicker">Historico</p>
                    <h3>Ultimos envios da conta</h3>
                </div>
                <span class="profile-panel-note">${myReports.length} registro(s) encontrado(s)</span>
            </div>
            <div class="profile-report-list">
                ${buildReportsMarkup(myReports)}
            </div>
        </section>
    `;

    bindProfileIdentityForm();
}

function bindProfileIdentityForm() {
    const form = document.getElementById("profileIdentityForm");
    if (!form) {
        return;
    }

    form.addEventListener("submit", handleProfileIdentitySubmit);
}

async function handleProfileIdentitySubmit(event) {
    event.preventDefault();

    const form = event.target;
    const feedback = document.getElementById("profileIdentityFeedback");
    const formData = new FormData(form);
    const payload = {
        hytaleNickname: String(formData.get("hytaleNickname") || "").trim(),
        serverName: String(formData.get("serverName") || "").trim()
    };

    if (!payload.hytaleNickname) {
        showFeedback(feedback, "Informe seu nick do Hytale para ativar o avatar.", "error");
        return;
    }

    const response = await safeFetchJson(PROFILE_API.update, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...authHeaders()
        },
        body: JSON.stringify(payload)
    });

    if (!response?.ok || !response.user) {
        showFeedback(feedback, response?.error || "Nao foi possivel atualizar seu perfil agora.", "error");
        return;
    }

    profileUser = response.user;
    persistProfileSession();
    showFeedback(feedback, "Identidade do Hytale atualizada com sucesso.", "success");
    await renderProfilePage();
}

function buildReportsMarkup(reports) {
    if (reports.length === 0) {
        return `
            <article class="profile-report-item profile-report-empty">
                <strong>Nenhuma denuncia enviada ainda</strong>
                <p>Assim que voce registrar um caso, ele aparecera aqui com data, servidor e status.</p>
            </article>
        `;
    }

    return reports.map((report) => `
        <article class="profile-report-item">
            <div>
                <strong>${escapeHtml(report.playerName)}</strong>
                <p>${escapeHtml(report.server)}</p>
            </div>
            <div class="profile-report-meta">
                <span class="status-badge ${getStatusClass(report.status)}">${escapeHtml(report.status)}</span>
                <small>${formatDate(report.createdAt)}</small>
            </div>
        </article>
    `).join("");
}

function buildProfileAvatar(user) {
    if (user?.hytaleNickname) {
        const avatarUrl = `/api/gotale/avatar?player=${encodeURIComponent(user.hytaleNickname)}`;
        return `<img class="profile-avatar-image" src="${avatarUrl}" alt="Avatar de ${escapeAttribute(user.hytaleNickname)}" loading="lazy">`;
    }

    return `<span class="profile-avatar-fallback">${escapeHtml(getInitials(user?.name))}</span>`;
}

async function logoutProfileUser() {
    if (profileToken) {
        await safeFetchJson(PROFILE_API.logout, {
            method: "POST",
            headers: authHeaders()
        });
    }

    localStorage.removeItem(PROFILE_STORAGE_KEY);
    profileUser = null;
    profileToken = "";
    window.location.href = "index.html";
}

function persistProfileSession() {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
        token: profileToken,
        user: profileUser
    }));
}

function authHeaders() {
    return profileToken ? { authorization: `Bearer ${profileToken}` } : {};
}

async function safeFetchJson(url, options = {}) {
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        return response.ok ? data : { ok: false, ...data };
    } catch (error) {
        return null;
    }
}

function getInitials(value) {
    const parts = String(value || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.length ? parts.map((part) => part[0].toUpperCase()).join("") : "HG";
}

function getStatusClass(status) {
    if (status === "Aprovado") {
        return "status-aprovado";
    }
    if (status === "Rejeitado") {
        return "status-rejeitado";
    }
    return "status-analise";
}

function formatDate(value) {
    return new Date(value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function showFeedback(element, message, type) {
    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = `form-feedback ${type}`;
    element.hidden = false;
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
}
