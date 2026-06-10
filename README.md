# Certbot DNS-01 Automation

Automação para emissão e renovação de certificados SSL/TLS usando **Certbot** com desafio **DNS-01**.

Criado para ambientes onde a porta pública `80` não está disponível, tornando inviável a validação HTTP-01.

Suporta dois provedores DNS:

| Pasta | Provedor |
|---|---|
| [`hostinger/`](./hostinger/) | Hostinger DNS API |
| [`cloudflare/`](./cloudflare/) | Cloudflare DNS API |

---

## Quando usar cada versão

Use a versão **Hostinger** se o DNS do seu domínio ainda é gerenciado diretamente pela Hostinger.

Use a versão **Cloudflare** se você migrou os nameservers para a Cloudflare — por exemplo, para usar recursos como failover DNS, load balancing ou proxy reverso com proteção DDoS.

---

## Como funciona

O Certbot fornece automaticamente duas variáveis de ambiente para os hooks:

```text
CERTBOT_DOMAIN     — domínio sendo validado (ex: n8n.exemplo.com)
CERTBOT_VALIDATION — valor TXT gerado pelo Let's Encrypt
```

Os scripts criam o registro `_acme-challenge` temporariamente, aguardam propagação DNS, e removem o registro após a validação.

```text
Certbot inicia emissão/renovação
↓
auth.js cria _acme-challenge TXT no provedor DNS
↓
Aguarda propagação DNS
↓
Let's Encrypt valida
↓
cleanup.js remove o TXT
↓
Certificado emitido/renovado
↓
NGINX recarrega
```

---

## Diferenças técnicas entre os provedores

| Aspecto | Hostinger | Cloudflare |
|---|---|---|
| Autenticação | Bearer token | Bearer token |
| Identificação da zona | Nome do domínio na URL | Zone ID (UUID), resolvido automaticamente via `GET /zones`) |
| Nome do TXT enviado à API | Relativo: `_acme-challenge.sub` | FQDN completo: `_acme-challenge.sub.exemplo.com` |
| Criar registro | `PUT` com flag `overwrite: false` | `POST` — cada registro tem um ID único |
| Remover registro | Por nome e tipo (com suporte a múltiplos valores) | Por ID do registro (filtrado por FQDN + conteúdo) |
| TTL padrão recomendado | 300 segundos | 1 (Auto — Cloudflare define como 300s internamente) |

---

## Instalação rápida

Escolha a pasta correspondente ao seu provedor e siga o `README.md` interno:

- [hostinger/README.md](./hostinger/README.md)
- [cloudflare/README.md](./cloudflare/README.md)

Resumo geral:

```bash
# Exemplo para Cloudflare
sudo mkdir -p /opt/certbot-cloudflare
sudo cp cloudflare/auth.js cloudflare/cleanup.js cloudflare/cloudflare-dns.js cloudflare/package.json /opt/certbot-cloudflare/
cd /opt/certbot-cloudflare
sudo npm install
sudo cp cloudflare/example.env /opt/certbot-cloudflare/.env
sudo nano /opt/certbot-cloudflare/.env   # preencher token e domínio
sudo chmod 600 /opt/certbot-cloudflare/.env
sudo chmod +x /opt/certbot-cloudflare/auth.js /opt/certbot-cloudflare/cleanup.js
```

---

## Emissão de certificado

```bash
# Hostinger
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  --manual-auth-hook /opt/certbot-hostinger/auth.js \
  --manual-cleanup-hook /opt/certbot-hostinger/cleanup.js \
  -d n8n.exemplo.com

# Cloudflare
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  --manual-auth-hook /opt/certbot-cloudflare/auth.js \
  --manual-cleanup-hook /opt/certbot-cloudflare/cleanup.js \
  -d n8n.exemplo.com
```

---

## Requisitos

- Linux
- Node.js 18+
- Certbot
- NGINX

---

## Segurança

- Nunca versionar o arquivo `.env`
- Usar `chmod 600` no `.env`
- Usar tokens com escopo mínimo necessário
- Testar com `certbot renew --dry-run` antes de depender da renovação automática

---

## Licença

MIT
