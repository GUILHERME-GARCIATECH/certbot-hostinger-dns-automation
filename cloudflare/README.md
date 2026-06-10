# Certbot Cloudflare DNS Automation

Automação para emissão e renovação de certificados SSL/TLS usando **Certbot**, desafio **DNS-01** e **Cloudflare API**.

Este projeto foi criado para ambientes onde a porta pública `80` não está disponível ou não deve ser utilizada, tornando inviável a validação tradicional HTTP-01 do Certbot.

Com esta automação, o Certbot cria e remove registros TXT automaticamente na zona DNS da Cloudflare durante o processo de validação do Let's Encrypt.

---

## Pré-requisitos

- Linux
- Node.js 18+
- Certbot
- NGINX
- Conta Cloudflare com domínio ativo
- API Token da Cloudflare com as permissões corretas

---

## Permissões necessárias no token da Cloudflare

Acesse **My Profile → API Tokens → Create Token** no painel da Cloudflare.

Crie um token personalizado com as seguintes permissões:

| Recurso | Permissão |
|---|---|
| Zone → Zone | Read |
| Zone → DNS | Edit |

Em **Zone Resources**, selecione **Include → Specific zone → seu-dominio.com**.

> Use um token com escopo restrito ao domínio em vez da Global API Key, seguindo o princípio de menor privilégio.

---

## Diferenças em relação à versão Hostinger

| Aspecto | Hostinger | Cloudflare |
|---|---|---|
| Identificação da zona | Nome do domínio na URL | Zone ID (UUID) resolvido automaticamente |
| Nome do registro TXT | Relativo (`_acme-challenge.sub`) | FQDN completo (`_acme-challenge.sub.exemplo.com`) |
| Criar registro | `PUT` com flag `overwrite` | `POST` — cada registro tem um ID único |
| Remover registro | Por nome e tipo | Por ID do registro |
| TTL padrão recomendado | 300 | 1 (Auto) |
| Múltiplos valores TXT | Agrupados num mesmo objeto | Registros independentes com IDs distintos |

---

## Fluxo da automação

```text
Certbot inicia emissão/renovação
↓
Certbot chama auth.js
↓
auth.js resolve o Zone ID via GET /zones
↓
auth.js cria registro TXT via POST /zones/{zone_id}/dns_records
↓
auth.js aguarda propagação DNS
↓
Let's Encrypt valida o domínio
↓
Certbot chama cleanup.js
↓
cleanup.js localiza o TXT pelo FQDN e conteúdo
↓
cleanup.js deleta o registro via DELETE /zones/{zone_id}/dns_records/{id}
↓
Certificado é emitido/renovado
↓
NGINX testa configuração e recarrega
```

---

## Estrutura do projeto

```text
/opt/certbot-cloudflare
├── .env
├── auth.js
├── cleanup.js
├── cloudflare-dns.js
├── package.json
├── package-lock.json
└── node_modules/
```

---

## Função de cada arquivo

| Arquivo | Função |
|---|---|
| `.env` | Token da Cloudflare e configurações da zona DNS |
| `auth.js` | Hook chamado pelo Certbot para criar o TXT |
| `cleanup.js` | Hook chamado pelo Certbot para remover o TXT |
| `cloudflare-dns.js` | Biblioteca interna com a lógica de DNS e API |
| `package.json` | Dependências do projeto Node.js |
| `node_modules/` | Dependências instaladas pelo npm |

---

## Instalação

Crie a pasta do projeto:

```bash
sudo mkdir -p /opt/certbot-cloudflare
cd /opt/certbot-cloudflare
```

Copie os arquivos:

```bash
sudo cp auth.js cleanup.js cloudflare-dns.js package.json /opt/certbot-cloudflare/
```

Instale as dependências:

```bash
cd /opt/certbot-cloudflare
npm install
```

---

## Configuração do `.env`

```bash
sudo nano /opt/certbot-cloudflare/.env
```

Conteúdo:

