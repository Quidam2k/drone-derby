import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Chip,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  SportsEsports as GameIcon,
  Edit as EditorIcon,
  ViewModule as BoardIcon,
  Collections as TemplateIcon,
  Add as AddIcon,
  History as HistoryIcon,
  TrendingUp as StatsIcon,
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { setSidebarOpen } from '@/store/slices/uiSlice'

const Sidebar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch<AppDispatch>()
  const { sidebarOpen, sidebarWidth } = useSelector((state: RootState) => state.ui)
  const { userGames } = useSelector((state: RootState) => state.game)
  const { userBoards } = useSelector((state: RootState) => state.board)
  
  const activeGamesCount = userGames.filter(game => 
    game.phase === 'programming' || game.phase === 'executing'
  ).length
  
  const menuItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
      section: 'main',
    },
    {
      text: 'Active Games',
      icon: <GameIcon />,
      path: '/games',
      section: 'games',
      badge: activeGamesCount > 0 ? activeGamesCount : undefined,
    },
    {
      text: 'Game History',
      icon: <HistoryIcon />,
      path: '/games/history',
      section: 'games',
    },
    {
      text: 'Level Editor',
      icon: <EditorIcon />,
      path: '/editor',
      section: 'creation',
    },
    {
      text: 'My Boards',
      icon: <BoardIcon />,
      path: '/boards/mine',
      section: 'creation',
      badge: userBoards.length > 0 ? userBoards.length : undefined,
    },
    {
      text: 'Browse Boards',
      icon: <BoardIcon />,
      path: '/boards',
      section: 'creation',
    },
    {
      text: 'Templates',
      icon: <TemplateIcon />,
      path: '/templates',
      section: 'creation',
    },
    {
      text: 'Create Game',
      icon: <AddIcon />,
      path: '/games/create',
      section: 'quick',
    },
  ]
  
  const sections = [
    { id: 'main', title: '' },
    { id: 'games', title: 'Games' },
    { id: 'creation', title: 'Creation' },
    { id: 'quick', title: 'Quick Actions' },
  ]
  
  const handleNavigate = (path: string) => {
    navigate(path)
    // Close sidebar on mobile
    if (window.innerWidth < 768) {
      dispatch(setSidebarOpen(false))
    }
  }
  
  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }
  
  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={sidebarOpen}
      sx={{
        width: sidebarWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: sidebarWidth,
          boxSizing: 'border-box',
          top: '64px', // Below header
          height: 'calc(100vh - 64px)',
          borderRight: 1,
          borderColor: 'divider',
        },
      }}
    >
      <Box sx={{ overflow: 'auto', py: 1 }}>
        {sections.map((section) => (
          <Box key={section.id}>
            {section.title && (
              <Typography
                variant="overline"
                sx={{
                  px: 2,
                  py: 1,
                  display: 'block',
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                }}
              >
                {section.title}
              </Typography>
            )}
            
            <List dense sx={{ px: 1 }}>
              {menuItems
                .filter(item => item.section === section.id)
                .map((item) => (
                  <ListItem key={item.path} disablePadding>
                    <ListItemButton
                      selected={isActive(item.path)}
                      onClick={() => handleNavigate(item.path)}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                        '&.Mui-selected': {
                          backgroundColor: 'primary.main',
                          color: 'primary.contrastText',
                          '&:hover': {
                            backgroundColor: 'primary.dark',
                          },
                          '& .MuiListItemIcon-root': {
                            color: 'primary.contrastText',
                          },
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 40,
                          color: isActive(item.path) ? 'inherit' : 'text.secondary',
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          fontSize: '0.875rem',
                          fontWeight: isActive(item.path) ? 500 : 400,
                        }}
                      />
                      {item.badge && (
                        <Chip
                          label={item.badge}
                          size="small"
                          color={isActive(item.path) ? 'secondary' : 'default'}
                          sx={{ ml: 1, height: 20, fontSize: '0.75rem' }}
                        />
                      )}
                    </ListItemButton>
                  </ListItem>
                ))}
            </List>
            
            {section.id !== 'quick' && <Divider sx={{ my: 1 }} />}
          </Box>
        ))}
        
        {/* Stats section */}
        <Box sx={{ px: 2, py: 2, mt: 2 }}>
          <Typography
            variant="overline"
            sx={{
              color: 'text.secondary',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
            }}
          >
            Quick Stats
          </Typography>
          
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Active Games: {activeGamesCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              My Boards: {userBoards.length}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Drawer>
  )
}

export default Sidebar