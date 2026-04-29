let adminReports = [];
let adminUsers = [];
let adminPartners = [];
let dashboardData = null;
let adminAuth = null;

const ADMIN_API = {
    reports: "/api/reports/admin",
    update: "/api/reports/admin/update",
    delete: "/api/reports/admin/delete",
    dashboard: "/api/admin/dashboard",
    users: "/api/admin/users",
    partners: "/api/admin/partners",
    analyticsTrack: "/api/analytics/track"
};

document.addEventListener("DOMContentLoaded", () => {
    clearLegacyAdminSession();
    resetAdminShell();
    setupAdminEventListeners();
    trackVisit("admin");
});

window.addEventListener("pageshow", () => {
    if (!adminAuth) {
        resetAdminShell();
    }
});

function clearLegacyAdminSession() {
    try {
        localStorage.removeItem("hytaleguard_admin_auth");
        sessionStorage.removeItem("hytaleguard_admin_auth");
    } catch (error) {
        // no-op
    }
}

function resetAdminShell() {
    const dashboard = document.getElementById("adminDashboard");
    const loginShell = document.getElementById("adminLoginShell");

    if (dashboard) {
        dashboard.hidden = true;
    }

    if (loginShell) {
        loginShell.hidden = false;
    }
}

function setupAdminEventListeners() {
    bindIfExists("adminStandaloneLoginForm", "submit", handleAdminLogin);
    bindIfExists("adminLogoutBtn", "click", logoutAdmin);
    bindIfExists("adminRefreshBtn", "click", refreshDashboardData);
    bindIfExists("partnerForm", "submit", handlePartnerSubmit);

    const tableBody = document.getElementById("adminTableBody");
    if (tableBody) {
        tableBody.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-action]");
            if (!button) {
                return;
            }

            const { action, id } = button.dataset;
            if (action === "view") {
                viewReportDetails(id);
            } else if (action === "approve") {
                updateStatus(id, "Aprovado");
            } else if (action === "reject") {
                updateStatus(id, "Rejeitado");
            } else if (action === "delete") {
                deleteReport(id);
            }
        });
    }

    const partnerList = document.getElementById("partnerList");
    if (partnerList) {
        partnerList.addEventListener("click", async (event) => {
            const button = event.target.closest("button[data-delete-partner]");
            if (!button) {
                return;
            }

            const id = button.dataset.deletePartner;
            if (!id || !window.confirm("Remover este servidor parceiro da lista?")) {
                return;
            }

            const response = await safeFetchJson(ADMIN_API.partners, {
                method: "DELETE",
                headers: {
                    ...jsonHeaders(),
                    ...adminHeaders()
                },
                body: JSON.stringify({ id })
            });

            if (response?.ok) {
                await refreshDashboardData();
            }
        });
    }

    document.querySelectorAll(".admin-side-link").forEach((link) => {
        link.addEventListener("click", () => setActiveSidebarLink(link.getAttribute("href")));
    });

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
        button.addEventListener("click", closeModals);
    });

    document.querySelectorAll(".modal").forEach((modal) => {
        modal.addEventListener("click", (event) => {
            if (event.target === modal) {
                closeModals();
            }
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeModals();
        }
    });

    window.addEventListener("scroll", syncSidebarWithScroll, { passive: true });
}

async function handleAdminLogin(event) {
    event.preventDefault();

    const feedback = document.getElementById("adminStandaloneFeedback");
    const formData = new FormData(event.target);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "").trim();

    if (!username || !password) {
        showFeedback(feedback, "Informe usuário e senha.", "error");
        return;
    }

    adminAuth = { username, password };
    const valid = await validateAdminSession();
    if (!valid) {
        adminAuth = null;
        showFeedback(feedback, "Credenciais de administrador inválidas.", "error");
        return;
    }

    showFeedback(feedback, "Acesso administrativo liberado.", "success");
    await showDashboard();
}

