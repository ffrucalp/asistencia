import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'

export default function StudentsView({ user }) {
  const [students, setStudents]     = useState([])
  const [importing, setImporting]   = useState(false)
  const [importMsg, setImportMsg]   = useState(null)
  const [showForm, setShowForm]     = useState(false)
  const [newStudent, setNewStudent] = useState({ name: '', dni: '', commission: 1 })
  const [loading, setLoading]       = useState(true)
  const [editStudent, setEditStudent] = useState(null)  // alumno siendo editado
  const [editData, setEditData]     = useState({})
  const [saving, setSaving]         = useState(false)
  const fileRef = useRef(null)

  async function loadStudents() {
    setLoading(true)
    const { data } = await supabase.from('students').select('*').eq('active', true).order('name')
    setStudents(data || [])
    setLoading(false)
  }

  useEffect(() => { loadStudents() }, [])

  // ── CSV import ──────────────────────────────────────────────────────────────
  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportMsg(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      complete: async ({ data: rows }) => {
        let ok = 0, fail = 0
        const records = []
        for (const row of rows) {
          const name = (row.nombre || row.name || row.alumno || '').trim()
          const dni  = String(row.dni || row.documento || row.legajo || '').trim()
          const comm = parseInt(row.comision || row.commission || '') || 1
          if (!name) { fail++; continue }
          if (![1, 2].includes(comm)) { fail++; continue }
          records.push({ name, dni, commission: comm, active: true })
        }
        for (let i = 0; i < records.length; i += 50) {
          const { error } = await supabase
            .from('students')
            .upsert(records.slice(i, i + 50), { onConflict: 'name,commission', ignoreDuplicates: false })
          if (error) fail += records.slice(i, i + 50).length
          else ok += records.slice(i, i + 50).length
        }
        setImportMsg({ ok, fail })
        setImporting(false)
        loadStudents()
        if (fileRef.current) fileRef.current.value = ''
      },
      error: () => { setImportMsg({ ok: 0, fail: -1 }); setImporting(false) },
    })
  }

  // ── Manual add ──────────────────────────────────────────────────────────────
  async function addStudent(e) {
    e.preventDefault()
    if (!newStudent.name.trim()) return
    await supabase.from('students').upsert(
      { name: newStudent.name.trim(), dni: newStudent.dni.trim(), commission: Number(newStudent.commission), active: true },
      { onConflict: 'name,commission' }
    )
    setNewStudent({ name: '', dni: '', commission: 1 })
    setShowForm(false)
    loadStudents()
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  function openEdit(student) {
    setEditStudent(student)
    setEditData({ name: student.name, dni: student.dni || '', commission: student.commission })
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editData.name.trim()) return
    setSaving(true)
    await supabase.from('students').update({
      name: editData.name.trim(),
      dni: editData.dni.trim(),
      commission: Number(editData.commission),
    }).eq('id', editStudent.id)
    setSaving(false)
    setEditStudent(null)
    loadStudents()
  }

  // ── Deactivate ──────────────────────────────────────────────────────────────
  async function deactivate(id) {
    if (!confirm('¿Dar de baja a este alumno? No se borrarán sus datos de asistencia.')) return
    await supabase.from('students').update({ active: false }).eq('id', id)
    loadStudents()
  }

  const groups = [1, 2].map(c => ({ comm: c, list: students.filter(s => s.commission === c) }))

  return (
    <div className="view students-view">
      <div className="view-header">
        <div>
          <h2 className="view-title">Alumnos</h2>
          <p className="view-subtitle">{students.length} alumnos activos en total</p>
        </div>
        <div className="view-header-actions">
          <button className="btn btn-outline" onClick={() => setShowForm(f => !f)}>
            ＋ Agregar manualmente
          </button>
          <label className={`btn btn-primary ${importing ? 'btn-loading' : ''}`}>
            {importing ? '⏳ Importando…' : '📂 Importar CSV'}
            <input ref={fileRef} type="file" accept=".csv,.txt"
              onChange={handleFile} disabled={importing} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      <div className="hint-box">
        <strong>Formato CSV:</strong> columnas <code>nombre</code> (requerido), <code>dni</code> (opcional),
        <code>comision</code> (1 o 2, por defecto 1).
        <br /><em>Ejemplo:</em> <code>nombre,dni,comision</code> → <code>García Ana,40123456,1</code>
      </div>

      {importMsg && (
        <div className={`import-result ${importMsg.fail === -1 ? 'result-error' : importMsg.fail > 0 ? 'result-warn' : 'result-ok'}`}>
          {importMsg.fail === -1
            ? '⚠️ Error al leer el archivo.'
            : `✅ ${importMsg.ok} importados${importMsg.fail > 0 ? ` · ⚠️ ${importMsg.fail} con error` : ''}`}
          <button className="close-btn" onClick={() => setImportMsg(null)}>×</button>
        </div>
      )}

      {/* ── Formulario agregar ── */}
      {showForm && (
        <form className="add-form" onSubmit={addStudent}>
          <h3>Agregar alumno/a</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Nombre y apellido *</label>
              <input type="text" value={newStudent.name}
                onChange={e => setNewStudent(s => ({ ...s, name: e.target.value }))}
                placeholder="Apellido, Nombre" required />
            </div>
            <div className="form-group">
              <label>DNI</label>
              <input type="text" value={newStudent.dni}
                onChange={e => setNewStudent(s => ({ ...s, dni: e.target.value }))}
                placeholder="Opcional" />
            </div>
            <div className="form-group form-group-sm">
              <label>Comisión</label>
              <select value={newStudent.commission}
                onChange={e => setNewStudent(s => ({ ...s, commission: e.target.value }))}>
                <option value={1}>Comisión 1</option>
                <option value={2}>Comisión 2</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Guardar</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {/* ── Modal edición ── */}
      {editStudent && (
        <div className="modal-overlay" onClick={() => setEditStudent(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar alumno/a</h3>
              <button className="modal-close" onClick={() => setEditStudent(null)}>×</button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Nombre y apellido *</label>
                <input type="text" value={editData.name}
                  onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                  required autoFocus />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>DNI</label>
                <input type="text" value={editData.dni}
                  onChange={e => setEditData(d => ({ ...d, dni: e.target.value }))}
                  placeholder="Opcional" />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Comisión</label>
                <select value={editData.commission}
                  onChange={e => setEditData(d => ({ ...d, commission: e.target.value }))}>
                  <option value={1}>Comisión 1</option>
                  <option value={2}>Comisión 2</option>
                </select>
              </div>
              {editData.commission !== editStudent.commission && (
                <div className="edit-warn">
                  ⚠️ Estás cambiando de Comisión {editStudent.commission} a Comisión {editData.commission}.
                  Los registros de asistencia previos se mantienen asociados a la comisión original.
                </div>
              )}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '⏳ Guardando…' : '✅ Guardar cambios'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setEditStudent(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Tablas ── */}
      {loading ? (
        <p className="loading-text">Cargando alumnos…</p>
      ) : (
        groups.map(({ comm, list }) => (
          <div key={comm} className="commission-block">
            <h3 className="commission-heading">
              Comisión {comm}
              <span className="commission-count">{list.length} alumnos</span>
            </h3>
            {list.length === 0 ? (
              <div className="empty-state">No hay alumnos. Importá un CSV o agregá manualmente.</div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nombre / Apellido</th>
                      <th>DNI</th>
                      <th style={{ width: 120 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(s => (
                      <tr key={s.id}>
                        <td className="td-name">{s.name}</td>
                        <td className="td-muted">{s.dni || '—'}</td>
                        <td className="td-actions">
                          <button className="btn-edit-xs" onClick={() => openEdit(s)}>✏️ Editar</button>
                          <button className="btn-danger-xs" onClick={() => deactivate(s.id)}>Baja</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
