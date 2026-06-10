#!/usr/bin/env node

const {
  buildAcmeRecordFqdn,
  upsertTxtRecord,
  waitForPropagation,
} = require("./cloudflare-dns");

async function main() {
  const certbotDomain = process.env.CERTBOT_DOMAIN;
  const validation = process.env.CERTBOT_VALIDATION;

  if (!certbotDomain) {
    throw new Error("CERTBOT_DOMAIN não foi recebido do Certbot");
  }

  if (!validation) {
    throw new Error("CERTBOT_VALIDATION não foi recebido do Certbot");
  }

  const recordFqdn = buildAcmeRecordFqdn(certbotDomain);

  console.log(`[auth] Domínio recebido: ${certbotDomain}`);
  console.log(`[auth] Registro TXT completo: ${recordFqdn}`);

  await upsertTxtRecord(recordFqdn, validation);
  await waitForPropagation(recordFqdn, validation);
}

main().catch((error) => {
  console.error(`[auth] Erro: ${error.message}`);
  process.exit(1);
});