async function validateAdminSession() {
    if (!adminAuth) {
        return false;
    }

    const response = await safeFetchJson(ADMIN_API.reports, {
        headers: adminHeaders()
    });

    if (!response?.ok) {
        return false;
    }

    adminReports = Array.isArray(response.reports) ? response.reports : [];
    return true;
}

async function showDashboard() {
    const loginShell = document.getElementById("adminLoginShell");
    const dashboard = document.getElementById("adminDashboard");

    if (loginShell) {
        loginShell.hidden = true;
    }

    if (dashboard) {
        dashboard.hidden = false;
    }

    await refreshDashboardData();
}

function logoutAdmin() {
    adminAuth = null;
    adminReports = [];
    adminUsers = [];
    adminPartners = [];
    dashboardData = null;
    clearLegacyAdminSession();

    const dashboard = document.getElementById("adminDashboard");
    const loginShell = document.getElementById("adminLoginShell");
    const form = document.getElementById("adminStandaloneLoginForm");
    const feedback = document.getElementById("adminStandaloneFeedback");

    if (dashboard) {
        dashboard.hidden = true;
    }

    if (loginShell) {
        loginShell.hidden = false;
    }

    if (form) {
        form.reset();
    }

    if (feedback) {
        feedback.hidden = true;
        feedback.textContent = "";
        feedback.className = "form-feedback";
    }
}

async function refreshDashboardData() {
    setRefreshLabel("Atualizando dados...");

    const [dashboardResponse, usersResponse, reportsResponse] = await Promise.all([
        safeFetchJson(ADMIN_API.dashboard, { headers: adminHeaders() }),
        safeFetchJson(ADMIN_API.users, { headers: adminHeaders() }),
        safeFetchJson(ADMIN_API.reports, { headers: adminHeaders() })
    ]);

    if (!dashboardResponse?.ok || !usersResponse?.ok || !reportsResponse?.ok) {
        logoutAdmin();
        return;
    }

    dashboardData = dashboardResponse;
    adminUsers = Array.isArray(usersResponse.users) ? usersResponse.users : [];
    adminReports = Array.isArray(reportsResponse.reports) ? reportsResponse.reports : [];
    adminPartners = Array.isArray(dashboardResponse.partners) ? dashboardResponse.partners : [];

    renderDashboard();
    setRefreshLabel(`Atualizado às ${formatTime(new Date())}`);
}

function renderDashboard() {
    renderKpis();
    renderModerationTable();
    renderAccountsTable();
    renderPartnerList();
    renderActivityLists();
    renderServerRisk();
    renderTopReporters();
    renderCharts();
    renderMeta();
}

function renderKpis() {
    const stats = dashboardData?.stats || {};
    setText("kpiVisitsTotal", stats.visitsTotal || 0);
    setText("kpiVisitsSplit", `${stats.publicVisits || 0} públicas / ${stats.adminVisits || 0} admin`);
    setText("kpiPending", stats.reportsPending || 0);
    setText("kpiReportsTotal", `${stats.reportsTotal || 0} denúncias no total`);
    setText("kpiUsersTotal", stats.usersTotal || 0);
    setText("kpiUsersSplit", `${stats.ownersTotal || 0} donos / ${stats.playersTotal || 0} jogadores`);
    setText("kpiPartnersTotal", stats.partnersTotal || 0);
    setText("adminSessionMeta", `Sessão ativa: ${adminAuth?.username || "admin"}`);
    setText("adminWelcomeCopy", `${stats.reportsPending || 0} casos aguardando decisão agora.`);
}

