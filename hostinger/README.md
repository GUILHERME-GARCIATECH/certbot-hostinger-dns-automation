# Certbot Hostinger DNS Automation

Automação para emissão e renovação de certificados SSL/TLS usando **Certbot**, desafio **DNS-01** e **Hostinger API**.

Este projeto foi criado para ambientes onde a porta pública `80` não está disponível ou não deve ser utilizada, tornando inviável a validação tradicional HTTP-01 do Certbot.

Com esta automação, o Certbot cria e remove registros TXT automaticamente na zona DNS da Hostinger durante o processo de validação do Let's Encrypt.

---

## Pré-requisitos

- Linux
- Node.js 18+
- Certbot
- NGINX
- Conta Hostinger com permissão de gerenciamento DNS
- Token da API Hostinger
- Domínio com DNS gerenciado pela Hostinger

---

## Fluxo da automação

```text
Certbot inicia emissão/renovação
↓
Certbot chama auth.js
↓
auth.js cria registro TXT na Hostinger (PUT com overwrite: false)
↓
auth.js aguarda propagação DNS
↓
Let's Encrypt valida o domínio
↓
Certbot chama cleanup.js
↓
cleanup.js remove o TXT temporário
↓
Certificado é emitido/renovado
↓
NGINX testa configuração e recarrega
```

---

## Estrutura do projeto

```text
/opt/certbot-hostinger
├── .env
├── auth.js
├── cleanup.js
├── hostinger-dns.js
├── package.json
├── package-lock.json
└── node_modules/
```

---

## Função de cada arquivo

| Arquivo | Função |
|---|---|
| `.env` | Token da Hostinger e configurações da zona DNS |
| `auth.js` | Hook chamado pelo Certbot para criar o TXT |
| `cleanup.js` | Hook chamado pelo Certbot para remover o TXT |
| `hostinger-dns.js` | Biblioteca interna com a lógica de DNS e API |
| `package.json` | Dependências do projeto Node.js |
| `node_modules/` | Dependências instaladas pelo npm |

---

## Instalação

Crie a pasta do projeto:

```bash
sudo mkdir -p /opt/certbot-hostinger
cd /opt/certbot-hostinger
```

Copie os arquivos:

```bash
sudo cp auth.js cleanup.js hostinger-dns.js package.json /opt/certbot-hostinger/
```

Instale as dependências:

```bash
cd /opt/certbot-hostinger
npm install
```

---

## Configuração do `.env`

```bash
sudo nano /opt/certbot-hostinger/.env
```

Conteúdo:

```env
HOSTINGER_API_TOKEN=cole-seu-token-aqui
HOSTINGER_ZONE_DOMAIN=exemplo.com
DNS_PROPAGATION_TIMEOUT_SECONDS=600
DNS_PROPAGATION_INTERVAL_SECONDS=15
DNS_TTL=300
```

### Variáveis

| Variável | Descrição |
|---|---|
| `HOSTINGER_API_TOKEN` | Token da API da Hostinger |
| `HOSTINGER_ZONE_DOMAIN` | Domínio raiz da zona DNS |
| `DNS_PROPAGATION_TIMEOUT_SECONDS` | Tempo máximo aguardando propagação (padrão: 600) |
| `DNS_PROPAGATION_INTERVAL_SECONDS` | Intervalo entre consultas DNS (padrão: 15) |
| `DNS_TTL` | TTL do registro TXT em segundos (padrão: 300) |

Permissões recomendadas:

```bash
sudo chown root:root /opt/certbot-hostinger/.env
sudo chmod 600 /opt/certbot-hostinger/.env
```

---

## Permissões dos scripts

```bash
sudo chmod +x /opt/certbot-hostinger/auth.js
sudo chmod +x /opt/certbot-hostinger/cleanup.js
```

---

## Teste manual seguro

Criar TXT:

```bash
sudo CERTBOT_DOMAIN=certbot-test.exemplo.com \
CERTBOT_VALIDATION=teste-seguro-123456 \
node /opt/certbot-hostinger/auth.js
```

Verificar TXT:

```bash
dig TXT _acme-challenge.certbot-test.exemplo.com +short
```

Remover TXT:

```bash
sudo CERTBOT_DOMAIN=certbot-test.exemplo.com \
CERTBOT_VALIDATION=teste-seguro-123456 \
node /opt/certbot-hostinger/cleanup.js
```

---

## Emitindo um certificado

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  --manual-auth-hook /opt/certbot-hostinger/auth.js \
  --manual-cleanup-hook /opt/certbot-hostinger/cleanup.js \
  -d n8n.exemplo.com
```

---

## Renovação automática

```bash
# Verificar timer
systemctl status certbot.timer

# Testar renovação
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

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## Problemas comuns

### Erro 403 — `Customer does not own domain`

- Token criado em conta sem permissão real sobre a zona DNS
- Domínio comprado em outra conta
- DNS não gerenciado pela Hostinger

Solução: gerar token na conta proprietária do domínio e confirmar nameservers.

### TXT não some depois do cleanup

O script remove somente o valor gerado na execução atual do Certbot. Isso é intencional para não apagar registros de outras validações simultâneas.

---

## Comandos úteis

```bash
sudo certbot certificates
sudo certbot renew --dry-run
systemctl status certbot.timer
dig TXT _acme-challenge.subdominio.exemplo.com +short
sudo nginx -t
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

---

## Licença

MIT
