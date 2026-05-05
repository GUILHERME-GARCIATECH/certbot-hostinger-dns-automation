# 🔐 Certbot Hostinger DNS Automation

Automação para emissão e renovação de certificados SSL/TLS usando **Certbot**, desafio **DNS-01** e **Hostinger API**.

Este projeto foi criado para ambientes onde a porta pública `80` não está disponível ou não deve ser utilizada, tornando inviável a validação tradicional HTTP-01 do Certbot.

Com esta automação, o Certbot consegue criar e remover registros TXT automaticamente na zona DNS da Hostinger durante o processo de validação do Let's Encrypt.

---

## 📌 Visão geral

Fluxo da automação:

```text
Certbot inicia emissão/renovação
↓
Certbot chama auth.js
↓
auth.js cria registro TXT na Hostinger
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

## 🎯 Caso de uso

Este projeto é útil para cenários como:

- Servidores com entrada externa apenas via HTTPS/443
- Ambientes onde a porta 80 não pode ser usada
- Infraestrutura com NGINX como proxy reverso
- Serviços internos expostos por subdomínios
- Certificados individuais por aplicação
- DNS gerenciado pela Hostinger
- Renovação automática sem intervenção manual

Exemplo de uso:

```text
n8n.example.com
zabbix.example.com
app.example.com
monitoramento.example.com
```

---

## 🧱 Arquitetura

```text
Internet
↓
Porta 443 HTTPS
↓
Firewall/Roteador
↓
Servidor NGINX
↓
Proxy reverso
↓
Serviços internos
```

A validação SSL não depende da porta 80.

Em vez disso, o Certbot usa o desafio DNS-01:

```text
Let's Encrypt
↓
Solicita TXT em _acme-challenge.subdominio.example.com
↓
Script cria TXT na Hostinger
↓
Let's Encrypt valida
↓
Script remove TXT
```

---

## 📂 Estrutura do projeto

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

## 🧩 Função de cada arquivo

| Arquivo | Função |
|---|---|
| `.env` | Armazena token da Hostinger e configurações da zona DNS |
| `auth.js` | Hook chamado pelo Certbot para criar o TXT |
| `cleanup.js` | Hook chamado pelo Certbot para remover o TXT |
| `hostinger-dns.js` | Biblioteca interna com a lógica de DNS e API |
| `package.json` | Dependências do projeto Node.js |
| `node_modules/` | Dependências instaladas pelo npm |

---

## ⚙️ Como funciona

O Certbot fornece automaticamente duas variáveis de ambiente para os hooks:

```text
CERTBOT_DOMAIN
CERTBOT_VALIDATION
```

Exemplo:

```text
CERTBOT_DOMAIN=n8n.example.com
CERTBOT_VALIDATION=abc123xyz
```

A automação transforma isso no seguinte registro DNS:

```text
Nome:  _acme-challenge.n8n
Tipo:  TXT
Valor: abc123xyz
```

Após a validação, o valor TXT é removido automaticamente.

---

## 🧠 Fluxo interno dos scripts

```text
Certbot
↓
auth.js
↓
hostinger-dns.js
↓
API da Hostinger
```

E depois:

```text
Certbot
↓
cleanup.js
↓
hostinger-dns.js
↓
API da Hostinger
```

O Certbot chama diretamente apenas:

```text
auth.js
cleanup.js
```

O arquivo `hostinger-dns.js` é uma biblioteca interna usada pelos dois scripts.

---

## ✅ Requisitos

- Linux
- Node.js 18+
- Certbot
- NGINX
- Conta Hostinger com permissão de gerenciamento DNS
- Token da API Hostinger
- Domínio usando DNS gerenciado pela Hostinger

---

## 📦 Instalação

Crie a pasta do projeto:

```bash
sudo mkdir -p /opt/certbot-hostinger
cd /opt/certbot-hostinger
```

Inicialize o projeto Node.js:

```bash
npm init -y
npm install dotenv
```

---

## 🔐 Configuração do `.env`

Crie o arquivo:

```bash
sudo nano /opt/certbot-hostinger/.env
```

Exemplo:

```env
HOSTINGER_API_TOKEN=COLE_SEU_TOKEN_AQUI
HOSTINGER_ZONE_DOMAIN=example.com
DNS_PROPAGATION_TIMEOUT_SECONDS=600
DNS_PROPAGATION_INTERVAL_SECONDS=15
DNS_TTL=300
```

### Variáveis

| Variável | Descrição |
|---|---|
| `HOSTINGER_API_TOKEN` | Token da API da Hostinger |
| `HOSTINGER_ZONE_DOMAIN` | Domínio raiz da zona DNS |
| `DNS_PROPAGATION_TIMEOUT_SECONDS` | Tempo máximo aguardando propagação |
| `DNS_PROPAGATION_INTERVAL_SECONDS` | Intervalo entre consultas DNS |
| `DNS_TTL` | TTL usado no TXT temporário |

Permissões recomendadas:

```bash
sudo chown root:root /opt/certbot-hostinger/.env
sudo chmod 600 /opt/certbot-hostinger/.env
```

---

## 🔑 Permissões dos scripts

```bash
sudo chmod +x /opt/certbot-hostinger/auth.js
sudo chmod +x /opt/certbot-hostinger/cleanup.js
```

Conferir arquivos:

```bash
ls -la /opt/certbot-hostinger
```

Resultado esperado:

```text
-rw------- .env
-rwxr-xr-x auth.js
-rwxr-xr-x cleanup.js
-rw-r--r-- hostinger-dns.js
-rw-r--r-- package.json
-rw-r--r-- package-lock.json
drwxr-xr-x node_modules
```

---

## 🧪 Teste manual seguro

Antes de usar com Certbot, teste com um subdomínio descartável.

Criar TXT:

```bash
sudo CERTBOT_DOMAIN=certbot-test.example.com \
CERTBOT_VALIDATION=teste-seguro-123456 \
node /opt/certbot-hostinger/auth.js
```

Verificar TXT:

```bash
dig TXT _acme-challenge.certbot-test.example.com +short
```

Resultado esperado:

```text
"teste-seguro-123456"
```

Remover TXT:

```bash
sudo CERTBOT_DOMAIN=certbot-test.example.com \
CERTBOT_VALIDATION=teste-seguro-123456 \
node /opt/certbot-hostinger/cleanup.js
```

Confirmar remoção:

```bash
dig TXT _acme-challenge.certbot-test.example.com +short
```

Resultado esperado:

```text
sem retorno
```

---

## 🚀 Emitindo um certificado

Exemplo para `n8n.example.com`:

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  --manual-auth-hook /opt/certbot-hostinger/auth.js \
  --manual-cleanup-hook /opt/certbot-hostinger/cleanup.js \
  -d n8n.example.com
```

