import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getSemesterMondays, fmtDate, PROFESSORS, HOURS, HOUR_BLOCKS } from './AttendanceView'

export default function HistoryView({ user }) {
  const commission = user.isAdmin ? 0 : 0  // history shows all {
  const MONDAYS = getSemesterMondays()
  const today   = new Date().toISOString().split('T')[0]
  const past    = MONDAYS.filter(m => m <= today)

  const [summaries, setSummaries]       = useState([])
  const [selected, setSelected]         = useState(null)
  const [detail, setDetail]             = useState([])
  const [sessionProfs, setSessionProfs] = useState({})
  const [loadingDetail, setLoading]     = useState(false)

  useEffect(() => {
    async function load() {
      let q = supabase.from('attendance').select('date, commission, present')
      if (commission !== 0) q = q.eq('commission', commission)
      const { data: attData } = await q

      let sq = supabase.from('class_sessions').select('*')
      if (commission !== 0) sq = sq.eq('commission', commission)
      const { data: sessData } = await sq

      const sMap = {}
      ;(sessData || []).forEach(s => {
        sMap[`${s.date}-${s.commission}-${s.hour_block}`] = s.professor_id
      })
      setSessionProfs(sMap)

      const grouped = {}
      ;(attData || []).forEach(r => {
        const key = `${r.date}-${r.commission}`
        if (!grouped[key]) grouped[key] = { date: r.date, commission: r.commission, present: 0, total: 0 }
        grouped[key].total++
        if (r.present) grouped[key].present++
      })

      setSummaries(Object.values(grouped))
    }
    load()
  }, [commission])

  async function openDetail(date, comm) {
    setSelected({ date, commission: comm })
    setLoading(true)

    const [{ data: students }, { data: att }] = await Promise.all([
      supabase.from('students').select('*').eq('commission', comm).eq('active', true).order('name'),
      supabase.from('attendance').select('*').eq('date', date).eq('commission', comm),
    ])

    const attMap = {}
    ;(att || []).forEach(r => { attMap[`${r.student_id}-${r.hour_slot}`] = r.present })

    setDetail((students || []).map(s => ({
      ...s,
      hourPresent: HOURS.map(h => attMap[`${s.id}-${h}`] ?? false),
      total: HOURS.filter(h => attMap[`${s.id}-${h}`]).length,
    })))
    setLoading(false)
  }

  function getSummaryForDate(date, comm) {
    return summaries.find(s => s.date === date && s.commission === comm) || null
  }

  function profName(date, comm, block) {
    const id = sessionProfs[`${date}-${comm}-${block}`]
    if (!id) return null
    return PROFESSORS.find(p => p.id === id)?.name || null
  }

  const visibleComms = commission === 0 ? [1, 2] : [commission]

  return (
    <div className="view history-view">
      <h2 className="view-title">Historial de clases</h2>
      <p className="view-subtitle">
        {past.length} clases transcurridas · {MONDAYS.length - past.length} por venir
      </p>

      <div className="history-layout">
        <div className="history-list">
          {past.length === 0 && (
            <p className="empty-state">Las clases aún no han comenzado.</p>
          )}
          {[...past].reverse().map(date => (
            <div key={date} className="history-card">
              <div className="history-date">
                <span className="date-label">{fmtDate(date)}</span>
              </div>
              {visibleComms.map(comm => {
                const s = getSummaryForDate(date, comm)
                const isSelected = selected?.date === date && selected?.commission === comm
                const p1 = profName(date, comm, 1)
                const p2 = profName(date, comm, 2)
                return (
                  <button
                    key={comm}
                    className={`history-entry-btn ${s ? '' : 'entry-empty'} ${isSelected ? 'entry-active' : ''}`}
                    onClick={() => s && openDetail(date, comm)}
                    disabled={!s}
                  >
                    <span className="entry-comm">
                      {commission === 0 ? `Com. ${comm}` : 'Esta comisión'}
                    </span>
                    {s ? (
                      <>
                        <span className="entry-stats">{s.present}/{s.total} presencias</span>
                        <span className="entry-profs">
                          {p1 && <span title="16-17 h">{p1.split(' ').slice(-1)[0]}</span>}
                          {p1 && p2 && p1 !== p2 && <span className="entry-prof-sep">/</span>}
                          {p2 && p1 !== p2 && <span title="18-19 h">{p2.split(' ').slice(-1)[0]}</span>}
                        </span>
                        <span className="entry-arrow">›</span>
                      </>
                    ) : (
                      <span className="entry-no-data">Sin datos</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="history-detail">
          {!selected && (
            <div className="detail-placeholder">
              <p>Seleccioná una clase para ver el detalle de asistencia.</p>
            </div>
          )}

          {selected && (
            <>
              <div className="detail-header">
                <h3>{fmtDate(selected.date)}</h3>
                {commission === 0 && <span className="detail-comm">Comisión {selected.commission}</span>}
              </div>

              <div className="detail-profs">
                {HOUR_BLOCKS.map(({ block, label }) => {
                  const name = profName(selected.date, selected.commission, block)
                  return (
                    <div key={block} className="detail-prof-row">
                      <span className="detail-block-label">{label}</span>
                      <span className="detail-prof-name">
                        {name || <em className="no-prof">sin asignar</em>}
                      </span>
                    </div>
                  )
                })}
              </div>

              {loadingDetail ? (
                <p className="loading-text">Cargando...</p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table detail-table">
                    <thead>
                      <tr>
                        <th>Alumno/a</th>
                        {HOURS.map(h => <th key={h} className="th-hour">{h}h</th>)}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.map(s => (
                        <tr key={s.id}>
                          <td className="td-name">{s.name}</td>
                          {s.hourPresent.map((p, i) => (
                            <td key={i} className={`td-hour ${p ? 'td-present' : 'td-absent'}`}>
                              {p ? '✓' : '-'}
                            </td>
                          ))}
                          <td>
                            <span className={`hours-pill ${s.total === 4 ? 'pill-full' : s.total > 0 ? 'pill-partial' : 'pill-absent'}`}>
                              {s.total}/4
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
