import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// IMPORTANTE: ¿Está esta línea?
import { AuthProvider } from './context/AuthContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* IMPORTANTE: ¿Está App dentro de AuthProvider? */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)