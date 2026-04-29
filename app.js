let reports = [];
let currentUser = null;
let userSessionToken = "";
const STORAGE_KEYS = {
    localReports: "hytaleguard_reports",
    userSession: "hytaleguard_user_session",
    reportLikes: "hytaleguard_report_likes"
};
let likedReports = {};

const API = {
    gotalePlayer: "/api/gotale/player",
    analyticsTrack: "/api/analytics/track",
    reportsPublic: "/api/reports/public",
    reportsCreate: "/api/reports/create",
    reportsLike: "/api/reports/like",
    reportsMine: "/api/reports/mine",
    authRegister: "/api/auth/register",
    authLogin: "/api/auth/login",
    adminReports: "/api/reports/admin",
    adminUpdate: "/api/reports/admin/update",
    adminDelete: "/api/reports/admin/delete"
};

document.addEventListener("DOMContentLoaded", async () => {
    setCurrentYear();
    loadStoredSessions();
    setupEventListeners();
    trackVisit("public");
    await loadData();
    await refreshUI();
});

document.addEventListener("languagechange", () => {
    refreshUI();
});

function loadStoredSessions() {
    try {
        const savedUserSession = JSON.parse(localStorage.getItem(STORAGE_KEYS.userSession) || "null");
        currentUser = savedUserSession?.user || null;
        userSessionToken = savedUserSession?.token || "";
    } catch (error) {
        currentUser = null;
        userSessionToken = "";
    }

    try {
        likedReports = JSON.parse(localStorage.getItem(STORAGE_KEYS.reportLikes) || "{}");
    } catch (error) {
        likedReports = {};
    }
}

async function loadData() {
    if (canUseBackend()) {
        const response = await safeFetchJson(API.reportsPublic);
        if (response?.ok) {
            reports = normalizeReports(response.reports);
            return;
        }
    }

    const localData = localStorage.getItem(STORAGE_KEYS.localReports);
    if (localData) {
        try {
            reports = normalizeReports(JSON.parse(localData));
            return;
        } catch (error) {
            console.error("Erro ao ler dados locais:", error);
        }
    }

    try {
        const response = await fetch("data.json");
        const data = await response.json();
        reports = normalizeReports(data.reports || []);
        localStorage.setItem(STORAGE_KEYS.localReports, JSON.stringify(reports));
    } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
        reports = [];
    }
}

function normalizeReports(list) {
    return (Array.isArray(list) ? list : []).map((report) => ({
        ...report,
        proofLinks: normalizeProofLinks(report.proofLinks),
        avatarUrl: report.avatarUrl || "",
        gotaleLookup: report.gotaleLookup || "",
        reporterName: report.reporterName || "",
        reporterRole: report.reporterRole || "player",
        likesCount: Number(report.likesCount || 0)
    }));
}

async function refreshUI(filteredData = null) {
    updateHeaderState();
    updateHeroMetrics();
    renderReports(filteredData);
    renderAccountArea();
}

function updateHeaderState() {
    const accountBtn = document.getElementById("accountBtn");
    const accountActionBtn = document.getElementById("accountActionBtn");
    const accountIntro = document.getElementById("accountIntro");
    const logoutQuickBtn = document.getElementById("logoutQuickBtn");

    if (accountBtn) {
        accountBtn.textContent = currentUser ? t("profile_open") : t("account_login_create");
    }

    if (accountActionBtn) {
        accountActionBtn.textContent = currentUser ? t("profile_open") : t("account_create");
    }

    if (logoutQuickBtn) {
        logoutQuickBtn.hidden = !currentUser;
        logoutQuickBtn.textContent = t("account_logout");
    }

    if (currentUser) {
        accountIntro.textContent = t("account_home_summary");
    } else {
        accountIntro.textContent = t("account_intro_guest");
    }
}

function updateHeroMetrics() {
    const approved = reports.filter((report) => report.status === "Aprovado").length;
    const pending = reports.filter((report) => report.status === "Em análise").length;
    const members = new Set(reports.map((report) => report.reporterName).filter(Boolean)).size;

    document.getElementById("heroApprovedCount").textContent = approved;
    document.getElementById("heroPendingCount").textContent = pending;
    document.getElementById("heroMemberCount").textContent = members || 0;
}

