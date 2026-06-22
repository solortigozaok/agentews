import "dotenv/config";
import express from "express";
import { replyToMessage } from "./agent.js";
import { sendWhatsAppText } from "./kapso.js";

const app = express();
app.use(express.json());

// Healthcheck simple
app.get("/", (_req, res) => res.send("HYBRID ASU agent OK"));

// Verificación del webhook (Meta/Kapso hacen un GET con hub.challenge al configurarlo)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Recepción de mensajes entrantes (formato WhatsApp Cloud API que reenvía Kapso)
app.post("/webhook", async (req, res) => {
  // Responder rápido para que Kapso no reintente.
  res.sendStatus(200);

  try {
    const messages = extractMessages(req.body);
    for (const msg of messages) {
      const reply = await replyToMessage(msg.from, msg.text);
      await sendWhatsAppText(msg.phoneNumberId, msg.from, reply);
      console.log(`[${msg.from}] -> respondido`);
    }
  } catch (err) {
    console.error("Error procesando webhook:", err);
  }
});

// Extrae los mensajes de texto del payload de la WhatsApp Cloud API.
function extractMessages(body) {
  const out = [];
  const entries = body?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      for (const m of value?.messages ?? []) {
        if (m.type === "text" && m.text?.body) {
          out.push({ from: m.from, text: m.text.body, phoneNumberId });
        }
      }
    }
  }
  return out;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HYBRID ASU agent escuchando en puerto ${PORT}`);
  console.log(`Webhook: http://localhost:${PORT}/webhook`);
});
