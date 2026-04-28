import {
    jsonResponse,
    isAdminAuthorized,
    listAnalytics,
    listPartnerServers,
    listReports,
    listUsers,
    publicUser
} from "./_shared/backend.mjs";

export default async (request) => {
    if (request.method !== "GET") {
        return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    if (!isAdminAuthorized(request)) {
        return jsonResponse({ error: "Não autorizado." }, 401);
    }

    const [reports, users, partners, analytics] = await Promise.all([
        listReports(),
        listUsers(),
        listPartnerServers(),
        listAnalytics()
    ]);

    const reportsByStatus = {
        pending: reports.filter((report) => report.status === "Em análise").length,
        approved: reports.filter((report) => report.status === "Aprovado").length,
        rejected: reports.filter((report) => report.status === "Rejeitado").length
    };

    const usersByRole = {
        owners: users.filter((user) => user.role === "owner").length,
        players: users.filter((user) => user.role !== "owner").length
    };

    const visitTotals = analytics.reduce((accumulator, entry) => {
        accumulator.total += Number(entry.total || 0);
        accumulator.public += Number(entry.pages?.public || 0);
        accumulator.admin += Number(entry.pages?.admin || 0);
        return accumulator;
    }, { total: 0, public: 0, admin: 0 });

    return jsonResponse({
        ok: true,
        stats: {
            reportsTotal: reports.length,
            reportsPending: reportsByStatus.pending,
            reportsApproved: reportsByStatus.approved,
            reportsRejected: reportsByStatus.rejected,
            usersTotal: users.length,
            ownersTotal: usersByRole.owners,
            playersTotal: usersByRole.players,
            partnersTotal: partners.length,
            visitsTotal: visitTotals.total,
            publicVisits: visitTotals.public,
            adminVisits: visitTotals.admin
        },
        visitSeries: buildVisitSeries(analytics, 14),
        reportSeries: buildReportSeries(reports, 14),
        moderation: {
            recentReports: reports.slice(0, 8),
            flaggedServers: buildServerRisk(reports).slice(0, 6)
        },
        accounts: {
            recentUsers: users.slice(0, 6).map(publicUser),
            topReporters: buildTopReporters(reports, users).slice(0, 6)
        },
        partners
    });
};

function buildVisitSeries(analytics, days) {
    const byDate = new Map(analytics.map((entry) => [entry.date, entry]));
    return buildLastDays(days).map((date) => {
        const entry = byDate.get(date);
        return {
            date,
            total: Number(entry?.total || 0),
            public: Number(entry?.pages?.public || 0),
            admin: Number(entry?.pages?.admin || 0)
        };
    });
}

function buildReportSeries(reports, days) {
    const counts = new Map();
    reports.forEach((report) => {
        const key = String(report.createdAt || "").slice(0, 10);
        counts.set(key, Number(counts.get(key) || 0) + 1);
    });

    return buildLastDays(days).map((date) => ({
        date,
        total: Number(counts.get(date) || 0)
    }));
}

function buildServerRisk(reports) {
    const grouped = new Map();

    reports.forEach((report) => {
        const serverName = String(report.server || "Servidor não informado").trim();
        const current = grouped.get(serverName) || {
            server: serverName,
            totalCases: 0,
            approvedCases: 0,
            pendingCases: 0,
            lastCaseAt: ""
        };

        current.totalCases += 1;
        if (report.status === "Aprovado") {
            current.approvedCases += 1;
        }
        if (report.status === "Em análise") {
            current.pendingCases += 1;
        }
        if (!current.lastCaseAt || new Date(report.createdAt) > new Date(current.lastCaseAt)) {
            current.lastCaseAt = report.createdAt;
        }

        grouped.set(serverName, current);
    });

    return [...grouped.values()].sort((a, b) => {
        if (b.totalCases !== a.totalCases) {
            return b.totalCases - a.totalCases;
        }
        return new Date(b.lastCaseAt) - new Date(a.lastCaseAt);
    });
}

function buildTopReporters(reports, users) {
    const grouped = new Map();
    const userById = new Map(users.map((user) => [user.id, user]));

    reports.forEach((report) => {
        const userId = report.reporterId || `guest:${report.reporterEmail || report.discord}`;
        const current = grouped.get(userId) || {
            id: userId,
            name: report.reporterName || report.discord || "Conta sem nome",
            role: report.reporterRole || userById.get(report.reporterId)?.role || "player",
            reportsCreated: 0,
            latestReportAt: ""
        };

        current.reportsCreated += 1;
        if (!current.latestReportAt || new Date(report.createdAt) > new Date(current.latestReportAt)) {
            current.latestReportAt = report.createdAt;
        }

        grouped.set(userId, current);
    });

    return [...grouped.values()].sort((a, b) => {
        if (b.reportsCreated !== a.reportsCreated) {
            return b.reportsCreated - a.reportsCreated;
        }
        return new Date(b.latestReportAt) - new Date(a.latestReportAt);
    });
}

function buildLastDays(days) {
    const result = [];
    const now = new Date();

    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const item = new Date(now);
        item.setDate(now.getDate() - offset);
        result.push(item.toISOString().slice(0, 10));
    }

    return result;
}