function renderReports(dataToRender = null) {
    const grid = document.getElementById("reportsGrid");
    if (!grid) {
        return;
    }

    const publicReports = dataToRender || reports.filter((report) => report.status === "Aprovado");
    const ordered = [...publicReports].sort(sortByNewest);

    updateSearchMeta(ordered.length);

    if (ordered.length === 0) {
        grid.innerHTML = `<p class="empty-state">${escapeHtml(t("reports_empty"))}</p>`;
        return;
    }

    grid.innerHTML = ordered
        .map((report) => {
            const uuid = report.uuid && report.uuid !== "N/A" ? escapeHtml(report.uuid) : "UUID não informado";

            return `
                <article class="report-card report-card-compact" data-report-id="${escapeAttribute(report.id)}">
                    <div class="report-header">
                        <div class="report-identity">
                            ${buildAvatarMarkup(report)}
                            <div class="player-info">
                                <h3>${escapeHtml(report.playerName)}</h3>
                                <p>${uuid}</p>
                            </div>
                        </div>
                        <span class="status-badge status-aprovado">${escapeHtml(t("status_approved"))}</span>
                    </div>

                    <div class="report-body">
                        <p>${escapeHtml(excerptText(report.reason, 220))}</p>
                        <div class="report-body-meta">
                            <span>${escapeHtml(t("label_server"))}: ${escapeHtml(report.server)}</span>
                            <span>${escapeHtml(t("label_source_protected"))}</span>
                        </div>
                    </div>

                    <div class="report-footer">
                        <span>${formatDate(report.createdAt)}</span>
                        <div class="report-footer-actions">
                            <span>${buildProofLinksSummary(report.proofLinks)}</span>
                            <button class="btn-like ${hasLikedReport(report.id) ? "active" : ""}" type="button" data-like-report="${escapeAttribute(report.id)}">
                                ${escapeHtml(t("action_like"))} <strong>${getLikeCount(report.id)}</strong>
                            </button>
                            <button class="btn-view" type="button" data-view-report="${escapeAttribute(report.id)}">Ver detalhes</button>
                        </div>
                    </div>
                </article>
            `;
        })
        .join("");
}

function renderAccountArea() {
    const accountShell = document.getElementById("accountShell");
    if (!accountShell) {
        return;
    }

    if (!currentUser) {
        accountShell.innerHTML = `
            <div class="account-card">
                <p class="account-empty">${escapeHtml(t("account_no_session"))}</p>
            </div>
        `;
        return;
    }

    accountShell.innerHTML = `
        <div class="account-grid">
            <div class="account-card">
                <div class="account-meta">
                    <p class="section-kicker">${escapeHtml(t("profile_kicker"))}</p>
                    <h3>${escapeHtml(currentUser.name)}</h3>
                    <p>${escapeHtml(t("field_email"))}: ${escapeHtml(currentUser.email)}</p>
                    <p>${escapeHtml(t("profile_type"))}: ${escapeHtml(currentUser.role === "owner" ? t("role_owner") : t("role_player"))}</p>
                    <p>${currentUser.serverName ? `${escapeHtml(t("field_server_name"))}: ${escapeHtml(currentUser.serverName)}` : escapeHtml(t("profile_no_server"))}</p>
                    <div class="account-actions">
                        <button class="btn-secondary" id="openProfileBtn" type="button">${escapeHtml(t("profile_open"))}</button>
                        <button class="btn-login" id="logoutUserBtn" type="button">${escapeHtml(t("account_logout"))}</button>
                    </div>
                </div>
            </div>

            <div class="account-card">
                <div class="account-reports-head">
                    <p class="section-kicker">${escapeHtml(t("my_reports_kicker"))}</p>
                    <h3>${escapeHtml(t("my_reports_title"))}</h3>
                    <p id="myReportsMeta">${escapeHtml(t("account_home_summary"))}</p>
                </div>
                <div class="my-reports-list" id="myReportsList">
                    <p class="account-empty">${escapeHtml(t("loading"))}</p>
                </div>
            </div>
        </div>
    `;

    bindIfExists("openProfileBtn", "click", openProfilePage);
    bindIfExists("logoutUserBtn", "click", logoutUser);
    loadMyReports();
}

