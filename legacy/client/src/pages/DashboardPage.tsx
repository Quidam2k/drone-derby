import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Box,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
} from '@mui/material'
import {
  SportsEsports as GameIcon,
  Edit as EditorIcon,
  TrendingUp as StatsIcon,
  History as HistoryIcon,
  Add as AddIcon,
  Collections as TemplateIcon,
} from '@mui/icons-material'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { getUserGames } from '@/store/slices/gameSlice'
import { getUserBoards } from '@/store/slices/boardSlice'
import { formatDistanceToNow } from 'date-fns'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const DashboardPage = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useSelector((state: RootState) => state.auth)
  const { userGames, isLoading: gamesLoading } = useSelector((state: RootState) => state.game)
  const { userBoards, isLoading: boardsLoading } = useSelector((state: RootState) => state.board)
  
  useEffect(() => {
    dispatch(getUserGames({ limit: 5 }))
    dispatch(getUserBoards({ limit: 5 }))
  }, [dispatch])
  
  const activeGames = userGames.filter(game => 
    game.phase === 'programming' || game.phase === 'executing'
  )
  
  const recentGames = userGames.slice(0, 5)
  const recentBoards = userBoards.slice(0, 5)
  
  const getGameStatusColor = (phase: string) => {
    switch (phase) {
      case 'waiting': return 'warning'
      case 'programming': return 'info'
      case 'executing': return 'primary'
      case 'complete': return 'success'
      default: return 'default'
    }
  }
  
  const getGameStatusText = (phase: string) => {
    switch (phase) {
      case 'waiting': return 'Waiting for Players'
      case 'programming': return 'Programming Phase'
      case 'executing': return 'Executing Turn'
      case 'complete': return 'Complete'
      default: return phase
    }
  }
  
  if (gamesLoading || boardsLoading) {
    return <LoadingSpinner message="Loading dashboard..." />
  }
  
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Welcome back, {user?.displayName}!
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Here's what's happening in your robot racing world
        </Typography>
      </Box>
      
      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 2 }}>
                <GameIcon />
              </Avatar>
              <Typography variant="h4" component="div">
                {activeGames.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Games
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 2 }}>
                <StatsIcon />
              </Avatar>
              <Typography variant="h4" component="div">
                {user?.stats.gamesWon || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Games Won
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ bgcolor: 'secondary.main', mx: 'auto', mb: 2 }}>
                <EditorIcon />
              </Avatar>
              <Typography variant="h4" component="div">
                {userBoards.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Boards Created
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar sx={{ bgcolor: 'warning.main', mx: 'auto', mb: 2 }}>
                <TemplateIcon />
              </Avatar>
              <Typography variant="h4" component="div">
                {Math.round((user?.stats.winRate || 0) * 100)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Win Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      <Grid container spacing={3}>
        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  component={Link}
                  to="/games/create"
                  fullWidth
                >
                  Create New Game
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditorIcon />}
                  component={Link}
                  to="/editor"
                  fullWidth
                >
                  Open Level Editor
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<TemplateIcon />}
                  component={Link}
                  to="/templates"
                  fullWidth
                >
                  Browse Templates
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Active Games */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Active Games
                </Typography>
                <Button
                  size="small"
                  component={Link}
                  to="/games"
                >
                  View All
                </Button>
              </Box>
              
              {activeGames.length === 0 ? (
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                  No active games. Create one to get started!
                </Typography>
              ) : (
                <List dense>
                  {activeGames.slice(0, 3).map((game) => (
                    <ListItem
                      key={game.id}
                      button
                      component={Link}
                      to={`/games/${game.id}`}
                      sx={{ px: 0 }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <GameIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={game.name || `Game ${game.id.slice(0, 8)}`}
                        secondary={
                          <Box>
                            <Chip
                              label={getGameStatusText(game.phase)}
                              size="small"
                              color={getGameStatusColor(game.phase) as any}
                              sx={{ mr: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              Turn {game.currentTurn}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Recent Activity */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Recent Activity
                </Typography>
                <Button
                  size="small"
                  component={Link}
                  to="/games/history"
                >
                  View History
                </Button>
              </Box>
              
              {recentGames.length === 0 ? (
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                  No recent games found.
                </Typography>
              ) : (
                <List dense>
                  {recentGames.slice(0, 3).map((game) => (
                    <ListItem key={game.id} sx={{ px: 0 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'secondary.main' }}>
                          <HistoryIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={game.name || `Game ${game.id.slice(0, 8)}`}
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {formatDistanceToNow(new Date(game.lastActivity), { addSuffix: true })}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* My Boards */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  My Boards
                </Typography>
                <Button
                  size="small"
                  component={Link}
                  to="/boards/mine"
                >
                  View All
                </Button>
              </Box>
              
              {recentBoards.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    You haven't created any boards yet.
                  </Typography>
                  <Button
                    variant="contained"
                    component={Link}
                    to="/editor"
                    startIcon={<EditorIcon />}
                  >
                    Create Your First Board
                  </Button>
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {recentBoards.map((board) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={board.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>
                            {board.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {board.description || 'No description'}
                          </Typography>
                          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={board.is_public ? 'Public' : 'Private'}
                              size="small"
                              color={board.is_public ? 'success' : 'default'}
                            />
                            <Typography variant="caption" color="text.secondary">
                              Used {board.usage_count} times
                            </Typography>
                          </Box>
                        </CardContent>
                        <CardActions>
                          <Button
                            size="small"
                            component={Link}
                            to={`/editor/${board.id}`}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            component={Link}
                            to={`/boards/${board.id}`}
                          >
                            View
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  )
}

export default DashboardPage