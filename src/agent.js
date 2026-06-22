import { generateText, tool } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { guardarClasePrueba } from "./db.js";
import { sendWhatsAppText } from "./kapso.js";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const SYSTEM_PROMPT = `Eres el asistente virtual de HYBRID, un estudio de entrenamiento.
Atiendes por WhatsApp a personas interesadas (potenciales clientes) de forma cálida,
cercana, motivadora y profesional, en español. Respuestas cortas estilo chat.

== TU MISIÓN ==
Indagar al cliente de forma natural (NO como interrogatorio, una o dos preguntas por mensaje)
para conocer:
1. Nombre
2. Edad
3. Objetivo con el entrenamiento
4. Si es sedentario o ya está entrenando (nivel de actividad)

Con esa info, recomienda la modalidad que mejor le calce y BUSCA AGENDAR su CLASE DE PRUEBA GRATIS.

== MODALIDADES ==
Presenciales:
- Musculación con profe personalizado.
- HYROX recreativo.
Servicio a distancia:
- HYROX COMPETITIVO: planificaciones para quienes quieren competir en una carrera de HYROX.

== HORARIOS DE CLASES (presencial) ==
- Lunes a viernes: 6 a 10am / 12 a 14pm / 17 a 21pm.
- Sábados: HYROX en locaciones sorpresa.

== CLASE DE PRUEBA ==
Es GRATIS. Tu meta es lograr agendarla. Cuando el cliente acepte y tengas al menos su nombre,
la modalidad de interés y un día + horario, usa la herramienta "agendarClasePrueba" para
registrar el agendamiento. Después confírmale con entusiasmo que quedó agendado.

== LEAD QUE NO CONCRETA ==
Si la persona mostró interés real pero NO logra agendar (dice que lo va a pensar, pide tiempo,
se enfría, pone trabas o se despide sin agendar), usa la herramienta "avisarLeadSinAgendar"
UNA sola vez por conversación para notificar al equipo y que puedan hacer seguimiento.
No la uses si la persona solo saludó o aún están conversando con normalidad.

== REGLAS ==
- No inventes precios ni promociones; la clase de prueba es gratis, eso sí puedes afirmarlo.
- Si falta algún dato para agendar, pídelo amablemente antes de usar la herramienta.
- Usa emojis con moderación. Sé humano, no robótico.`;

const agendarClasePrueba = tool({
  description:
    "Registra en la base de datos una clase de prueba gratis agendada por un cliente. " +
    "Úsala solo cuando el cliente confirmó que quiere agendar y tienes al menos nombre, modalidad y día+horario.",
  parameters: z.object({
    nombre: z.string().describe("Nombre del cliente"),
    edad: z.number().optional().describe("Edad del cliente"),
    objetivo: z.string().optional().describe("Objetivo de entrenamiento del cliente"),
    nivel_actividad: z
      .string()
      .optional()
      .describe("Sedentario o ya entrenando / nivel de actividad"),
    modalidad: z
      .string()
      .describe("Modalidad de interés: musculación, hyrox recreativo o hyrox competitivo"),
    dia: z.string().describe("Día acordado para la clase de prueba"),
    horario: z.string().describe("Horario acordado dentro de los bloques disponibles"),
    notas: z.string().optional().describe("Cualquier nota o detalle adicional relevante"),
  }),
});

const avisarLeadSinAgendar = tool({
  description:
    "Notifica al equipo que un interesado mostró interés pero NO logró agendar la clase de prueba, " +
    "para hacer seguimiento. Úsala una sola vez por conversación.",
  parameters: z.object({
    nombre: z.string().optional().describe("Nombre del interesado si lo dio"),
    modalidad: z.string().optional().describe("Modalidad que le interesaba"),
    motivo: z
      .string()
      .describe("Por qué no concretó (lo va a pensar, falta de tiempo, duda de precio, etc.)"),
    resumen: z.string().describe("Resumen breve de lo conversado y datos que se alcanzaron a captar"),
  }),
});

// Memoria simple en RAM por número de teléfono (se reinicia al reiniciar el server).
const conversations = new Map();
const MAX_TURNS = 20;
// Evita avisar más de una vez por el mismo lead que no concretó.
const avisadosFrios = new Set();

async function avisarDueno(phoneNumberId, args, from, id) {
  const owner = process.env.OWNER_PHONE;
  if (!owner || !phoneNumberId) return;
  const msg =
    `🎉 Nueva clase de prueba agendada (#${id})\n\n` +
    `👤 Nombre: ${args.nombre}\n` +
    `🎂 Edad: ${args.edad ?? "-"}\n` +
    `🎯 Objetivo: ${args.objetivo ?? "-"}\n` +
    `🏃 Nivel: ${args.nivel_actividad ?? "-"}\n` +
    `💪 Modalidad: ${args.modalidad}\n` +
    `📅 Día: ${args.dia} | 🕐 Horario: ${args.horario}\n` +
    `📱 WhatsApp cliente: ${from}` +
    (args.notas ? `\n📝 Notas: ${args.notas}` : "");
  try {
    await sendWhatsAppText(phoneNumberId, owner, msg);
  } catch (err) {
    console.error("No se pudo avisar al dueño:", err.message);
  }
}

async function avisarLeadFrio(phoneNumberId, args, from) {
  const owner = process.env.OWNER_PHONE;
  if (!owner || !phoneNumberId) return;
  const msg =
    `⚠️ Interesado que NO concretó (hacer seguimiento)\n\n` +
    `👤 Nombre: ${args.nombre ?? "-"}\n` +
    `💪 Modalidad: ${args.modalidad ?? "-"}\n` +
    `🚧 Motivo: ${args.motivo}\n` +
    `📝 Resumen: ${args.resumen}\n` +
    `📱 WhatsApp cliente: ${from}`;
  try {
    await sendWhatsAppText(phoneNumberId, owner, msg);
  } catch (err) {
    console.error("No se pudo avisar lead frío:", err.message);
  }
}

export async function replyToMessage(from, userText, phoneNumberId) {
  const history = conversations.get(from) ?? [];
  history.push({ role: "user", content: userText });

  const { text } = await generateText({
    model: openrouter(process.env.OPENROUTER_MODEL || "google/gemini-3.1-flash-lite"),
    system: SYSTEM_PROMPT,
    messages: history,
    maxSteps: 4,
    tools: {
      agendarClasePrueba: {
        ...agendarClasePrueba,
        execute: async (args) => {
          const id = guardarClasePrueba({ ...args, telefono: from });
          console.log(`✅ Clase de prueba agendada (#${id}) para ${args.nombre} (${from})`);
          await avisarDueno(phoneNumberId, args, from, id);
          return { ok: true, id };
        },
      },
      avisarLeadSinAgendar: {
        ...avisarLeadSinAgendar,
        execute: async (args) => {
          if (avisadosFrios.has(from)) return { ok: true, repetido: true };
          avisadosFrios.add(from);
          console.log(`⚠️ Lead sin agendar avisado: ${from}`);
          await avisarLeadFrio(phoneNumberId, args, from);
          return { ok: true };
        },
      },
    },
  });

  history.push({ role: "assistant", content: text });
  conversations.set(from, history.slice(-MAX_TURNS));

  return text;
}
