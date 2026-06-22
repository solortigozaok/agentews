// Extrae mensajes de texto del payload, sea formato Meta crudo o formato
// propio de Kapso (v2), incluyendo lotes con buffering. Recorre el JSON y
// detecta objetos tipo mensaje (con remitente y texto) en cualquier nivel.
export function extractMessages(body) {
  const out = [];
  let fallbackPhoneId = process.env.KAPSO_PHONE_NUMBER_ID;

  // Captura cualquier phone_number_id presente en el payload como fallback.
  const phoneId = findFirst(body, ["phone_number_id", "phoneNumberId"]);
  if (phoneId) fallbackPhoneId = phoneId;

  walk(body, (node) => {
    // Mensaje tipo texto: { from, type:'text', text:{body} } o { from, text:'...' }
    const from = node.from ?? node.sender ?? node.wa_id;
    const text =
      typeof node.text === "string"
        ? node.text
        : node.text?.body ?? node.body ?? node.message?.text?.body;

    if (typeof from === "string" && typeof text === "string" && text.trim()) {
      const phoneNumberId =
        node.phone_number_id ?? node.phoneNumberId ?? fallbackPhoneId;
      out.push({ from, text, phoneNumberId });
    }
  });

  // Quita duplicados exactos (from+text).
  const seen = new Set();
  return out.filter((m) => {
    const key = `${m.from}|${m.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Recorre recursivamente objetos y arrays aplicando fn a cada nodo objeto.
function walk(node, fn) {
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, fn));
  } else if (node && typeof node === "object") {
    fn(node);
    Object.values(node).forEach((v) => walk(v, fn));
  }
}

// Busca el primer valor string para alguna de las claves dadas, en cualquier nivel.
function findFirst(node, keys) {
  let found;
  walk(node, (n) => {
    if (found) return;
    for (const k of keys) {
      if (typeof n[k] === "string") {
        found = n[k];
        return;
      }
    }
  });
  return found;
}