function renderModerationTable() {
    const tableBody = document.getElementById("adminTableBody");
    if (!tableBody) {
        return;
    }

    const sorted = [...adminReports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sorted.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">Nenhuma denúncia cadastrada.</td></tr>';
        return;
    }

    tableBody.innerHTML = sorted.map((report) => `
        <tr>
            <td>
                <div class="report-identity">
                    ${buildAvatarMarkup(report)}
                    <div>
                        <strong>${escapeHtml(report.playerName)}</strong><br>
                        <small>${escapeHtml(report.uuid || "UUID não informado")}</small>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(report.server)}</td>
            <td><span class="status-badge ${getStatusClass(report.status)}">${escapeHtml(report.status)}</span></td>
            <td>${escapeHtml(report.reporterName || report.discord || "Conta não identificada")}</td>
            <td>${formatDate(report.createdAt)}</td>
            <td>
                <div class="admin-table-actions">
                    <button class="btn-view" type="button" data-action="view" data-id="${report.id}">Ver</button>
                    ${report.status !== "Aprovado" ? `<button class="btn-approve" type="button" data-action="approve" data-id="${report.id}">Aprovar</button>` : ""}
                    ${report.status !== "Rejeitado" ? `<button class="btn-reject" type="button" data-action="reject" data-id="${report.id}">Rejeitar</button>` : ""}
                    <button class="btn-delete" type="button" data-action="delete" data-id="${report.id}">Excluir</button>
                </div>
            </td>
        </tr>
    `).join("");
}

function renderAccountsTable() {
    const body = document.getElementById("accountsTableBody");
    if (!body) {
        return;
    }

    if (adminUsers.length === 0) {
        body.innerHTML = '<tr><td colspan="5">Nenhuma conta cadastrada.</td></tr>';
        return;
    }

    body.innerHTML = adminUsers.map((user) => `
        <tr>
            <td>
                <strong>${escapeHtml(user.name)}</strong><br>
                <small>${escapeHtml(user.email)}</small>
            </td>
            <td>${escapeHtml(user.role === "owner" ? "Dono de servidor" : "Jogador")}</td>
            <td>${escapeHtml(user.serverName || "-")}</td>
            <td>${escapeHtml(user.reportsCreated || 0)}</td>
            <td>${formatDate(user.createdAt)}</td>
        </tr>
    `).join("");
}

function renderPartnerList() {
    const list = document.getElementById("partnerList");
    if (!list) {
        return;
    }

    if (adminPartners.length === 0) {
        list.innerHTML = '<p class="admin-empty-state">Nenhum parceiro cadastrado ainda.</p>';
        return;
    }

    list.innerHTML = adminPartners.map((partner) => `
        <article class="admin-partner-card">
            <div>
                <strong>${escapeHtml(partner.name)}</strong>
                <p>${escapeHtml(partner.region)} • ${escapeHtml(partner.status)}</p>
                <small>${escapeHtml(partner.note || "Sem nota interna.")}</small>
            </div>
            <button type="button" class="btn-delete" data-delete-partner="${escapeAttribute(partner.id)}">Remover</button>
        </article>
    `).join("");
}

function renderActivityLists() {
    const recentReports = dashboardData?.moderation?.recentReports || [];
    const recentUsers = dashboardData?.accounts?.recentUsers || [];

    renderSimpleActivity("recentReportsList", recentReports.map((report) => ({
        title: report.playerName,
        body: `${report.server} • ${report.status}`,
        meta: formatDate(report.createdAt)
    })), "Sem denúncias recentes.");

    renderSimpleActivity("recentUsersList", recentUsers.map((user) => ({
        title: user.name,
        body: `${user.role === "owner" ? "Dono de servidor" : "Jogador"}${user.serverName ? ` • ${user.serverName}` : ""}`,
        meta: formatDate(user.createdAt)
    })), "Sem contas recentes.");
}

function renderServerRisk() {
    const list = document.getElementById("serverRiskList");
    if (!list) {
        return;
    }

    const items = dashboardData?.moderation?.flaggedServers || [];
    if (items.length === 0) {
        list.innerHTML = '<p class="admin-empty-state">Ainda não há volume suficiente para formar ranking.</p>';
        return;
    }

    list.innerHTML = items.map((item) => `
        <article class="admin-risk-card">
            <div>
                <strong>${escapeHtml(item.server)}</strong>
                <p>${item.totalCases} caso(s) • ${item.pendingCases} em análise</p>
            </div>
            <span class="risk-pill">${item.approvedCases} aprovados</span>
        </article>
    `).join("");
}

