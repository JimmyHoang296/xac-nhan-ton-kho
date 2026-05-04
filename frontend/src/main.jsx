import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PicApp from './pic/PicApp.jsx'

const isPic = window.location.pathname.startsWith('/pic');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPic ? <PicApp /> : <App />}
  </StrictMode>,
)
