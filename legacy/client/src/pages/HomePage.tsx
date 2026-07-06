import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Avatar,
  Stack,
} from '@mui/material'
import {
  SportsEsports as GameIcon,
  Edit as EditorIcon,
  Collections as TemplateIcon,
  People as PlayersIcon,
  Speed as SpeedIcon,
  Public as PublicIcon,
} from '@mui/icons-material'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'

const HomePage = () => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth)
  
  const features = [
    {
      icon: <GameIcon />,
      title: 'Asynchronous Multiplayer',
      description: 'Play with friends on your own schedule. No need to be online at the same time!',
      color: 'primary',
    },
    {
      icon: <EditorIcon />,
      title: 'Level Editor',
      description: 'Create custom boards with our intuitive drag-and-drop editor.',
      color: 'secondary',
    },
    {
      icon: <TemplateIcon />,
      title: 'Template System',
      description: 'Share and discover reusable board components created by the community.',
      color: 'success',
    },
    {
      icon: <SpeedIcon />,
      title: 'Strategic Programming',
      description: 'Program your robot with movement cards that execute simultaneously.',
      color: 'warning',
    },
  ]
  
  const stats = [
    { label: 'Active Players', value: '1,247', icon: <PlayersIcon /> },
    { label: 'Games Played', value: '15,832', icon: <GameIcon /> },
    { label: 'Custom Boards', value: '3,456', icon: <PublicIcon /> },
    { label: 'Templates', value: '892', icon: <TemplateIcon /> },
  ]
  
  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: 8,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                variant="h2"
                component="h1"
                gutterBottom
                sx={{ fontWeight: 700 }}
              >
                Welcome to Drone Derby
              </Typography>
              <Typography
                variant="h5"
                paragraph
                sx={{ opacity: 0.9, mb: 4 }}
              >
                A strategic multiplayer programming game where you command robots 
                through challenging courses. Plan your moves, execute simultaneously, 
                and race to victory!
              </Typography>
              
              <Stack direction="row" spacing={2}>
                {!isAuthenticated ? (
                  <>
                    <Button
                      variant="contained"
                      size="large"
                      component={Link}
                      to="/register"
                      sx={{
                        bgcolor: 'white',
                        color: 'primary.main',
                        '&:hover': { bgcolor: 'grey.100' },
                      }}
                    >
                      Start Playing
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      component={Link}
                      to="/boards"
                      sx={{
                        borderColor: 'white',
                        color: 'white',
                        '&:hover': { borderColor: 'grey.300', bgcolor: 'rgba(255,255,255,0.1)' },
                      }}
                    >
                      Browse Boards
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="contained"
                      size="large"
                      component={Link}
                      to="/dashboard"
                      sx={{
                        bgcolor: 'white',
                        color: 'primary.main',
                        '&:hover': { bgcolor: 'grey.100' },
                      }}
                    >
                      Go to Dashboard
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      component={Link}
                      to="/games/create"
                      sx={{
                        borderColor: 'white',
                        color: 'white',
                        '&:hover': { borderColor: 'grey.300', bgcolor: 'rgba(255,255,255,0.1)' },
                      }}
                    >
                      Create Game
                    </Button>
                  </>
                )}
              </Stack>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 400,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  backdropFilter: 'blur(10px)',
                }}
              >
                <Typography variant="h4" sx={{ opacity: 0.7 }}>
                  🎮 Game Preview
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
      
      {/* Stats Section */}
      <Container maxWidth="lg" sx={{ mt: -4, position: 'relative', zIndex: 1 }}>
        <Grid container spacing={3}>
          {stats.map((stat, index) => (
            <Grid item xs={6} md={3} key={index}>
              <Card sx={{ textAlign: 'center', py: 2 }}>
                <CardContent>
                  <Avatar
                    sx={{
                      bgcolor: 'primary.main',
                      width: 56,
                      height: 56,
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    {stat.icon}
                  </Avatar>
                  <Typography variant="h4" component="div" fontWeight="bold">
                    {stat.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stat.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
      
      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography
          variant="h3"
          component="h2"
          textAlign="center"
          gutterBottom
          sx={{ mb: 6 }}
        >
          Why Choose Drone Derby?
        </Typography>
        
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} md={6} key={index}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: `${feature.color}.main`,
                        mr: 2,
                      }}
                    >
                      {feature.icon}
                    </Avatar>
                    <Typography variant="h5" component="h3">
                      {feature.title}
                    </Typography>
                  </Box>
                  <Typography variant="body1" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
      
      {/* Call to Action */}
      <Box sx={{ bgcolor: 'grey.50', py: 8 }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography variant="h4" component="h2" gutterBottom>
            Ready to Start Your Robot Racing Journey?
          </Typography>
          <Typography variant="h6" paragraph color="text.secondary" sx={{ mb: 4 }}>
            Join thousands of players in strategic robot programming battles
          </Typography>
          
          {isAuthenticated ? (
            <Typography variant="h6" sx={{ mb: 3 }}>
              Welcome back, {user?.displayName}!
            </Typography>
          ) : null}
          
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="center"
          >
            {!isAuthenticated ? (
              <>
                <Button
                  variant="contained"
                  size="large"
                  component={Link}
                  to="/register"
                >
                  Create Free Account
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  component={Link}
                  to="/login"
                >
                  Login
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="contained"
                  size="large"
                  component={Link}
                  to="/games/create"
                >
                  Create New Game
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  component={Link}
                  to="/editor"
                >
                  Design Board
                </Button>
              </>
            )}
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}

export default HomePage