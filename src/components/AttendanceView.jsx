import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export const PROFESSORS = [
  { id: 1, name: 'Francisco Fernández Ruiz' },
  { id: 2, name: 'Joaquín Bussi' },
  { id: 3, name: 'Daniel Sabio' },
]

export const HOURS = [16, 17, 18, 19]

// Bloque 1 = 16–18 h (horas 16 y 17)
// Bloque 2 = 18–20 h (horas 18 y 19)
export const HOUR_BLOCKS = [
  { block: 1, label: '16–18 h', hours: [16, 17] },
  { block: 2, label: '18–20 h', hours: [18, 19] },
]

export function blockOfHour(h) { return h < 18 ? 1 : 2 }

export function getSemesterMondays() {
  const mondays = []
  const start = new Date(2026, 2, 16)
  const end   = new Date(2026, 5, 29)
  let d = new Date(start)
  while (d <= end) {
    mondays.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 7)
  }
  return mondays
}

export function fmtDate(iso) {
  const [y, m, d] = iso.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function getDefaultDate() {
  const mondays = getSemesterMondays()
  const today = new Date().toISOString().split('T')[0]
  const past = mondays.filter(m => m <= today)
  return past.length > 0 ? past[past.length - 1] : mondays[0]
}

// ── Selector de comisión + bloque para profesores no-admin ────────────────────
function BlockSelector({ professorName, onSelect }) {
  const [comm,  setComm]  = useState(null)
  const [block, setBlock] = useState(null)

  function confirm() {
    if (comm && block) onSelect(comm, block)
  }

  return (
    <div className="block-selector-screen">
      <div className="block-selector-box">
        <div className="block-selector-header">
          <div className="block-selector-icon">📋</div>
          <h2>¿En qué estás hoy?</h2>
          <p className="block-selector-sub">Hola, <strong>{professorName}</strong>. Seleccioná tu comisión y bloque para empezar a tomar asistencia.</p>
        </div>

        <div className="block-selector-section">
          <div className="block-selector-label">Comisión</div>
          <div className="block-selector-options">
            {[1, 2].map(c => (
              <button
                key={c}
                className={`block-option ${comm === c ? 'block-option-active' : ''}`}
                onClick={() => setComm(c)}
              >
                <span className="block-option-title">Comisión {c}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="block-selector-section">
          <div className="block-selector-label">Bloque horario</div>
          <div className="block-selector-options">
            {HOUR_BLOCKS.map(({ block: b, label }) => (
              <button
                key={b}
                className={`block-option ${block === b ? 'block-option-active' : ''}`}
                onClick={() => setBlock(b)}
              >
                <span className="block-option-title">{label}</span>
                <span className="block-option-sub">
                  {b === 1 ? 'Primeras 2 horas' : 'Últimas 2 horas'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          className={`btn btn-primary block-confirm-btn ${(!comm || !block) ? 'btn-disabled' : ''}`}
          onClick={confirm}
          disabled={!comm || !block}
        >
          Empezar →
        </button>
      </div>
    </div>
  )
}

// ── Vista principal de asistencia ─────────────────────────────────────────────
export default function AttendanceView({ user }) {
  const { professorId, isAdmin } = user
  const MONDAYS = getSemesterMondays()

  // Para no-admin: pide comisión + bloque antes de mostrar la grilla
  const [selectedComm,  setSelectedComm]  = useState(isAdmin ? 0 : null)
  const [selectedBlock, setSelectedBlock] = useState(isAdmin ? 0 : null)

  const [selectedDate, setSelectedDate] = useState(getDefaultDate())
  const [students, setStudents]         = useState([])
  const [attendance, setAttendance]     = useState({})
  const [profSessions, setProfSessions] = useState({})
  const [saving, setSaving]             = useState(false)
  const [lastSaved, setLastSaved]       = useState(null)
  const [syncPulse, setSyncPulse]       = useState(false)
  const [error, setError]               = useState(null)

  // Si no es admin y aún no eligió, mostrar selector
  if (!isAdmin && (selectedComm === null || selectedBlock === null)) {
    return (
      <BlockSelector
        professorName={user.name}
        onSelect={(c, b) => { setSelectedComm(c); setSelectedBlock(b) }}
      />
    )
  }

  // Determinar qué comisiones y horas mostrar
  const visibleComms = isAdmin ? [1, 2] : [selectedComm]
  const visibleHours = isAdmin
    ? HOURS
    : HOUR_BLOCKS.find(b => b.block === selectedBlock).hours

  return (
    <AttendanceGrid
      user={user}
      MONDAYS={MONDAYS}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      visibleComms={visibleComms}
      visibleHours={visibleHours}
      selectedComm={selectedComm}
      selectedBlock={selectedBlock}
      profSessions={profSessions}
      setProfSessions={setProfSessions}
      saving={saving}
      setSaving={setSaving}
      lastSaved={lastSaved}
      setLastSaved={setLastSaved}
      syncPulse={syncPulse}
      setSyncPulse={setSyncPulse}
      error={error}
      setError={setError}
      onChangeBlock={isAdmin ? null : () => { setSelectedComm(null); setSelectedBlock(null) }}
    />
  )
}

// ── Grilla de asistencia (componente interno) ─────────────────────────────────
function AttendanceGrid({
  user, MONDAYS, selectedDate, setSelectedDate,
  visibleComms, visibleHours, selectedComm, selectedBlock,
  profSessions, setProfSessions,
  saving, setSaving, lastSaved, setLastSaved,
  syncPulse, setSyncPulse, error, setError, onChangeBlock,
}) {
  const { professorId, isAdmin } = user
  const [students,   setStudents]   = useState([])
  const [attendance, setAttendance] = useState({})

  // ── Load students ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      let q = supabase.from('students').select('*').eq('active', true).order('name')
      if (!isAdmin) q = q.eq('commission', selectedComm)
      const { data, error } = await q
      if (error) setError(error.message)
      else setStudents(data || [])
    }
    load()
  }, [selectedComm, isAdmin])

  // ── Load attendance + sessions ─────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      let attQ = supabase.from('attendance').select('*').eq('date', selectedDate)
      if (!isAdmin) attQ = attQ.eq('commission', selectedComm)
      const { data: attData } = await attQ

      const map = {}
      ;(attData || []).forEach(r => { map[`${r.student_id}-${r.hour_slot}`] = r.present })
      setAttendance(map)

      let sessQ = supabase.from('class_sessions').select('*').eq('date', selectedDate)
      if (!isAdmin) sessQ = sessQ.eq('commission', selectedComm)
      const { data: sessData } = await sessQ

      const newProf = {}
      ;(sessData || []).forEach(s => {
        newProf[`${s.commission}-${s.hour_block}`] = s.professor_id
      })
      setProfSessions(newProf)
    }
    load()
  }, [selectedDate, selectedComm, isAdmin])

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`att-${selectedDate}-${selectedComm}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        (payload) => {
          const r = payload.new || payload.old
          if (!r || r.date !== selectedDate) return
          if (!isAdmin && r.commission !== selectedComm) return
          setAttendance(prev => ({
            ...prev,
            [`${r.student_id}-${r.hour_slot}`]: payload.eventType === 'DELETE' ? false : r.present,
          }))
          setSyncPulse(true)
          setTimeout(() => setSyncPulse(false), 1500)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedDate, selectedComm, isAdmin])

  // ── Toggle ─────────────────────────────────────────────────────────────────
  const toggle = useCallback(async (studentId, hour, studentCommission) => {
    const key = `${studentId}-${hour}`
    const current = attendance[key] ?? false
    const next = !current
    setAttendance(prev => ({ ...prev, [key]: next }))
    setSaving(true)
    const { error } = await supabase.from('attendance').upsert(
      { student_id: studentId, date: selectedDate, hour_slot: hour,
        commission: studentCommission, present: next, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,date,hour_slot' }
    )
    if (error) {
      setAttendance(prev => ({ ...prev, [key]: current }))
      setError('Error al guardar: ' + error.message)
    } else {
      setLastSaved(new Date())
    }
    setSaving(false)
  }, [attendance, selectedDate])

  // ── Mark all ───────────────────────────────────────────────────────────────
  async function markAll(present) {
    const newAtt = { ...attendance }
    const records = []
    const studentsToMark = isAdmin ? students : students.filter(s => s.commission === selectedComm)
    studentsToMark.forEach(s => {
      visibleHours.forEach(h => {
        newAtt[`${s.id}-${h}`] = present
        records.push({ student_id: s.id, date: selectedDate, hour_slot: h,
          commission: s.commission, present, updated_at: new Date().toISOString() })
      })
    })
    setAttendance(newAtt)
    setSaving(true)
    for (let i = 0; i < records.length; i += 100) {
      await supabase.from('attendance')
        .upsert(records.slice(i, i + 100), { onConflict: 'student_id,date,hour_slot' })
    }
    setSaving(false)
    setLastSaved(new Date())
  }

  // ── Save professor ─────────────────────────────────────────────────────────
  async function saveProf(comm, block, profId) {
    setProfSessions(prev => ({ ...prev, [`${comm}-${block}`]: profId }))
    await supabase.from('class_sessions').upsert(
      { date: selectedDate, commission: comm, hour_block: block, professor_id: profId },
      { onConflict: 'date,commission,hour_block' }
    )
  }

  // ── Auto-assign professor when non-admin loads a block ────────────────────
  useEffect(() => {
    if (isAdmin || !selectedComm || !selectedBlock) return
    const key = `${selectedComm}-${selectedBlock}`
    if (!profSessions[key]) {
      saveProf(selectedComm, selectedBlock, professorId)
    }
  }, [selectedDate, selectedComm, selectedBlock, isAdmin])

  // Grupos a mostrar
  const groups = isAdmin
    ? [1, 2].map(c => ({ comm: c, list: students.filter(s => s.commission === c) }))
    : [{ comm: selectedComm, list: students }]

  const totalPresences = Object.values(attendance).filter(Boolean).length

  return (
    <div className="view attendance-view">

      {/* ── Chip de contexto para no-admin ── */}
      {!isAdmin && (
        <div className="context-bar">
          <div className="context-chips">
            <span className="ctx-chip chip-blue">📚 Comisión {selectedComm}</span>
            <span className="ctx-chip chip-green">
              🕐 {HOUR_BLOCKS.find(b => b.block === selectedBlock)?.label}
            </span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onChangeBlock}>
            ← Cambiar bloque
          </button>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="controls-bar">
        <div className="ctrl-group">
          <label className="ctrl-label">Clase</label>
          <select className="ctrl-select" value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}>
            {MONDAYS.map((m, i) => {
              const isPast = m <= new Date().toISOString().split('T')[0]
              return (
                <option key={m} value={m}>
                  Clase {i + 1} — {fmtDate(m)}{!isPast ? ' (próxima)' : ''}
                </option>
              )
            })}
          </select>
        </div>

        {/* Selectores de profesor — sólo admin ve todos; no-admin ve sólo su bloque */}
        {isAdmin
          ? groups.map(({ comm }) =>
              HOUR_BLOCKS.map(({ block, label }) => (
                <div className="ctrl-group" key={`${comm}-${block}`}>
                  <label className="ctrl-label">Com. {comm} · {label}</label>
                  <select className="ctrl-select ctrl-select-sm"
                    value={profSessions[`${comm}-${block}`] || ''}
                    onChange={e => saveProf(comm, block, Number(e.target.value))}>
                    <option value="">— sin asignar —</option>
                    {PROFESSORS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              ))
            )
          : (
            <div className="ctrl-group">
              <label className="ctrl-label">Profesor asignado</label>
              <select className="ctrl-select ctrl-select-sm"
                value={profSessions[`${selectedComm}-${selectedBlock}`] || professorId}
                onChange={e => saveProf(selectedComm, selectedBlock, Number(e.target.value))}>
                {PROFESSORS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )
        }

        <div className="ctrl-group ctrl-actions">
          <button className="btn btn-outline" onClick={() => markAll(true)}>✅ Todos presentes</button>
          <button className="btn btn-outline" onClick={() => markAll(false)}>❌ Todos ausentes</button>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="status-bar">
        <div className="status-counts">
          <span className="status-chip chip-blue">👥 {students.length} alumnos</span>
          <span className="status-chip chip-green">✅ {totalPresences} presencias</span>
        </div>
        <div className="status-save">
          {saving && <span className="save-state saving">⏳ Guardando…</span>}
          {!saving && lastSaved && (
            <span className="save-state saved">
              ✅ Guardado {lastSaved.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {syncPulse && <span className="live-indicator">🔴 En tiempo real</span>}
        </div>
      </div>

      {error && (
        <div className="error-banner">
          ⚠️ {error} <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* ── Grilla ── */}
      {groups.map(({ comm, list }) => (
        <section key={comm} className="commission-block">
          {isAdmin && (
            <h3 className="commission-heading">
              Comisión {comm}
              <span className="commission-count">{list.length} alumnos</span>
            </h3>
          )}

          {list.length === 0 ? (
            <div className="empty-state">
              <p>No hay alumnos en esta comisión.</p>
              <p>Importalos desde la pestaña <strong>Alumnos</strong>.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="att-table">
                <thead>
                  <tr>
                    <th className="col-name">Alumno / a</th>
                    {visibleHours.map(h => (
                      <th key={h} className="col-hour">{h}:00 h</th>
                    ))}
                    <th className="col-total">
                      {isAdmin ? 'Clase' : HOUR_BLOCKS.find(b => b.block === selectedBlock)?.label}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(student => {
                    // Para no-admin: cuenta sólo las horas del bloque visible
                    const countHours = isAdmin ? HOURS : visibleHours
                    const present = countHours.filter(h => attendance[`${student.id}-${h}`]).length
                    const maxHours = isAdmin ? 4 : 2
                    return (
                      <tr key={student.id}
                        className={`att-row ${present === maxHours ? 'row-full' : present > 0 ? 'row-partial' : ''}`}>
                        <td className="cell-name">
                          <span className="student-name">{student.name}</span>
                          {student.dni && <span className="student-dni">{student.dni}</span>}
                        </td>
                        {visibleHours.map(h => {
                          const checked = attendance[`${student.id}-${h}`] ?? false
                          return (
                            <td key={h} className="cell-check">
                              <label className="check-label">
                                <input type="checkbox" className="check-input"
                                  checked={checked}
                                  onChange={() => toggle(student.id, h, student.commission)} />
                                <span className={`check-box ${checked ? 'checked' : ''}`}>
                                  {checked ? '✓' : ''}
                                </span>
                              </label>
                            </td>
                          )
                        })}
                        <td className="cell-total">
                          <span className={`hours-pill ${present === maxHours ? 'pill-full' : present > 0 ? 'pill-partial' : 'pill-absent'}`}>
                            {present}/{maxHours}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
