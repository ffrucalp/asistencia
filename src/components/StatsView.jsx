import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const TOTAL_CLASSES = 15       // 15 lunes del cuatrimestre
const TOTAL_HOURS   = 60       // 15 × 4 horas
const THRESHOLD     = 0.75     // 75% para promocionar

function pct(present, total) {
  return total === 0 ? 0 : Math.round((present / total) * 100)
}

function statusFor(p) {
  if (p >= 75) return { label: '✅ Promociona', cls: 'status-ok' }
  if (p >= 50) return { label: '⚠️ En riesgo', cls: 'status-warn' }
  return { label: '❌ Insuficiente', cls: 'status-fail' }
}

export default function StatsView({ user }) {
  const commission = user.isAdmin ? 0 : 0  // stats shows all {
  const [stats, setStats]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [sortBy, setSortBy]       = useState('name')   // 'name' | 'pct' | 'commission'
  const [filterComm, setFilterComm] = useState(0)      // 0 = all

  useEffect(() => {
    async function load() {
      setLoading(true)

      let sq = supabase.from('students').select('*').eq('active', true).order('name')
      if (commission !== 0) sq = sq.eq('commission', commission)
      const { data: students } = await sq

      let aq = supabase.from('attendance').select('student_id, present').eq('present', true)
      if (commission !== 0) aq = aq.eq('commission', commission)
      const { data: att } = await aq

      const countMap = {}
      ;(att || []).forEach(r => {
        countMap[r.student_id] = (countMap[r.student_id] || 0) + 1
      })

      const result = (students || []).map(s => ({
        ...s,
        hoursPresent: countMap[s.id] || 0,
        pct: pct(countMap[s.id] || 0, TOTAL_HOURS),
      }))

      setStats(result)
      setLoading(false)
    }
    load()
  }, [commission])

  function exportCSV() {
    const header = ['Apellido y Nombre', 'DNI', 'Comisión', 'Horas presentes', 'Total horas', 'Porcentaje', 'Estado']
    const rows = sortedFiltered.map(s => [
      `"${s.name}"`,
      s.dni || '',
      s.commission,
      s.hoursPresent,
      TOTAL_HOURS,
      s.pct + '%',
      s.pct >= 75 ? 'PROMOCIONA' : s.pct >= 50 ? 'EN RIESGO' : 'INSUFICIENTE',
    ])
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `asistencia-filoI-${new Date().toISOString().split('T')[0]}.csv`,
    })
    a.click()
  }

  const visible = filterComm === 0 ? stats : stats.filter(s => s.commission === filterComm)
  const sortedFiltered = [...visible].sort((a, b) => {
    if (sortBy === 'pct') return b.pct - a.pct
    if (sortBy === 'commission') return a.commission - b.commission || a.name.localeCompare(b.name)
    return a.name.localeCompare(b.name, 'es')
  })

  const promoting   = stats.filter(s => s.pct >= 75).length
  const atRisk      = stats.filter(s => s.pct >= 50 && s.pct < 75).length
  const insufficient = stats.filter(s => s.pct < 50).length
  const avgPct      = stats.length ? Math.round(stats.reduce((a, s) => a + s.pct, 0) / stats.length) : 0

  if (loading) return <div className="view loading-text">Calculando estadísticas…</div>

  return (
    <div className="view stats-view">
      <div className="view-header">
        <div>
          <h2 className="view-title">Estadísticas de asistencia</h2>
          <p className="view-subtitle">
            {TOTAL_CLASSES} clases · {TOTAL_HOURS} horas totales · mínimo 75% para promocionar
          </p>
        </div>
        <button className="btn btn-primary" onClick={exportCSV}>
          ⬇️ Exportar CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="summary-row">
        <div className="summary-card card-green">
          <strong>{promoting}</strong>
          <span>Promocionan</span>
          <small>≥ 75%</small>
        </div>
        <div className="summary-card card-yellow">
          <strong>{atRisk}</strong>
          <span>En riesgo</span>
          <small>50–74%</small>
        </div>
        <div className="summary-card card-red">
          <strong>{insufficient}</strong>
          <span>Insuficiente</span>
          <small>&lt; 50%</small>
        </div>
        <div className="summary-card card-blue">
          <strong>{avgPct}%</strong>
          <span>Promedio gral.</span>
          <small>{stats.length} alumnos</small>
        </div>
      </div>

      {/* Filters */}
      <div className="stats-filters">
        <div className="filter-group">
          <label>Ordenar por</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="name">Nombre</option>
            <option value="pct">% Asistencia</option>
            {commission === 0 && <option value="commission">Comisión</option>}
          </select>
        </div>
        {commission === 0 && (
          <div className="filter-group">
            <label>Comisión</label>
            <select value={filterComm} onChange={e => setFilterComm(Number(e.target.value))}>
              <option value={0}>Todas</option>
              <option value={1}>Comisión 1</option>
              <option value={2}>Comisión 2</option>
            </select>
          </div>
        )}
      </div>

      {/* Stats table */}
      <div className="table-scroll">
        <table className="data-table stats-table">
          <thead>
            <tr>
              <th>Alumno/a</th>
              {commission === 0 && <th>Com.</th>}
              <th>Progreso</th>
              <th>%</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.map(s => {
              const status = statusFor(s.pct)
              const barColor = s.pct >= 75 ? '#16a34a' : s.pct >= 50 ? '#d97706' : '#dc2626'
              return (
                <tr key={s.id} className={`stat-row ${s.pct >= 75 ? 'srow-ok' : s.pct >= 50 ? 'srow-warn' : 'srow-fail'}`}>
                  <td className="td-name">
                    {s.name}
                    {s.dni && <span className="student-dni">{s.dni}</span>}
                  </td>
                  {commission === 0 && <td className="td-muted">Com. {s.commission}</td>}
                  <td className="td-progress">
                    <div className="progress-track">
                      <div
                        className="progress-bar"
                        style={{ width: `${s.pct}%`, background: barColor }}
                      />
                      <div
                        className="progress-threshold"
                        style={{ left: '75%' }}
                        title="75% mínimo"
                      />
                    </div>
                    <span className="progress-label">{s.hoursPresent}/{TOTAL_HOURS} h</span>
                  </td>
                  <td className="td-pct">
                    <strong style={{ color: barColor }}>{s.pct}%</strong>
                  </td>
                  <td>
                    <span className={`status-badge ${status.cls}`}>{status.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
