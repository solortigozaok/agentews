import Database from "better-sqlite3";

const db = new Database("hybrid_asu.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS clases_prueba (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creado_en TEXT DEFAULT (datetime('now', 'localtime')),
    telefono TEXT,
    nombre TEXT,
    edad INTEGER,
    objetivo TEXT,
    nivel_actividad TEXT,
    modalidad TEXT,
    dia TEXT,
    horario TEXT,
    notas TEXT
  );
`);

const insertStmt = db.prepare(`
  INSERT INTO clases_prueba
    (telefono, nombre, edad, objetivo, nivel_actividad, modalidad, dia, horario, notas)
  VALUES
    (@telefono, @nombre, @edad, @objetivo, @nivel_actividad, @modalidad, @dia, @horario, @notas)
`);

export function guardarClasePrueba(data) {
  const info = insertStmt.run({
    telefono: data.telefono ?? null,
    nombre: data.nombre ?? null,
    edad: data.edad ?? null,
    objetivo: data.objetivo ?? null,
    nivel_actividad: data.nivel_actividad ?? null,
    modalidad: data.modalidad ?? null,
    dia: data.dia ?? null,
    horario: data.horario ?? null,
    notas: data.notas ?? null,
  });
  return info.lastInsertRowid;
}

export function listarClasesPrueba() {
  return db.prepare("SELECT * FROM clases_prueba ORDER BY id DESC").all();
}
