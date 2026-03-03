import React from 'react'
import { Route, Routes } from 'react-router'
import ChatPage from "../components/ChatPage"
import App from "../App"
import ChatPage1 from '../components/ChatePage1'

const AppRoutes = () => {
  return (
    <Routes>
        <Route path='/' element={<App/>}/>
        <Route path='/chat' element={<ChatPage1 />}/>
        <Route path='*' element={<h1>404 Page Not Found</h1>}/>
    </Routes>
  )
}

export default AppRoutes
