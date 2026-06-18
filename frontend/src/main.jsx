import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PicApp from './pic/PicApp.jsx'
import QlkvApp from './qlkv/QlkvApp.jsx'

const path = window.location.pathname;
const RootApp = path.startsWith('/pic')  ? PicApp
              : path.startsWith('/qlkv') ? QlkvApp
              : App;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
