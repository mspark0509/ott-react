import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Home } from './pages/Home'
import { Movie } from './pages/Movie'
import { Series } from './pages/Series'
import { New } from './pages/New'
import { AnimatePage } from './pages/AnimatePage'
import { Heart } from './pages/Heart'
import { Login } from './pages/Login'
import { Join } from './pages/Join'
import { Profile } from './pages/Profile'
import { SelectMember } from './pages/SelectMember'
import { MovieDetail } from './pages/MovieDetail'
import { TvDetail } from './pages/TvDetail'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Sports as Football } from './pages/Sports'
import { Baseball } from './pages/Baseball'

function App() {

  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movie" element={<Movie />} />
        <Route path="/series" element={<Series />} />
        <Route path="/new" element={<New />} />
        <Route path="/animate" element={<AnimatePage />} />
        <Route path="/heart" element={<Heart />} />
        <Route path="/football" element={<Football />} />
        <Route path="/sports" element={<Baseball />} />
        <Route path="/baseball" element={<Navigate to="/sports" replace />} />
        
        <Route path="/movie/:id" element={<MovieDetail />} />
        <Route path="/tv/:id" element={<TvDetail />} />

        <Route path="/login" element={<Login />} />
        <Route path="/selectMember" element={<SelectMember />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/join" element={<Join />} />
      </Routes>
      <Footer />
    </>
  )
}

export default App
