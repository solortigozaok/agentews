// Cliente mínimo para enviar mensajes de WhatsApp a través del proxy de Kapso.
// Kapso expone la WhatsApp Cloud API de Meta en https://api.kapso.ai/meta/whatsapp

const BASE_URL = "https://api.kapso.ai/meta/whatsapp";

export async function sendWhatsAppText(phoneNumberId, to, body) {
  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.KAPSO_API_KEY,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Kapso send failed (${res.status}): ${errText}`);
  }
  return res.json();
}
