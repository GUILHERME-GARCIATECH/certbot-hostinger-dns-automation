#!/usr/bin/env node

const {
  buildAcmeRecordName,
  removeTxtRecord,
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

  console.log(`[cleanup] Domínio recebido: ${certbotDomain}`);
  console.log(`[cleanup] Registro TXT relativo: ${recordName}`);

  await removeTxtRecord(recordName, validation);
}

main().catch((error) => {
  console.error(`[cleanup] Erro: ${error.message}`);
  process.exit(1);
});
