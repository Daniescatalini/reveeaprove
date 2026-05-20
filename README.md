# ReveeAprove

Plataforma SaaS da Revee Brand para calendário, fluxo, prévia de feed, aprovação de conteúdos, equipe, clientes, assinatura e indicação.

## Rodar localmente

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Abra:

```text
http://127.0.0.1:3000
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
SUPABASE_SERVICE_ROLE_KEY
ASAAS_API_KEY
ASAAS_API_URL
ASAAS_WEBHOOK_TOKEN
REVEE_ADMIN_SECRET
```

## Webhook Asaas

Cadastre no Asaas:

```text
https://seu-dominio.com/api/asaas/webhook
```

Enquanto estiver testando localmente, use uma URL pública de túnel apontando para `/api/asaas/webhook`.
