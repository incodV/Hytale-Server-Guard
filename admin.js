let adminReports = [];
let adminAuth = null;

const ADMIN_STORAGE_KEY = "hytaleguard_admin_auth";
const ADMIN_API = {
    reports: "/api/reports/admin",
    update: "/api/reports/admin/update",
    delete: "/api/reports/admin/delete"
};

document.addEventListener("DOMContentLoaded", async () => {
    loadAdminSession();
    setupAdminEventListeners();

    if (adminAuth) {
        const valid = await validateAdminSession();
        if (valid) {
            await showDashboard();
        }
    }
});

function loadAdminSession() {
    try {
        adminAuth = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || "null");
    } catch (error) {
        adminAuth = null;
    }
}

function setupAdminEventListeners() {
    const loginForm = document.getElementById("adminStandaloneLoginForm");
    const logoutBtn = document.getElementById("adminLogoutBtn");
    const tableBody = document.getElementById("adminTableBody");

    if (loginForm) {
        loginForm.addEventListener("submit", handleAdminLogin);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", logoutAdmin);
    }

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
        localStorage.removeItem(ADMIN_STORAGE_KEY);
        showFeedback(feedback, "Credenciais de administrador inválidas.", "error");
        return;
    }

    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminAuth));
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
    document.getElementById("adminLoginShell").hidden = true;
    document.getElementById("adminDashboard").hidden = false;
    document.getElementById("adminLogoutBtn").hidden = false;
    await loadAdminReports();
}

function logoutAdmin() {
    adminAuth = null;
    adminReports = [];
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    document.getElementById("adminDashboard").hidden = true;
    document.getElementById("adminLoginShell").hidden = false;
    document.getElementById("adminLogoutBtn").hidden = true;
}

async function loadAdminReports() {
    const response = await safeFetchJson(ADMIN_API.reports, {
        headers: adminHeaders()
    });

    if (!response?.ok) {
        logoutAdmin();
        return;
    }

    adminReports = Array.isArray(response.reports) ? response.reports : [];
    renderAdminPanel();
}

function renderAdminPanel() {
    const tableBody = document.getElementById("adminTableBody");
    const sorted = [...adminReports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    document.getElementById("statPending").textContent = sorted.filter((report) => report.status === "Em análise").length;
    document.getElementById("statApproved").textContent = sorted.filter((report) => report.status === "Aprovado").length;
    document.getElementById("statTotal").textContent = sorted.length;

    if (sorted.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">Nenhuma denúncia cadastrada.</td></tr>';
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

async function updateStatus(id, status) {
    const response = await safeFetchJson(ADMIN_API.update, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...adminHeaders()
        },
        body: JSON.stringify({ id, status })
    });

    if (response?.ok) {
        await loadAdminReports();
    }
}

async function deleteReport(id) {
    if (!window.confirm("Excluir permanentemente esta denúncia?")) {
        return;
    }

    const response = await safeFetchJson(ADMIN_API.delete, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...adminHeaders()
        },
        body: JSON.stringify({ id })
    });

    if (response?.ok) {
        await loadAdminReports();
    }
}

function viewReportDetails(id) {
    const report = adminReports.find((item) => item.id === id);
    if (!report) {
        return;
    }

    document.getElementById("detailsContent").innerHTML = `
        <div class="details-grid">
            <div class="details-hero">
                ${buildAvatarMarkup(report, "details")}
                <div class="details-heading">
                    <p class="section-kicker">Resumo da denúncia</p>
                    <h2>${escapeHtml(report.playerName)}</h2>
                    <p class="modal-intro">Use esta visão para revisar provas, origem e status atual do caso.</p>
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
                    <dt>Avatar</dt>
                    <dd>${report.avatarUrl ? "Consultado automaticamente via Gotale" : "Não disponível neste registro"}</dd>
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

async function safeFetchJson(url, options = {}) {
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        return response.ok ? data : { ok: false, ...data };
    } catch (error) {
        return null;
    }
}

function formatDate(value) {
    return new Date(value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric"
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
