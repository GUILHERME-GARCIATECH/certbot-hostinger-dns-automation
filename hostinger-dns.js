require("dotenv").config();

const dns = require("node:dns").promises;

const API_BASE_URL = "https://developers.hostinger.com";

const {
    HOSTINGER_API_TOKEN,
    HOSTINGER_ZONE_DOMAIN,
    DNS_PROPAGATION_TIMEOUT_SECONDS = "600",
    DNS_PROPAGATION_INTERVAL_SECONDS = "15",
    DNS_TTL = "300",
} = process.env;

if (!HOSTINGER_API_TOKEN) {
    throw new Error("HOSTINGER_API_TOKEN não foi definido no .env");
}

if (!HOSTINGER_ZONE_DOMAIN) {
    throw new Error("HOSTINGER_ZONE_DOMAIN não foi definido no .env");
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTxtValue(value) {
    returnString(value).replace(/^"+|"+$/g, "");
}

function buildAcmeRecordName(certbotDomain) {
    const zone = HOSTINGER_ZONE_DOMAIN;

    if (certbotDomain === zone) {
        return "_acme-challenge";
    }

    if (!certbotDomain.endsWith(`.${zone}`)) {
        throw new Error(
            `O domínio ${certbotDomain} não pertence à zona ${zone}`
        );
    }

    const subdomain = certbotDomain.slice(0, -(zone.length + 1));

    return `_acme-challenge.${subdomain}`;
}

function buildFqdn(recordName) {
    return `${recordName}.${HOSTINGER_ZONE_DOMAIN}`;
}

async function hostingerRequest(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${HOSTINGER_API_TOKEN}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(options.headers || {}),
        },
    });

    const text = await response.text();

    let body = null;

    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }
    }

    if (!response.ok) {
        throw new Error(
            `Hostinger API erro ${response.status}: ${JSON.stringify(body)}`
        );
    }

    return body;
}

async function getDnsRecords() {
    return hostingerRequest(`/api/dns/v1/zones/${HOSTINGER_ZONE_DOMAIN}`, {
        method: "GET",
    });
}

async function upsertTxtRecord(recordName, validationValue) {
    console.log(`[auth] Criando TXT ${recordName} = ${validationValue}`);

    await hostingerRequest(`/api/dns/v1/zones/${HOSTINGER_ZONE_DOMAIN}`, {
        method: "PUT",
        body: JSON.stringify({
            overwrite: false,
            zone: [
                {
                    name: recordName,
                    type: "TXT",
                    ttl: Number(DNS_TTL),
                    records: [
                        {
                            content: validationValue,
                        },
                    ],
                },
            ],
        }),
    });
}

async function removeTxtRecord(recordName, validationValue) {
    console.log(`[cleanup] Removendo TXT ${recordName} = ${validationValue}`);

    const records = await getDnsRecords();

    const target = records.find(
        (item) => item.name === recordName && item.type === "TXT"
    );

    if (!target) {
        console.log("[cleanup] Registro TXT não encontrado. Nada a remover.");
        return;
    }

    const normalizedValidation = normalizeTxtValue(validationValue);

    const remainingRecords = target.records
        .filter((record) => normalizeTxtValue(record.content) !== normalizedValidation)
        .map((record) => ({ content: normalizeTxtValue(record.content) }));

    if (remainingRecords.length > 0) {
        await hostingerRequest(`/api/dns/v1/zones/${HOSTINGER_ZONE_DOMAIN}`, {
            method: "PUT",
            body: JSON.stringify({
                overwrite: true,
                zone: [
                    {
                        name: recordName,
                        type: "TXT",
                        ttl: target.ttl || Number(DNS_TTL),
                        records: remainingRecords,
                    },
                ],
            }),
        });

        console.log("[cleanup] TXT removido mantendo outros valores existentes.");
        return;
    }

    await hostingerRequest(`/api/dns/v1/zones/${HOSTINGER_ZONE_DOMAIN}`, {
        method: "DELETE",
        body: JSON.stringify({
            filters: [
                {
                    name: recordName,
                    type: "TXT",
                },
            ],
        }),
    });

    console.log("[cleanup] TXT removido completamente.");
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
    buildAcmeRecordName,
    buildFqdn,
    upsertTxtRecord,
    removeTxtRecord,
    waitForPropagation,
};