Após a emissão, o Certbot salva a configuração em:

```text
/etc/letsencrypt/renewal/n8n.example.com.conf
```

Esse arquivo guarda os hooks usados, permitindo renovação automática futura.

---

## 🔁 Renovação automática

O Certbot normalmente instala um timer systemd:

```bash
systemctl status certbot.timer
```

Em muitos sistemas, ele roda duas vezes por dia:

```text
Run certbot twice daily
```

Isso não significa que o certificado será renovado duas vezes por dia.

O Certbot apenas verifica se algum certificado está próximo do vencimento.

Quando necessário, ele executa:

```bash
certbot renew
```

E chama automaticamente os hooks configurados.

---

## 🧪 Testando renovação

```bash
sudo certbot renew --dry-run
```

Resultado esperado:

```text
Congratulations, all simulated renewals succeeded
```

---

## 🔄 Reload automático do NGINX

Crie um deploy hook:

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

Assim, sempre que um certificado for renovado com sucesso, o NGINX será testado e recarregado automaticamente.

---

## ➕ Adicionando novos certificados

Para adicionar um novo subdomínio, emita o certificado uma vez usando o mesmo comando com os hooks.

Exemplo:

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  --manual-auth-hook /opt/certbot-hostinger/auth.js \
  --manual-cleanup-hook /opt/certbot-hostinger/cleanup.js \
  -d zabbix.example.com
