import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LobbyPage } from './components/lobby/LobbyPage'
import { GameLayout } from './components/layout/GameLayout'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/room/:roomId" element={<GameLayout />} />
      </Routes>
    </BrowserRouter>
  )
}
