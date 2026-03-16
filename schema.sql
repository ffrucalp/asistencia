-- ═══════════════════════════════════════════════════════════
--  Asistencia – Filosofía General I · UCALP
--  Ejecutar en: Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════

-- 1. Profesores ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS professors (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO professors (name) VALUES
  ('Francisco Fernández Ruiz'),
  ('Joaquín Bussi'),
  ('Daniel Sabio')
ON CONFLICT DO NOTHING;

-- 2. Alumnos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT    NOT NULL,
  dni        TEXT    NOT NULL DEFAULT '',
  commission INTEGER NOT NULL CHECK (commission IN (1, 2)),
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, commission)
);

-- 3. Sesiones de clase (una por fecha × comisión × bloque horario) ──
--    hour_block 1 = primer bloque (16–17 h)
--    hour_block 2 = segundo bloque (18–19 h)
CREATE TABLE IF NOT EXISTS class_sessions (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE    NOT NULL,
  commission   INTEGER NOT NULL CHECK (commission IN (1, 2)),
  hour_block   INTEGER NOT NULL CHECK (hour_block IN (1, 2)),
  professor_id INTEGER REFERENCES professors(id),
  notes        TEXT    NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (date, commission, hour_block)
);

-- 4. Asistencia (una fila por alumno × fecha × hora) ───────
CREATE TABLE IF NOT EXISTS attendance (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID    NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       DATE    NOT NULL,
  hour_slot  INTEGER NOT NULL CHECK (hour_slot IN (16, 17, 18, 19)),
  commission INTEGER NOT NULL CHECK (commission IN (1, 2)),
  present    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, date, hour_slot)
);

-- Índices de consulta frecuente
CREATE INDEX IF NOT EXISTS idx_attendance_date       ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student    ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_commission ON attendance(commission);
CREATE INDEX IF NOT EXISTS idx_students_commission   ON students(commission);

-- ── Habilitar Realtime en la tabla de asistencia ───────────
-- (necesario para la sincronización en tiempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;

-- ── Deshabilitar RLS (seguridad por token en la URL) ───────
-- El sistema no necesita RLS porque el acceso está protegido
-- por tokens hardcodeados en la app.
ALTER TABLE professors    DISABLE ROW LEVEL SECURITY;
ALTER TABLE students      DISABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance    DISABLE ROW LEVEL SECURITY;

-- ── Verificación ───────────────────────────────────────────
SELECT 'Schema creado correctamente' AS status;
SELECT name FROM professors ORDER BY id;