async function loadMyReports() {
    const meta = document.getElementById("myReportsMeta");
    const list = document.getElementById("myReportsList");

    if (!meta || !list || !currentUser || !userSessionToken) {
        return;
    }

    if (!canUseBackend()) {
        meta.textContent = t("my_reports_none_meta");
        list.innerHTML = `<p class="account-empty">${escapeHtml(t("my_reports_none_text"))}</p>`;
        return;
    }

    meta.textContent = t("updating");
    const response = await safeFetchJson(API.reportsMine, {
        headers: authHeaders()
    });

    if (!response?.ok) {
        meta.textContent = t("my_reports_error_meta");
        list.innerHTML = `<p class="account-empty">${escapeHtml(t("try_again_later"))}</p>`;
        return;
    }

    const myReports = normalizeReports(response.reports);
    meta.textContent = t("my_reports_count").replace("{count}", myReports.length);

    if (myReports.length === 0) {
        list.innerHTML = `
            <p class="account-empty">${escapeHtml(t("my_reports_empty"))}</p>
            <button class="btn-secondary" id="openProfileFromEmptyBtn" type="button">${escapeHtml(t("profile_open"))}</button>
        `;
        bindIfExists("openProfileFromEmptyBtn", "click", openProfilePage);
        return;
    }

    list.innerHTML = `
        <article class="my-report-card">
            <strong>${escapeHtml(t("profile_open"))}</strong>
            <p>${escapeHtml(t("my_reports_count").replace("{count}", myReports.length))}</p>
            <p>${escapeHtml(t("account_home_summary"))}</p>
            <button class="btn-secondary" id="openProfileFromSummaryBtn" type="button">${escapeHtml(t("profile_open"))}</button>
        </article>
    ` + myReports.slice(0, 3).map((report) => `
        <article class="my-report-card">
            <strong>${escapeHtml(report.playerName)}</strong>
            <p>${escapeHtml(t("table_status"))}: <span class="status-badge ${getStatusClass(report.status)}">${escapeHtml(getStatusLabel(report.status))}</span></p>
            <p>${escapeHtml(t("table_server"))}: ${escapeHtml(report.server)}</p>
            <p>${escapeHtml(t("table_date"))}: ${formatDate(report.createdAt)}</p>
        </article>
    `).join("");

    bindIfExists("openProfileFromSummaryBtn", "click", openProfilePage);
}

function handleSearch(query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
        renderReports();
        return;
    }

    const filtered = reports.filter((report) =>
        report.status === "Aprovado" &&
        [report.playerName, report.uuid, report.server].filter(Boolean).some((value) => normalizeText(value).includes(normalizedQuery))
    );

    renderReports(filtered);
}

async function submitReport(event) {
    event.preventDefault();

    const form = event.target;
    const feedback = document.getElementById("reportFeedback");
    const submitButton = form.querySelector('button[type="submit"]');

    if (!currentUser) {
        showFeedback(feedback, t("feedback_login_before_report"), "error");
        openModal("accountModal");
        return;
    }

    const formData = new FormData(form);
    let report = {
        playerName: sanitizeField(formData.get("playerName")),
        uuid: sanitizeField(formData.get("uuid")) || "N/A",
        discord: sanitizeField(formData.get("discord")),
        server: sanitizeField(formData.get("server")),
        reason: sanitizeField(formData.get("reason")),
        proofLinks: sanitizeField(formData.get("proofLinks")),
        avatarUrl: "",
        gotaleLookup: ""
    };

    const validationError = validateReport(report);
    if (validationError) {
        showFeedback(feedback, validationError, "error");
        return;
    }

    setButtonLoading(submitButton, true, "Consultando perfil...");
    const enrichment = await enrichReportWithGotale(report);
    report = enrichment.report;

    if (canUseBackend()) {
        const response = await safeFetchJson(API.reportsCreate, {
            method: "POST",
            headers: {
                ...jsonHeaders(),
                ...authHeaders()
            },
            body: JSON.stringify(report)
        });

        setButtonLoading(submitButton, false, "Enviar para Análise");

        if (!response?.ok) {
            showFeedback(feedback, response?.error || t("feedback_save_report_error"), "error");
            return;
        }

        form.reset();
        showFeedback(feedback, enrichment.note || t("feedback_report_success"), "success");
        await loadData();
        await refreshUI();
        window.setTimeout(() => {
            hideFeedback(feedback);
            closeModal("reportModal");
        }, 1600);
        return;
    }

    const localReport = {
        id: Date.now().toString(),
        ...report,
        status: "Em análise",
        createdAt: new Date().toISOString(),
        reporterName: currentUser.name,
        reporterRole: currentUser.role,
        likesCount: 0
    };

    reports.push(localReport);
    localStorage.setItem(STORAGE_KEYS.localReports, JSON.stringify(reports));
    setButtonLoading(submitButton, false, "Enviar para Análise");
    form.reset();
    showFeedback(feedback, t("feedback_report_saved"), "success");
    await refreshUI();
}