```env
CLOUDFLARE_API_TOKEN=cole-seu-token-aqui
CLOUDFLARE_ZONE_DOMAIN=exemplo.com
DNS_PROPAGATION_TIMEOUT_SECONDS=600
DNS_PROPAGATION_INTERVAL_SECONDS=15
DNS_TTL=1
```

### Variáveis

| Variável | Descrição |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token da API da Cloudflare |
| `CLOUDFLARE_ZONE_DOMAIN` | Domínio raiz da zona DNS |
| `DNS_PROPAGATION_TIMEOUT_SECONDS` | Tempo máximo aguardando propagação (padrão: 600) |
| `DNS_PROPAGATION_INTERVAL_SECONDS` | Intervalo entre consultas DNS (padrão: 15) |
| `DNS_TTL` | TTL do registro TXT. Use `1` para Auto ou um valor entre `60` e `86400` |

Permissões recomendadas:

```bash
sudo chown root:root /opt/certbot-cloudflare/.env
sudo chmod 600 /opt/certbot-cloudflare/.env
```

---

## Permissões dos scripts

```bash
sudo chmod +x /opt/certbot-cloudflare/auth.js
sudo chmod +x /opt/certbot-cloudflare/cleanup.js
```

---

## Teste manual seguro

Antes de usar com Certbot, teste com um subdomínio descartável.

Criar TXT:

```bash
sudo CERTBOT_DOMAIN=certbot-test.exemplo.com \
CERTBOT_VALIDATION=teste-seguro-123456 \
node /opt/certbot-cloudflare/auth.js
```

Verificar TXT:

```bash
dig TXT _acme-challenge.certbot-test.exemplo.com +short
```

Resultado esperado:

```text
"teste-seguro-123456"
```

Remover TXT:

```bash
sudo CERTBOT_DOMAIN=certbot-test.exemplo.com \
CERTBOT_VALIDATION=teste-seguro-123456 \
node /opt/certbot-cloudflare/cleanup.js
```

Confirmar remoção:

```bash
dig TXT _acme-challenge.certbot-test.exemplo.com +short
```

---

## Emitindo um certificado

Exemplo para `n8n.exemplo.com`:

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  --manual-auth-hook /opt/certbot-cloudflare/auth.js \
  --manual-cleanup-hook /opt/certbot-cloudflare/cleanup.js \
  -d n8n.exemplo.com
```

---

## Renovação automática

O Certbot instala um timer systemd que verifica os certificados duas vezes por dia:

```bash
systemctl status certbot.timer
```

Quando um certificado está próximo do vencimento, ele executa automaticamente os hooks configurados.

Teste de renovação:

```bash
sudo certbot renew --dry-run
```

---

## Reload automático do NGINX

```bash
sudo nano /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Conteúdo:

```bash
#!/bin/bash
nginx -t && systemctl reload nginx
```

Permissão:

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## Segurança

- Não versionar `.env`
- Não expor o token da Cloudflare
- Usar token com escopo restrito (Zone:Read + DNS:Edit apenas na zona necessária)
- Usar `chmod 600` no arquivo `.env`
- Testar com `--dry-run` antes de depender da renovação automática

---

## Problemas comuns

### Erro 403 — token sem permissão

Verifique se o token tem as permissões `Zone:Read` e `DNS:Edit` e se a zona correta está no escopo do token.

### Zona não encontrada

```text
Zona ativa não encontrada para o domínio: exemplo.com
```

Causas possíveis:
- Domínio não está ativo na Cloudflare (ainda em propagação de nameservers)
- `CLOUDFLARE_ZONE_DOMAIN` incorreto no `.env`
- Token sem permissão `Zone:Read`

### TXT não propaga no tempo esperado

A Cloudflare propaga TXT rapidamente (geralmente em segundos). Se necessário, reduza `DNS_PROPAGATION_INTERVAL_SECONDS`.

---

## Comandos úteis

```bash
# Ver certificados
sudo certbot certificates

# Testar renovação
sudo certbot renew --dry-run

# Ver timer
systemctl status certbot.timer

# Verificar TXT
dig TXT _acme-challenge.subdominio.exemplo.com +short

# Testar NGINX
sudo nginx -t

# Ver log do Certbot
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

---

## Licença

MIT