```

Depois disso, o certificado entra automaticamente no ciclo de renovação do Certbot.

Verifique:

```bash
sudo certbot certificates
```

Teste:

```bash
sudo certbot renew --dry-run
```

---

## 🌐 Integração com NGINX

Exemplo de bloco para um serviço:

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    location / {
        proxy_pass http://IP_INTERNO:PORTA;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Ativar site:

```bash
sudo ln -s /etc/nginx/sites-available/app.example.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🛡️ Segurança

Recomendações:

- Não versionar `.env`
- Não expor o token da Hostinger
- Usar token da conta proprietária da zona DNS
- Proteger permissões do `.env`
- Usar `chmod 600` no arquivo de ambiente
- Fazer backup da zona DNS antes de grandes alterações
- Testar com `--dry-run` antes de depender da renovação automática
- Remover certificados de teste após validação
- Não remover registros DNS produtivos por engano

---

## 🧯 Problemas comuns

### Erro 403 na API da Hostinger

Erro comum:

```text
Customer does not own domain
```

Possíveis causas:

- Token criado em conta sem permissão real sobre a zona DNS
- Domínio comprado em outra conta
- Acesso delegado no painel, mas sem permissão via API
- DNS não gerenciado pela Hostinger

Solução:

- Gerar token na conta proprietária do domínio
- Confirmar nameservers
- Confirmar acesso à zona DNS via API

---

### TXT não some depois do cleanup

Possíveis causas:

- Cache DNS
- Registro TXT antigo de validação manual
- Valor salvo com aspas pela API
- Registro com múltiplos valores TXT

O script remove somente o valor gerado na execução atual do Certbot.

Isso é intencional para evitar apagar registros de outras validações.

---

### Certificado não renova no teste

Use:

```bash
sudo certbot renew --dry-run -v
```

Verifique logs:

```bash
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

---

### Certbot diz que o certificado não precisa renovar

Mensagem comum:

```text
Certificate not yet due for renewal
```

Isso significa que o certificado ainda está longe do vencimento.

Para testar o fluxo sem emitir certificado real, use:

```bash
sudo certbot renew --dry-run
```

---

## 🧰 Comandos úteis

Ver certificados:

```bash
sudo certbot certificates
```

Testar renovação:

```bash
sudo certbot renew --dry-run
```

Ver timer:

```bash
systemctl status certbot.timer
```

Ver próxima execução:

```bash
systemctl list-timers | grep certbot
```

Testar TXT:

```bash
dig TXT _acme-challenge.subdominio.example.com +short
```

Testar NGINX:

```bash
sudo nginx -t
```

Recarregar NGINX:

```bash
sudo systemctl reload nginx
```

Ver log do Certbot:

```bash
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

---

## 📋 Backup da zona DNS

Antes de alterações maiores, gere um backup da zona DNS:

```bash
cd /opt/certbot-hostinger

sudo bash -lc 'set -a; source /opt/certbot-hostinger/.env; set +a; curl -sS -H "Authorization: Bearer $HOSTINGER_API_TOKEN" -H "Content-Type: application/json" "https://developers.hostinger.com/api/dns/v1/zones/$HOSTINGER_ZONE_DOMAIN"' > dns-backup-$(date +%F-%H%M%S).json
```

Comparar backups:

```bash
diff -u dns-before.json dns-after.json
```

---

## ✅ Estado ideal

No dia a dia, o registro `_acme-challenge` não precisa existir.

Ele será criado temporariamente durante a renovação e removido em seguida.

Estado esperado:

```text
Certbot timer ativo
Certificados válidos
Dry-run funcionando
NGINX recarregando via deploy hook
TXT temporário sendo criado e removido automaticamente
```

---

## 🧠 Resumo final

```text
Certbot verifica periodicamente os certificados
↓
Quando um certificado está próximo do vencimento
↓
auth.js cria o TXT na Hostinger
↓
Let's Encrypt valida o domínio
↓
cleanup.js remove o TXT temporário
↓
Certificado é renovado
↓
NGINX testa configuração e recarrega
```

---

## 📄 Licença

MIT