function validateReport(report) {
    if (!report.playerName || !report.discord || !report.server || !report.reason || !report.proofLinks) {
        return t("validation_required");
    }

    report.proofLinks = normalizeProofLinks(report.proofLinks);

    if (report.proofLinks.length === 0) {
        return t("validation_proof_required");
    }

    if (report.reason.length < 15) {
        return t("validation_reason_length");
    }

    if (report.uuid !== "N/A" && !isValidUuid(report.uuid)) {
        return t("validation_uuid");
    }

    if (!report.proofLinks.every((link) => isValidProofLink(link))) {
        return t("validation_proof_links");
    }

    return "";
}

async function enrichReportWithGotale(report) {
    if (!canUseBackend()) {
        return {
            report,
            note: t("feedback_report_sent_basic")
        };
    }

    const params = new URLSearchParams();
    if (report.uuid && report.uuid !== "N/A") {
        params.set("uuid", report.uuid);
    } else {
        params.set("player", report.playerName);
    }

    const response = await safeFetchJson(`${API.gotalePlayer}?${params.toString()}`);
    if (!response?.ok) {
        return {
            report,
            note: t("feedback_avatar_failed")
        };
    }

    return {
        report: {
            ...report,
            playerName: sanitizeField(response.player) || report.playerName,
            uuid: sanitizeField(response.uuid) || report.uuid,
            avatarUrl: sanitizeField(response.avatarUrl),
            gotaleLookup: sanitizeField(response.lookup)
        },
        note: t("feedback_avatar_success")
    };
}

async function handleRegister(event) {
    event.preventDefault();
    const feedback = document.getElementById("registerFeedback");

    if (!canUseBackend()) {
        showFeedback(feedback, t("feedback_register_unavailable"), "error");
        return;
    }

    const formData = new FormData(event.target);
    const payload = {
        name: sanitizeField(formData.get("name")),
        email: sanitizeField(formData.get("email")),
        password: sanitizeField(formData.get("password")),
        role: sanitizeField(formData.get("role")),
        serverName: sanitizeField(formData.get("serverName"))
    };

    const response = await safeFetchJson(API.authRegister, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(payload)
    });

    if (!response?.ok) {
        showFeedback(feedback, response?.error || t("feedback_register_error"), "error");
        return;
    }

    persistUserSession(response.token, response.user);
    showFeedback(feedback, t("feedback_register_success"), "success");
    event.target.reset();
    await refreshUI();
    closeModal("registerModal");
    closeModal("accountModal");
}

async function handleUserLogin(event) {
    event.preventDefault();
    const feedback = document.getElementById("userLoginFeedback");

    if (!canUseBackend()) {
        showFeedback(feedback, t("feedback_login_unavailable"), "error");
        return;
    }

    const formData = new FormData(event.target);
    const payload = {
        email: sanitizeField(formData.get("email")),
        password: sanitizeField(formData.get("password"))
    };

    const response = await safeFetchJson(API.authLogin, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(payload)
    });

    if (!response?.ok) {
        showFeedback(feedback, response?.error || t("feedback_login_error"), "error");
        return;
    }

    persistUserSession(response.token, response.user);
    showFeedback(feedback, t("feedback_login_success"), "success");
    event.target.reset();
    await refreshUI();
    closeModal("accountModal");
}

function persistUserSession(token, user) {
    currentUser = user;
    userSessionToken = token;
    localStorage.setItem(STORAGE_KEYS.userSession, JSON.stringify({ token, user }));
}

function logoutUser() {
    currentUser = null;
    userSessionToken = "";
    localStorage.removeItem(STORAGE_KEYS.userSession);
    refreshUI();
}

async function handleAdminLogin(event) {
    event.preventDefault();
    const feedback = document.getElementById("loginFeedback");
    showFeedback(feedback, "Use a pagina administrativa dedicada para entrar no painel.", "success");
    window.setTimeout(() => {
        window.location.href = "admin.html";
    }, 250);
}