function renderTopReporters() {
    const list = document.getElementById("topReportersList");
    if (!list) {
        return;
    }

    const items = dashboardData?.accounts?.topReporters || [];
    if (items.length === 0) {
        list.innerHTML = '<p class="admin-empty-state">Nenhuma atividade de autoria ainda.</p>';
        return;
    }

    list.innerHTML = items.map((item) => `
        <article class="admin-activity-card">
            <div>
                <strong>${escapeHtml(item.name)}</strong>
                <p>${escapeHtml(item.role === "owner" ? "Dono de servidor" : "Jogador")}</p>
            </div>
            <span class="activity-badge">${item.reportsCreated} envios</span>
        </article>
    `).join("");
}

function renderCharts() {
    renderLineChart("visitsChart", dashboardData?.visitSeries || [], [
        { key: "public", color: "#d5a43b" },
        { key: "admin", color: "#7cc7ff" }
    ]);
    renderBarChart("reportsChart", dashboardData?.reportSeries || []);
}

function renderMeta() {
    setText("moderationMeta", `${adminReports.filter((report) => report.status === "Em análise").length} caso(s) aguardando ação`);
    setText("accountsMeta", `${adminUsers.length} conta(s) cadastrada(s)`);
}

async function handlePartnerSubmit(event) {
    event.preventDefault();
    const feedback = document.getElementById("partnerFeedback");
    const formData = new FormData(event.target);

    const payload = {
        name: String(formData.get("name") || "").trim(),
        region: String(formData.get("region") || "").trim(),
        status: String(formData.get("status") || "").trim(),
        note: String(formData.get("note") || "").trim()
    };

    const response = await safeFetchJson(ADMIN_API.partners, {
        method: "POST",
        headers: {
            ...jsonHeaders(),
            ...adminHeaders()
        },
        body: JSON.stringify(payload)
    });

    if (!response?.ok) {
        showFeedback(feedback, response?.error || "Não foi possível salvar o parceiro.", "error");
        return;
    }

    showFeedback(feedback, "Servidor parceiro salvo com sucesso.", "success");
    event.target.reset();
    await refreshDashboardData();
}

async function updateStatus(id, status) {
    const response = await safeFetchJson(ADMIN_API.update, {
        method: "POST",
        headers: {
            ...jsonHeaders(),
            ...adminHeaders()
        },
        body: JSON.stringify({ id, status })
    });

    if (response?.ok) {
        await refreshDashboardData();
    }
}

async function deleteReport(id) {
    if (!window.confirm("Excluir permanentemente esta denúncia?")) {
        return;
    }

    const response = await safeFetchJson(ADMIN_API.delete, {
        method: "POST",
        headers: {
            ...jsonHeaders(),
            ...adminHeaders()
        },
        body: JSON.stringify({ id })
    });

    if (response?.ok) {
        await refreshDashboardData();
    }
}

