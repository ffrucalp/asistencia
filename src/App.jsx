import { useState, useEffect } from 'react'
import AttendanceView from './components/AttendanceView'
import StudentsView from './components/StudentsView'
import StatsView from './components/StatsView'
import HistoryView from './components/HistoryView'

// Un token por profesor. Configurables via variables de entorno.
const TOKENS = {
  [import.meta.env.VITE_TOKEN_FRANCISCO || 'francisco-filoI-2026']: {
    professorId: 1, name: 'Francisco Fernández Ruiz', isAdmin: true,
  },
  [import.meta.env.VITE_TOKEN_JOAQUIN || 'joaquin-filoI-2026']: {
    professorId: 2, name: 'Joaquín Bussi', isAdmin: false,
  },
  [import.meta.env.VITE_TOKEN_DANIEL || 'daniel-filoI-2026']: {
    professorId: 3, name: 'Daniel Sabio', isAdmin: false,
  },
}

const TABS = [
  { id: 'asistencia',    icon: '📋', label: 'Asistencia' },
  { id: 'alumnos',       icon: '👥', label: 'Alumnos' },
  { id: 'historial',     icon: '📅', label: 'Historial' },
  { id: 'estadisticas',  icon: '📊', label: 'Estadísticas' },
]

export default function App() {
  const [tab, setTab]           = useState('asistencia')
  const [user, setUser]         = useState(null)   // { professorId, name, isAdmin }
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (token && TOKENS[token]) {
      setUser(TOKENS[token])
    } else {
      setUnauthorized(true)
    }
  }, [])

  if (unauthorized) {
    return (
      <div className="unauth-screen">
        <div className="unauth-box">
          <div className="unauth-icon">🔒</div>
          <h2>Acceso restringido</h2>
          <p>Necesitás un enlace con token válido para acceder a este sistema.</p>
          <p className="unauth-contact">Contactá a Francisco Fernández Ruiz para obtener tu enlace.</p>
        </div>
      </div>
    )
  }

  if (!user) return <div className="loading-screen">Verificando acceso…</div>

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-left">
            <h1 className="header-title">Filosofía General I</h1>
            <div className="header-meta">
              <span className="meta-item">Lic. en Psicología</span>
              <span className="meta-sep">·</span>
              <span className="meta-item">UCALP</span>
              <span className="meta-sep">·</span>
              <span className="meta-item">Lunes 16–20 hs</span>
            </div>
          </div>
          <div className="header-right">
            <div className="user-pill">
              <span className="user-icon">{user.isAdmin ? '⚙️' : '👤'}</span>
              <span>{user.name}</span>
              {user.isAdmin && <span className="admin-badge">Admin</span>}
            </div>
          </div>
        </div>
      </header>

      <nav className="app-nav">
        <div className="nav-inner">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`nav-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="app-main">
        {tab === 'asistencia'   && <AttendanceView user={user} />}
        {tab === 'alumnos'      && <StudentsView   user={user} />}
        {tab === 'historial'    && <HistoryView    user={user} />}
        {tab === 'estadisticas' && <StatsView      user={user} />}
      </main>
    </div>
  )
}
