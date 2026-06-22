# Agente WhatsApp — HYBRID

Agente de IA que atiende por WhatsApp a potenciales clientes del estudio de
entrenamiento **HYBRID**. Indaga al interesado, recomienda la modalidad, agenda
la clase de prueba gratis (guardándola en una base de datos) y te avisa a ti por
WhatsApp tanto cuando se agenda como cuando un interesado no concreta.

Stack: **Vercel AI SDK** + **OpenRouter** (modelo IA) + **Kapso** (WhatsApp) +
**Express** + **SQLite**.

## Funcionalidades

- Conversa en español, estilo WhatsApp, e indaga: nombre, edad, objetivo y nivel de actividad.
- Conoce modalidades (musculación, HYROX recreativo, HYROX competitivo a distancia) y horarios.
- Agenda la **clase de prueba gratis** usando una herramienta y la guarda en SQLite.
- Te avisa por WhatsApp cuando se agenda una clase y cuando un lead no concreta.
- Endpoint `GET /agendados` para ver todos los agendamientos en JSON.

## Configuración

Copia `.env.example` a `.env` y completa:

```
OPENROUTER_API_KEY=   # tu key de OpenRouter
KAPSO_API_KEY=        # tu key de Kapso
OPENROUTER_MODEL=google/gemini-3.1-flash-lite
WEBHOOK_VERIFY_TOKEN=hybrid-asu-verify   # el que pongas también en Kapso/Meta
OWNER_PHONE=+595993374814                # tu WhatsApp para los avisos
PORT=3000
```

## Correr en local

```bash
npm install
npm start
```

Para exponerlo a internet mientras pruebas: `ngrok http 3000`.

## Despliegue 24/7 con Docker (recomendado)

Requisitos: Docker y Docker Compose instalados en un servidor (VPS).

```bash
# 1. Clonar el repo y entrar
git clone <tu-repo> && cd agentews

# 2. Crear el .env con tus credenciales (ver sección arriba)
cp .env.example .env && nano .env

# 3. Levantar el contenedor (se reconstruye e inicia en segundo plano)
docker compose up -d --build

# Ver logs
docker compose logs -f

# Reiniciar / detener
docker compose restart
docker compose down
```

- `restart: unless-stopped` hace que el agente vuelva a levantarse solo si el
  servidor se reinicia o el proceso falla → corre 24/7.
- La base de datos se guarda en `./data/hybrid_asu.db` (volumen persistente), así
  que **no se pierde** aunque reconstruyas el contenedor.

## HTTPS gratis con Cloudflare Tunnel

No necesitás abrir puertos ni tener IP pública fija. Hay dos formas de correr el
túnel; elegí UNA.

### Opción A — cloudflared nativo en el host (Windows/Linux)

1. Cloudflare Zero Trust → **Networks → Tunnels → Create a tunnel** → Cloudflared.
2. Instalá el conector con el comando que te da Cloudflare, por ej. en Windows:
   ```
   cloudflared.exe service install <TU_TOKEN>
   ```
3. En la pestaña **Public Hostname** del túnel configurá:
   - Subdomain: `hybrid` (o el que quieras) + tu dominio
   - Service → Type: `HTTP`, URL: `http://localhost:3000`
4. Corré el agente (publica en `127.0.0.1:3000`):
   ```
   docker compose up -d --build
   ```
   Dejá el servicio `tunnel` COMENTADO en `docker-compose.yml`.

### Opción B — cloudflared dentro de Docker

1. Creá el túnel igual que arriba y copiá el **token**.
2. Pegalo en el `.env`: `CLOUDFLARE_TUNNEL_TOKEN=...`
3. En **Public Hostname** del túnel: Service `HTTP` → URL `http://agente:3000`.
4. Descomentá el servicio `tunnel` en `docker-compose.yml` y corré `docker compose up -d --build`.

### Conectar el webhook de Kapso

En el dashboard de Kapso → tu número de WhatsApp → editar → **webhook destination URL**:
```
https://hybrid.tudominio.com/webhook
```
Usá el mismo `WEBHOOK_VERIFY_TOKEN` que tenés en el `.env`.

## Ver los agendamientos

```bash
curl https://TU-DOMINIO/agendados
```

## Seguridad

No subas el archivo `.env` (ya está en `.gitignore`). Si tus credenciales se
expusieron, regéneralas en OpenRouter y Kapso.