function viewReportDetails(id) {
    const report = reports.find((item) => item.id === id);
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
                    <dt>Origem</dt>
                    <dd>${escapeHtml(t("detail_source_protected"))}</dd>
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

function setupEventListeners() {
    bindIfExists("searchInput", "input", (event) => handleSearch(event.target.value));
    bindIfExists("searchInput", "keydown", handleSearchEnter);
    bindIfExists("btnOpenReport", "click", () => openModal("reportModal"));
    bindIfExists("accountBtn", "click", () => currentUser ? openProfilePage() : openModal("accountModal"));
    bindIfExists("accountActionBtn", "click", () => currentUser ? openProfilePage() : openModal("accountModal"));
    bindIfExists("logoutQuickBtn", "click", logoutUser);
    bindIfExists("openRegisterModalBtn", "click", () => {
        closeModal("accountModal");
        openModal("registerModal");
    });
    bindIfExists("openAdminLoginBtn", "click", () => {
        window.location.href = "admin.html";
    });
    bindIfExists("reportForm", "submit", submitReport);
    bindIfExists("loginForm", "submit", handleAdminLogin);
    bindIfExists("registerForm", "submit", handleRegister);
    bindIfExists("userLoginForm", "submit", handleUserLogin);

    const reportsGrid = document.getElementById("reportsGrid");
    if (reportsGrid) {
        reportsGrid.addEventListener("click", (event) => {
            const likeTrigger = event.target.closest("[data-like-report]");
            if (likeTrigger) {
                toggleReportLike(likeTrigger.dataset.likeReport);
                return;
            }

            const trigger = event.target.closest("[data-view-report]");
            if (!trigger) {
                return;
            }

            viewReportDetails(trigger.dataset.viewReport);
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

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeModals();
        }
    });
}

function bindIfExists(id, eventName, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(eventName, handler);
    }
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

function buildAvatarMarkup(report, variant = "card") {
    const avatarUrl = report.avatarUrl || getDerivedAvatarUrl(report);
    const className = variant === "details" ? "details-avatar" : "report-avatar";
    const fallbackClassName = variant === "details" ? "details-avatar details-avatar-fallback" : "report-avatar report-avatar-fallback";
    const playerName = escapeHtml(report.playerName || "Jogador");

    if (avatarUrl) {
        return `<img class="${className}" src="${escapeAttribute(avatarUrl)}" alt="Avatar de ${playerName}" loading="lazy">`;
    }

    return `<span class="${fallbackClassName}" aria-hidden="true">${escapeHtml(getInitials(report.playerName))}</span>`;
}

function buildProofLinksSummary(links) {
    const normalized = normalizeProofLinks(links);
    if (normalized.length === 0) {
        return escapeHtml(t("proof_none"));
    }

    if (normalized.length === 1) {
        return "1 prova anexada";
    }

    return `${normalized.length} provas anexadas`;
}

function buildProofLinksList(links) {
    const normalized = normalizeProofLinks(links);
    if (normalized.length === 0) {
        return t("proof_none");
    }

    return normalized
        .map((link, index) => `<a class="details-proof-link" href="${escapeAttribute(link)}" target="_blank" rel="noreferrer">${escapeHtml(t("proof_open_number").replace("{number}", index + 1))}</a>`)
        .join("<br>");
}

function getDerivedAvatarUrl(report) {
    const lookup = sanitizeField(report.gotaleLookup);
    if (!lookup || !canUseBackend()) {
        return "";
    }

    return `/api/gotale/avatar?player=${encodeURIComponent(lookup)}`;
}

function updateSearchMeta(count) {
    const meta = document.getElementById("searchMeta");
    const searchInput = document.getElementById("searchInput");
    if (!meta || !searchInput) {
        return;
    }

    const value = searchInput.value.trim();
    meta.textContent = value
        ? t("search_results_for").replace("{count}", count).replace("{query}", value)
        : t("search_public_count").replace("{count}", count);
}

function canUseBackend() {
    return window.location.protocol !== "file:";
}

async function safeFetchJson(url, options = {}) {
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        return response.ok ? data : { ok: false, ...data };
    } catch (error) {
        console.error("Erro de rede:", error);
        return null;
    }
}

function trackVisit(page) {
    if (!canUseBackend()) {
        return;
    }

    safeFetchJson(API.analyticsTrack, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ page })
    });
}

