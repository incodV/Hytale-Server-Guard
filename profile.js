const PROFILE_STORAGE_KEY = "hytaleguard_user_session";
const PROFILE_API = {
    reportsMine: "/api/reports/mine"
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
                <h2>Nenhuma sessão ativa</h2>
                <p>Entre na sua conta pela página inicial para acessar seu perfil, histórico e atalhos da sua conta.</p>
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

    const myReports = reportsResponse?.ok && Array.isArray(reportsResponse.reports)
        ? reportsResponse.reports
        : [];

    const pending = myReports.filter((report) => report.status === "Em análise").length;
    const approved = myReports.filter((report) => report.status === "Aprovado").length;
    const rejected = myReports.filter((report) => report.status === "Rejeitado").length;

    shell.innerHTML = `
        <section class="profile-grid">
            <article class="profile-surface profile-card-main">
                <div class="profile-banner"></div>
                <div class="profile-card-body">
                    <div class="profile-avatar-wrap">
                        <span class="profile-avatar-fallback">${escapeHtml(getInitials(profileUser.name))}</span>
                    </div>

                    <div class="profile-head-copy">
                        <p class="section-kicker">Sessão ativa</p>
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
                            <span>Servidor vinculado</span>
                            <strong>${escapeHtml(profileUser.serverName || "Nenhum")}</strong>
                        </div>
                    </div>

                    <div class="profile-actions-row">
                        <a href="index.html#denuncias" class="btn-primary">Ver Base Pública</a>
                        <a href="index.html#minha-conta" class="btn-secondary">Voltar à Conta</a>
                    </div>
                </div>
            </article>

            <article class="profile-surface profile-stats-card">
                <p class="section-kicker">Resumo</p>
                <h3>Minhas Denúncias</h3>
                <div class="profile-stats-grid">
                    <div class="profile-stat-box">
                        <strong>${myReports.length}</strong>
                        <span>Total</span>
                    </div>
                    <div class="profile-stat-box">
                        <strong>${pending}</strong>
                        <span>Em análise</span>
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

        <section class="profile-surface profile-reports-panel">
            <div class="profile-panel-head">
                <div>
                    <p class="section-kicker">Histórico</p>
                    <h3>Últimos envios da conta</h3>
                </div>
                <span class="profile-panel-note">${myReports.length} registro(s) encontrado(s)</span>
            </div>
            <div class="profile-report-list">
                ${buildReportsMarkup(myReports)}
            </div>
        </section>
    `;
}

function buildReportsMarkup(reports) {
    if (reports.length === 0) {
        return `
            <article class="profile-report-item profile-report-empty">
                <strong>Nenhuma denúncia enviada ainda</strong>
                <p>Assim que você registrar um caso, ele aparecerá aqui com data, servidor e status.</p>
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

function logoutProfileUser() {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    profileUser = null;
    profileToken = "";
    window.location.href = "index.html";
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

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
