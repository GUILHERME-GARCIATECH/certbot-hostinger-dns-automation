require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const dns = require("node:dns").promises;

const API_BASE_URL = "https://api.cloudflare.com/client/v4";

const {
    CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ZONE_DOMAIN,
    DNS_PROPAGATION_TIMEOUT_SECONDS = "600",
    DNS_PROPAGATION_INTERVAL_SECONDS = "15",
    // TTL 1 = "Auto" na Cloudflare (recomendado para registros temporários).
    // Mínimo absoluto é 60 segundos; valores menores são ignorados pela API.
    DNS_TTL = "1",
} = process.env;

if (!CLOUDFLARE_API_TOKEN) {
    throw new Error("CLOUDFLARE_API_TOKEN não foi definido no .env");
}

if (!CLOUDFLARE_ZONE_DOMAIN) {
    throw new Error("CLOUDFLARE_ZONE_DOMAIN não foi definido no .env");
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cloudflare espera o FQDN completo no campo name.
// Retorna, por exemplo: _acme-challenge.n8n.exemplo.com
function buildAcmeRecordFqdn(certbotDomain) {
    const zone = CLOUDFLARE_ZONE_DOMAIN;

    if (certbotDomain === zone) {
        return `_acme-challenge.${zone}`;
    }

    if (!certbotDomain.endsWith(`.${zone}`)) {
        throw new Error(
            `O domínio ${certbotDomain} não pertence à zona ${zone}`
        );
    }

    const subdomain = certbotDomain.slice(0, -(zone.length + 1));
    return `_acme-challenge.${subdomain}.${zone}`;
}

async function cloudflareRequest(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });

    const body = await response.json();

    if (!response.ok || !body.success) {
        throw new Error(
            `Cloudflare API erro ${response.status}: ${JSON.stringify(body.errors)}`
        );
    }

    return body.result;
}

// Cache do zone_id para evitar chamadas repetidas durante o mesmo processo.
let _zoneId = null;

async function getZoneId() {
    if (_zoneId) return _zoneId;

    const params = new URLSearchParams({
        name: CLOUDFLARE_ZONE_DOMAIN,
        status: "active",
    });

    const zones = await cloudflareRequest(`/zones?${params}`);

    if (!zones || zones.length === 0) {
        throw new Error(
            `Zona ativa não encontrada para o domínio: ${CLOUDFLARE_ZONE_DOMAIN}. ` +
            `Verifique se o domínio está ativo no Cloudflare e se o token tem permissão Zone:Read.`
        );
    }

    _zoneId = zones[0].id;
    console.log(`[cloudflare] Zone ID resolvido: ${_zoneId}`);
    return _zoneId;
}

async function upsertTxtRecord(recordFqdn, validationValue) {
    console.log(`[auth] Criando TXT ${recordFqdn} = ${validationValue}`);

    const zoneId = await getZoneId();

    // TTL 1 = Auto (Cloudflare define como 300s internamente).
    // Para valores numéricos, o mínimo aceito pela API é 60.
    const ttl = Number(DNS_TTL) === 1 ? 1 : Math.max(Number(DNS_TTL), 60);

    await cloudflareRequest(`/zones/${zoneId}/dns_records`, {
        method: "POST",
        body: JSON.stringify({
            type: "TXT",
            name: recordFqdn,
            content: validationValue,
            ttl,
        }),
    });
}

async function removeTxtRecord(recordFqdn, validationValue) {
    console.log(`[cleanup] Removendo TXT ${recordFqdn} = ${validationValue}`);

    const zoneId = await getZoneId();

    // Filtra pelo FQDN e pelo conteúdo exato para remover só o registro desta validação.
    const params = new URLSearchParams({
        type: "TXT",
        name: recordFqdn,
        content: validationValue,
    });

    const records = await cloudflareRequest(`/zones/${zoneId}/dns_records?${params}`);

    if (!records || records.length === 0) {
        console.log("[cleanup] Registro TXT não encontrado. Nada a remover.");
        return;
    }

    for (const record of records) {
        await cloudflareRequest(`/zones/${zoneId}/dns_records/${record.id}`, {
            method: "DELETE",
        });
        console.log(`[cleanup] TXT removido (id=${record.id}).`);
    }
}

async function waitForPropagation(fqdn, expectedValue) {
    const timeoutMs = Number(DNS_PROPAGATION_TIMEOUT_SECONDS) * 1000;
    const intervalMs = Number(DNS_PROPAGATION_INTERVAL_SECONDS) * 1000;
    const startedAt = Date.now();

    console.log(`[auth] Aguardando propagação DNS para ${fqdn}`);
    console.log(`[auth] Valor esperado: ${expectedValue}`);

    while (Date.now() - startedAt < timeoutMs) {
        try {
            const answers = await dns.resolveTxt(fqdn);
            const flattened = answers.map((parts) => parts.join(""));

            if (flattened.includes(expectedValue)) {
                console.log("[auth] TXT encontrado no DNS. Prosseguindo.");
                return;
            }

            console.log(`[auth] TXT ainda não encontrado. Valores atuais: ${JSON.stringify(flattened)}`);
        } catch (error) {
            console.log(`[auth] DNS ainda não respondeu com TXT: ${error.code || error.message}`);
        }

        await sleep(intervalMs);
    }

    throw new Error(`Timeout aguardando propagação do TXT em ${fqdn}`);
}

module.exports = {
    buildAcmeRecordFqdn,
    upsertTxtRecord,
    removeTxtRecord,
    waitForPropagation,
};
