import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import BienvenidoView from './components/BienvenidoView.tsx'
import { CompanyProvider } from './context/CompanyContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Standalone: fuera del shell de la app (sin sidebar/nav) y sin link desde ningún lado — solo por URL directa */}
        <Route path="/bienvenido" element={<BienvenidoView />} />
        <Route path="/*" element={<CompanyProvider><App /></CompanyProvider>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