function viewReportDetails(id) {
    const report = adminReports.find((item) => item.id === id);
    if (!report) {
        return;
    }

    const detailsContent = document.getElementById("detailsContent");
    if (!detailsContent) {
        return;
    }

    detailsContent.innerHTML = `
        <div class="details-grid">
            <div class="details-hero">
                ${buildAvatarMarkup(report, "details")}
                <div class="details-heading">
                    <p class="section-kicker">Resumo da denúncia</p>
                    <h2>${escapeHtml(report.playerName)}</h2>
                    <p class="modal-intro">Revise provas, origem, status e contexto completo do registro antes de decidir.</p>
                </div>
            </div>

            <dl class="details-summary">
                <div>
                    <dt>Status</dt>
                    <dd><span class="status-badge ${getStatusClass(report.status)}">${escapeHtml(report.status)}</span></dd>
                </div>
                <div>
                    <dt>Data</dt>
                    <dd>${formatDate(report.createdAt)}</dd>
                </div>
                <div>
                    <dt>UUID</dt>
                    <dd>${escapeHtml(report.uuid || "N/A")}</dd>
                </div>
                <div>
                    <dt>Servidor</dt>
                    <dd>${escapeHtml(report.server)}</dd>
                </div>
                <div>
                    <dt>Conta autora</dt>
                    <dd>${escapeHtml(report.reporterName || report.discord)}</dd>
                </div>
                <div>
                    <dt>Tipo da conta</dt>
                    <dd>${escapeHtml(report.reporterRole === "owner" ? "Dono de servidor" : "Jogador")}</dd>
                </div>
                <div>
                    <dt>Servidor da conta</dt>
                    <dd>${escapeHtml(report.reporterServerName || "Não informado")}</dd>
                </div>
                <div>
                    <dt>Provas</dt>
                    <dd>${buildProofLinksList(report.proofLinks)}</dd>
                </div>
            </dl>

            <div class="details-block">
                <p class="section-kicker">Motivo informado</p>
                <p>${escapeHtml(report.reason)}</p>
            </div>
        </div>
    `;

    openModal("detailsModal");
}

