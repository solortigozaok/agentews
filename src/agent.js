import { generateText, tool } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { guardarClasePrueba } from "./db.js";

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
    maxSteps: 4,
    tools: {
      agendarClasePrueba: {
        ...agendarClasePrueba,
        execute: async (args) => {
          const id = guardarClasePrueba({ ...args, telefono: from });
          console.log(`✅ Clase de prueba agendada (#${id}) para ${args.nombre} (${from})`);
          return { ok: true, id };
        },
      },
    },
  });

  history.push({ role: "assistant", content: text });
  conversations.set(from, history.slice(-MAX_TURNS));

  return text;
}
