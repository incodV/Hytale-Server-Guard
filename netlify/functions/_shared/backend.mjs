import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

export const ADMIN_USERNAME = sanitize(process.env.HSG_ADMIN_USERNAME);
export const ADMIN_PASSWORD = sanitize(process.env.HSG_ADMIN_PASSWORD);
const ADMIN_SESSION_COOKIE = "hsg_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

export function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store"
        }
    });
}

export async function readJsonBody(request) {
    try {
        return await request.json();
    } catch (error) {
        return null;
    }
}

export function sanitize(value) {
    return String(value || "").trim();
}

export function normalizeEmail(value) {
    return sanitize(value).toLowerCase();
}

export function normalizeRole(value) {
    const role = sanitize(value).toLowerCase();
    return role === "owner" ? "owner" : "player";
}

export function createId(prefix) {
    return `${prefix}_${crypto.randomUUID()}`;
}

export function createToken() {
    return crypto.randomBytes(24).toString("hex");
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
    const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

export async function findUserByEmail(email) {
    return getUsersStore().get(userKey(email), { type: "json" });
}

export async function saveUser(user) {
    await getUsersStore().setJSON(userKey(user.email), user);
}

export async function listUsers() {
    const { blobs } = await getUsersStore().list();
    const users = [];

    for (const blob of blobs) {
        const user = await getUsersStore().get(blob.key, { type: "json" });
        if (user) {
            users.push(user);
        }
    }

    return users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getUserFromToken(request) {
    const token = extractBearerToken(request);
    if (!token) {
        return null;
    }

    const { blobs } = await getUsersStore().list();
    for (const blob of blobs) {
        const user = await getUsersStore().get(blob.key, { type: "json" });
        if (user?.sessionToken === token) {
            return user;
        }
    }

    return null;
}

export async function clearUserSession(user) {
    if (!user) {
        return;
    }

    user.sessionToken = "";
    user.sessionUpdatedAt = new Date().toISOString();
    await saveUser(user);
}

export async function listReports() {
    const { blobs } = await getReportsStore().list();
    const reports = [];

    for (const blob of blobs) {
        const report = await getReportsStore().get(blob.key, { type: "json" });
        if (report) {
            reports.push(report);
        }
    }

    return reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getReport(id) {
    return getReportsStore().get(reportKey(id), { type: "json" });
}

export async function saveReport(report) {
    await getReportsStore().setJSON(reportKey(report.id), report);
}

export async function deleteReportById(id) {
    await getReportsStore().delete(reportKey(id));
}

export async function listPartnerServers() {
    const { blobs } = await getPartnersStore().list();
    const servers = [];

    for (const blob of blobs) {
        const server = await getPartnersStore().get(blob.key, { type: "json" });
        if (server) {
            servers.push(server);
        }
    }

    return servers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function savePartnerServer(server) {
    await getPartnersStore().setJSON(partnerKey(server.id), server);
}

export async function deletePartnerServerById(id) {
    await getPartnersStore().delete(partnerKey(id));
}

export async function recordVisit(page) {
    const day = getDayKey();
    const key = analyticsKey(day);
    const current = await getAnalyticsStore().get(key, { type: "json" });
    const safePage = sanitize(page) || "public";
    const updated = {
        date: day,
        total: Number(current?.total || 0) + 1,
        pages: {
            ...(current?.pages || {}),
            [safePage]: Number(current?.pages?.[safePage] || 0) + 1
        },
        updatedAt: new Date().toISOString()
    };

    await getAnalyticsStore().setJSON(key, updated);
    return updated;
}

export async function listAnalytics() {
    const { blobs } = await getAnalyticsStore().list();
    const metrics = [];

    for (const blob of blobs) {
        const item = await getAnalyticsStore().get(blob.key, { type: "json" });
        if (item) {
            metrics.push(item);
        }
    }

    return metrics.sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function hasConfiguredAdminCredentials() {
    return Boolean(ADMIN_USERNAME && ADMIN_PASSWORD);
}

export function verifyAdminCredentials(username, password) {
    if (!hasConfiguredAdminCredentials()) {
        return false;
    }

    return sanitize(username) === ADMIN_USERNAME && sanitize(password) === ADMIN_PASSWORD;
}

export async function createAdminSession() {
    const token = createToken();
    const now = new Date();
    const session = {
        token,
        username: ADMIN_USERNAME,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ADMIN_SESSION_TTL_SECONDS * 1000).toISOString()
    };

    await getAdminSessionsStore().setJSON(adminSessionKey(token), session);
    return session;
}

export async function getAdminSession(request) {
    const token = getCookie(request, ADMIN_SESSION_COOKIE);
    if (!token) {
        return null;
    }

    const session = await getAdminSessionsStore().get(adminSessionKey(token), { type: "json" });
    if (!session) {
        return null;
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
        await getAdminSessionsStore().delete(adminSessionKey(token));
        return null;
    }

    return session;
}

export async function requireAdminSession(request) {
    return getAdminSession(request);
}

export async function destroyAdminSession(request) {
    const token = getCookie(request, ADMIN_SESSION_COOKIE);
    if (!token) {
        return;
    }

    await getAdminSessionsStore().delete(adminSessionKey(token));
}

export function buildAdminSessionCookie(token) {
    const secure = process.env.URL && !String(process.env.URL).includes("http://localhost")
        ? "; Secure"
        : "";

    return `${ADMIN_SESSION_COOKIE}=${token}; Max-Age=${ADMIN_SESSION_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function clearAdminSessionCookie() {
    return `${ADMIN_SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}

export function publicUser(user) {
    if (!user) {
        return null;
    }

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        serverName: user.serverName || "",
        hytaleNickname: user.hytaleNickname || "",
        createdAt: user.createdAt
    };
}

export function publicReport(report) {
    return {
        id: report.id,
        playerName: report.playerName,
        uuid: report.uuid,
        server: report.server,
        reason: report.reason,
        proofLinks: report.proofLinks,
        status: report.status,
        createdAt: report.createdAt,
        avatarUrl: report.avatarUrl || "",
        gotaleLookup: report.gotaleLookup || "",
        likesCount: Number(report.likesCount || 0)
    };
}

function userKey(email) {
    return `user:${normalizeEmail(email)}`;
}

function reportKey(id) {
    return `report:${id}`;
}

function partnerKey(id) {
    return `partner:${id}`;
}

function analyticsKey(day) {
    return `analytics:${day}`;
}

function adminSessionKey(token) {
    return `admin-session:${token}`;
}

function getUsersStore() {
    return getStore("hsg-users");
}

function getReportsStore() {
    return getStore("hsg-reports");
}

function getPartnersStore() {
    return getStore("hsg-partners");
}

function getAnalyticsStore() {
    return getStore("hsg-analytics");
}

function getAdminSessionsStore() {
    return getStore("hsg-admin-sessions");
}

function extractBearerToken(request) {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.toLowerCase().startsWith("bearer ")) {
        return "";
    }

    return authorization.slice(7).trim();
}

function getCookie(request, name) {
    const cookieHeader = request.headers.get("cookie") || "";
    const cookies = cookieHeader.split(";").map((entry) => entry.trim()).filter(Boolean);
    const match = cookies.find((entry) => entry.startsWith(`${name}=`));
    return match ? match.slice(name.length + 1) : "";
}

function getDayKey() {
    return new Date().toISOString().slice(0, 10);
}
