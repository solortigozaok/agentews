import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const SYSTEM_PROMPT = `Eres el asistente virtual de HYBRID ASU, un estudio de entrenamiento.
Tu trabajo es atender por WhatsApp a personas interesadas (potenciales clientes) de forma
cálida, cercana y profesional, en español.

Objetivos:
- Dar la bienvenida y responder dudas sobre el estudio (clases, horarios, planes, precios, ubicación).
- Detectar el interés de la persona y, cuando haya buena intención, invitarla a agendar una clase
  de prueba o dejar sus datos (nombre, objetivo de entrenamiento y horario preferido).
- Mantener respuestas cortas y claras (estilo chat de WhatsApp), con un tono motivador.

Reglas:
- Si no sabes un dato puntual (precio exacto, dirección, etc.), dilo con sinceridad y ofrece que
  un miembro del equipo le confirme, pidiendo sus datos de contacto.
- No inventes promociones ni precios.
- Usa emojis con moderación. Sé humano, no robótico.`;

// Memoria simple en RAM por número de teléfono (se reinicia al reiniciar el server).
const conversations = new Map();
const MAX_TURNS = 20;

export async function replyToMessage(from, userText) {
  const history = conversations.get(from) ?? [];
  history.push({ role: "user", content: userText });

  const { text } = await generateText({
    model: openrouter(process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini"),
    system: SYSTEM_PROMPT,
    messages: history,
  });

  history.push({ role: "assistant", content: text });
  // Limitar el historial para no crecer indefinidamente.
  conversations.set(from, history.slice(-MAX_TURNS));

  return text;
}
