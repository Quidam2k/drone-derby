import { ReactNode } from 'react'
import { Box, CssBaseline } from '@mui/material'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import Header from './Header'
import Sidebar from './Sidebar'

interface LayoutProps {
  children: ReactNode
  showHeader?: boolean
  showSidebar?: boolean
}

const Layout = ({ 
  children, 
  showHeader = true, 
  showSidebar = true 
}: LayoutProps) => {
  const { sidebarOpen, sidebarWidth } = useSelector((state: RootState) => state.ui)
  const { isAuthenticated } = useSelector((state: RootState) => state.auth)
  
  const shouldShowSidebar = showSidebar && isAuthenticated
  const shouldShowHeader = showHeader
  
  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <CssBaseline />
      
      {shouldShowHeader && <Header />}
      
      {shouldShowSidebar && <Sidebar />}
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          marginLeft: shouldShowSidebar && sidebarOpen ? `${sidebarWidth}px` : 0,
          marginTop: shouldShowHeader ? '64px' : 0,
          transition: (theme) =>
            theme.transitions.create(['margin'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default Layout