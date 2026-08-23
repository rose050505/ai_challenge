import { Routes, Route, Link, NavLink } from 'react-router-dom'
import { DiagnosisProvider } from './lib/diagnosis-context.jsx'
import Landing from './pages/Landing.jsx'
import Diagnose from './pages/Diagnose.jsx'
import Document from './pages/Document.jsx'
import Strategy from './pages/Strategy.jsx'
import Next from './pages/Next.jsx'

const NAV = [
  { to: '/diagnose', label: '진단' },
  { to: '/document', label: '서식' },
  { to: '/strategy', label: '전략' },
  { to: '/next', label: '이후 절차' },
]

export default function App() {
  return (
    <DiagnosisProvider>
    <div className="min-h-screen">
      <header className="border-b no-print">
        <nav className="mx-auto flex max-w-3xl gap-4 p-4 text-sm">
          <Link to="/" className="font-semibold">왜요</Link>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => (isActive ? 'underline' : '')}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl p-4 print:max-w-none print:p-0">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/diagnose" element={<Diagnose />} />
          <Route path="/document" element={<Document />} />
          <Route path="/strategy" element={<Strategy />} />
          <Route path="/next" element={<Next />} />
          <Route path="*" element={<h1 className="text-xl font-bold">404</h1>} />
        </Routes>
      </main>
    </div>
    </DiagnosisProvider>
  )
}
