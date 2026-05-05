#!/usr/bin/env node

const {
    buildAcmeRecordName,
    buildFqdn,
    upsertTxtRecord,
    waitForPropagation,
} = require("./hostinger-dns");

async function main() {
    const certbotDomain = process.env.CERTBOT_DOMAIN;
    const validation = process.env.CERTBOT_VALIDATION;

    if (!certbotDomain) {
        throw new Error("CERTBOT_DOMAIN não foi recebido do Certbot");
    }

    if (!validation) {
        throw new Error("CERTBOT_VALIDATION não foi recebido do Certbot");
    }

    const recordName = buildAcmeRecordName(certbotDomain);
    const fqdn = buildFqdn(recordName);

    console.log(`[auth] Domínio recebido: ${certbotDomain}`);
    console.log(`[auth] Registro TXT relativo: ${recordName}`);
    console.log(`[auth] Registro TXT completo: ${fqdn}`);

    await upsertTxtRecord(recordName, validation);
    await waitForPropagation(fqdn, validation);
}

main().catch((error) => {
    console.error(`[auth] Erro: ${error.message}`);
    process.exit(1);
});