function excerptText(value, maxLength = 220) {
    const text = sanitizeField(value).replace(/\s+/g, " ");
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function handleSearchEnter(event) {
    if (event.key !== "Enter") {
        return;
    }

    const query = String(event.target?.value || "").trim();
    if (!query) {
        return;
    }

    const normalizedQuery = normalizeText(query);
    const match = reports
        .filter((report) => report.status === "Aprovado")
        .find((report) =>
            [report.playerName, report.uuid, report.server]
                .filter(Boolean)
                .some((value) => normalizeText(value).includes(normalizedQuery))
        );

    if (!match) {
        return;
    }

    event.preventDefault();
    viewReportDetails(match.id);
}

async function toggleReportLike(reportId) {
    if (!reportId) {
        return;
    }

    if (hasLikedReport(reportId)) {
        return;
    }

    if (canUseBackend()) {
        const response = await safeFetchJson(API.reportsLike, {
            method: "POST",
            headers: jsonHeaders(),
            body: JSON.stringify({ id: reportId })
        });

        if (!response?.ok || !response.report) {
            return;
        }

        updateReportInMemory(response.report);
    } else {
        const report = reports.find((item) => item.id === reportId);
        if (report) {
            report.likesCount = Number(report.likesCount || 0) + 1;
        }
    }

    likedReports[reportId] = true;
    localStorage.setItem(STORAGE_KEYS.reportLikes, JSON.stringify(likedReports));
    renderReports(getCurrentlyRenderedReports());
}

function hasLikedReport(reportId) {
    return Boolean(likedReports[reportId]);
}

function getLikeCount(reportId) {
    return Number(reports.find((report) => report.id === reportId)?.likesCount || 0);
}

function getCurrentlyRenderedReports() {
    const searchInput = document.getElementById("searchInput");
    const query = searchInput?.value.trim() || "";
    if (!query) {
        return null;
    }

    const normalizedQuery = normalizeText(query);
    return reports.filter((report) =>
        report.status === "Aprovado" &&
        [report.playerName, report.uuid, report.server].filter(Boolean).some((value) => normalizeText(value).includes(normalizedQuery))
    );
}

function updateReportInMemory(updatedReport) {
    const index = reports.findIndex((item) => item.id === updatedReport.id);
    if (index >= 0) {
        reports[index] = {
            ...reports[index],
            ...updatedReport,
            proofLinks: normalizeProofLinks(updatedReport.proofLinks),
            likesCount: Number(updatedReport.likesCount || 0)
        };
    }
}

function openProfilePage() {
    window.location.href = "profile.html";
}

function jsonHeaders() {
    return {
        "content-type": "application/json"
    };
}

function authHeaders() {
    return userSessionToken ? { authorization: `Bearer ${userSessionToken}` } : {};
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

function getStatusLabel(status) {
    if (status === "Aprovado") {
        return t("status_approved");
    }
    if (status === "Rejeitado") {
        return t("status_rejected");
    }
    return t("status_pending");
}

function sortByNewest(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
}

function formatDate(value) {
    return new Date(value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function normalizeText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function sanitizeField(value) {
    return String(value || "").trim();
}

function normalizeProofLinks(value) {
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeField(item)).filter(Boolean);
    }

    return String(value || "")
        .split(/\r?\n|,/)
        .map((item) => sanitizeField(item))
        .filter(Boolean);
}

function getInitials(value) {
    const parts = sanitizeField(value).split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.length ? parts.map((part) => part[0].toUpperCase()).join("") : "HG";
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

function isValidUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isValidProofLink(value) {
    try {
        const url = new URL(value);
        return ["prnt.sc", "www.prnt.sc", "lightshot.com", "www.lightshot.com"].includes(url.hostname.toLowerCase());
    } catch (error) {
        return false;
    }
}

function showFeedback(element, message, type) {
    if (!element) {
        return;
    }
    element.textContent = message;
    element.className = `form-feedback ${type}`;
    element.hidden = false;
}

function hideFeedback(element) {
    if (!element) {
        return;
    }
    element.hidden = true;
    element.textContent = "";
    element.className = "form-feedback";
}

function setButtonLoading(button, isLoading, label) {
    if (!button) {
        return;
    }
    button.disabled = isLoading;
    button.textContent = label;
}

function setCurrentYear() {
    const element = document.getElementById("currentYear");
    if (element) {
        element.textContent = new Date().getFullYear();
    }
}
