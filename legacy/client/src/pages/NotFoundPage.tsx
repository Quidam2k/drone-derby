import { Box, Typography, Button } from '@mui/material'
import { Home as HomeIcon } from '@mui/icons-material'
import { Link } from 'react-router-dom'

const NotFoundPage = () => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight="60vh"
      textAlign="center"
      gap={3}
    >
      <Typography variant="h1" color="primary" sx={{ fontSize: '6rem', fontWeight: 'bold' }}>
        404
      </Typography>
      <Typography variant="h4" gutterBottom>
        Page Not Found
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        The page you're looking for doesn't exist or has been moved.
      </Typography>
      <Button
        variant="contained"
        component={Link}
        to="/"
        startIcon={<HomeIcon />}
        size="large"
      >
        Go Home
      </Button>
    </Box>
  )
}

export default NotFoundPage