function renderLineChart(elementId, data, series) {
    const svg = document.getElementById(elementId);
    if (!svg) {
        return;
    }

    const width = 640;
    const height = 240;
    const padding = { top: 16, right: 20, bottom: 34, left: 28 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const values = data.flatMap((item) => series.map((entry) => Number(item[entry.key] || 0)));
    const maxValue = Math.max(...values, 1);
    const count = Math.max(data.length - 1, 1);

    const axisLines = [0, 0.5, 1].map((ratio) => {
        const y = padding.top + innerHeight * ratio;
        return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid-line"></line>`;
    }).join("");

    const paths = series.map((entry) => {
        const path = data.map((item, index) => {
            const x = padding.left + (innerWidth * index / count);
            const y = padding.top + innerHeight - ((Number(item[entry.key] || 0) / maxValue) * innerHeight);
            return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        }).join(" ");

        const points = data.map((item, index) => {
            const x = padding.left + (innerWidth * index / count);
            const y = padding.top + innerHeight - ((Number(item[entry.key] || 0) / maxValue) * innerHeight);
            return `<circle cx="${x}" cy="${y}" r="3.5" fill="${entry.color}"></circle>`;
        }).join("");

        return `<path d="${path}" fill="none" stroke="${entry.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>${points}`;
    }).join("");

    const labels = data.map((item, index) => {
        const x = padding.left + (innerWidth * index / count);
        return `<text x="${x}" y="${height - 10}" text-anchor="middle" class="chart-axis-label">${formatShortDate(item.date)}</text>`;
    }).join("");

    svg.innerHTML = `
        <rect x="0" y="0" width="${width}" height="${height}" rx="20" fill="transparent"></rect>
        ${axisLines}
        ${paths}
        ${labels}
    `;
}

function renderBarChart(elementId, data) {
    const svg = document.getElementById(elementId);
    if (!svg) {
        return;
    }

    const width = 640;
    const height = 240;
    const padding = { top: 16, right: 20, bottom: 34, left: 28 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(...data.map((item) => Number(item.total || 0)), 1);
    const barWidth = innerWidth / Math.max(data.length, 1) - 6;

    const bars = data.map((item, index) => {
        const value = Number(item.total || 0);
        const heightRatio = value / maxValue;
        const barHeight = Math.max(innerHeight * heightRatio, value > 0 ? 6 : 2);
        const x = padding.left + index * (barWidth + 6);
        const y = padding.top + innerHeight - barHeight;
        return `
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="10" fill="url(#reportsGradient)"></rect>
            <text x="${x + (barWidth / 2)}" y="${height - 10}" text-anchor="middle" class="chart-axis-label">${formatShortDate(item.date)}</text>
        `;
    }).join("");

    svg.innerHTML = `
        <defs>
            <linearGradient id="reportsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#f5d07a"></stop>
                <stop offset="100%" stop-color="#d08932"></stop>
            </linearGradient>
        </defs>
        <line x1="${padding.left}" y1="${padding.top + innerHeight}" x2="${width - padding.right}" y2="${padding.top + innerHeight}" class="chart-grid-line"></line>
        ${bars}
    `;
}

function renderSimpleActivity(elementId, items, emptyMessage) {
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }

    if (items.length === 0) {
        element.innerHTML = `<p class="admin-empty-state">${escapeHtml(emptyMessage)}</p>`;
        return;
    }

    element.innerHTML = items.map((item) => `
        <article class="admin-activity-card">
            <div>
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.body)}</p>
            </div>
            <span class="activity-badge">${escapeHtml(item.meta)}</span>
        </article>
    `).join("");
}

function buildAvatarMarkup(report, variant = "card") {
    const avatarUrl = report.avatarUrl || "";
    const className = variant === "details" ? "details-avatar" : "report-avatar";
    const fallbackClassName = variant === "details" ? "details-avatar details-avatar-fallback" : "report-avatar report-avatar-fallback";
    const playerName = escapeHtml(report.playerName || "Jogador");

    if (avatarUrl) {
        return `<img class="${className}" src="${escapeAttribute(avatarUrl)}" alt="Avatar de ${playerName}" loading="lazy">`;
    }

    return `<span class="${fallbackClassName}" aria-hidden="true">${escapeHtml(getInitials(report.playerName))}</span>`;
}

function buildProofLinksList(links) {
    const normalized = normalizeProofLinks(links);
    if (normalized.length === 0) {
        return "Sem links de prova.";
    }

    return normalized
        .map((link, index) => `<a class="details-proof-link" href="${escapeAttribute(link)}" target="_blank" rel="noreferrer">Abrir prova ${index + 1}</a>`)
        .join("<br>");
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

function adminHeaders() {
    return adminAuth ? { "x-admin-user": adminAuth.username, "x-admin-pass": adminAuth.password } : {};
}

function jsonHeaders() {
    return {
        "content-type": "application/json"
    };
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

function trackVisit(page) {
    safeFetchJson(ADMIN_API.analyticsTrack, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ page })
    });
}

function syncSidebarWithScroll() {
    const sections = document.querySelectorAll(".admin-section[id]");
    const offset = 140;
    let currentId = "#adminOverview";

    sections.forEach((section) => {
        const top = section.getBoundingClientRect().top;
        if (top - offset <= 0) {
            currentId = `#${section.id}`;
        }
    });

    setActiveSidebarLink(currentId);
}

function setActiveSidebarLink(targetId) {
    document.querySelectorAll(".admin-side-link").forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === targetId);
    });
}

function bindIfExists(id, eventName, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(eventName, handler);
    }
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = String(value);
    }
}

function setRefreshLabel(message) {
    setText("adminLastRefreshLabel", message);
}

function formatDate(value) {
    return new Date(value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatShortDate(value) {
    return new Date(value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit"
    });
}

function formatTime(value) {
    return new Date(value).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function normalizeProofLinks(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || "").trim()).filter(Boolean);
    }

    return String(value || "")
        .split(/\r?\n|,/)
        .map((item) => String(item || "").trim())
        .filter(Boolean);
}

function getInitials(value) {
    const parts = String(value || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.length ? parts.map((part) => part[0].toUpperCase()).join("") : "HG";
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) {
        return;
    }

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) {
        return;
    }

    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function closeModals() {
    document.querySelectorAll(".modal.active").forEach((modal) => closeModal(modal.id));
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
