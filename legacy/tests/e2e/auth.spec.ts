import { test, expect, testUsers } from './fixtures/auth'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies()
    await page.evaluate(() => localStorage.clear())
  })

  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login')
    
    await expect(page).toHaveTitle(/Drone Derby/i)
    await expect(page.locator('h1')).toContainText('Welcome Back')
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible()
    await expect(page.locator('text=Sign up here')).toBeVisible()
  })

  test('should display register page correctly', async ({ page }) => {
    await page.goto('/register')
    
    await expect(page).toHaveTitle(/Drone Derby/i)
    await expect(page.locator('h1')).toContainText('Join Drone Derby')
    await expect(page.locator('[data-testid="username-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="display-name-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="confirm-password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="register-button"]')).toBeVisible()
  })

  test('should show validation errors for invalid login', async ({ page, loginAsUser }) => {
    await loginAsUser(testUsers.invalidUser)
    
    await expect(page.locator('[role="alert"]')).toContainText(/invalid/i)
    await expect(page).toHaveURL('/login')
  })

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/login')
    
    // Try to submit without filling fields
    await page.click('[data-testid="login-button"]')
    
    await expect(page.locator('text=Please enter a valid email')).toBeVisible()
  })

  test('should register a new user successfully', async ({ page, registerUser }) => {
    // Use a unique email for each test run
    const uniqueUser = {
      ...testUsers.validUser,
      email: `test+${Date.now()}@example.com`,
      username: `testuser${Date.now()}`,
    }
    
    await registerUser(uniqueUser)
    
    // Should redirect to dashboard after successful registration
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('[data-testid="user-display-name"]')).toContainText(uniqueUser.displayName)
  })

  test('should show password strength indicators', async ({ page }) => {
    await page.goto('/register')
    
    const passwordInput = page.locator('[data-testid="password-input"]')
    
    // Test weak password
    await passwordInput.fill('weak')
    await expect(page.locator('[data-testid="password-requirement-length"]')).toHaveClass(/error|outlined/)
    
    // Test stronger password
    await passwordInput.fill('StrongPassword123')
    await expect(page.locator('[data-testid="password-requirement-length"]')).toHaveClass(/success|filled/)
    await expect(page.locator('[data-testid="password-requirement-uppercase"]')).toHaveClass(/success|filled/)
    await expect(page.locator('[data-testid="password-requirement-lowercase"]')).toHaveClass(/success|filled/)
    await expect(page.locator('[data-testid="password-requirement-number"]')).toHaveClass(/success|filled/)
  })

  test('should show password mismatch error', async ({ page }) => {
    await page.goto('/register')
    
    await page.fill('[data-testid="password-input"]', 'Password123')
    await page.fill('[data-testid="confirm-password-input"]', 'Different123')
    
    await expect(page.locator('text=Passwords don\'t match')).toBeVisible()
  })

  test('should login successfully with valid credentials', async ({ page, loginAsValidUser }) => {
    await loginAsValidUser()
    
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible()
  })

  test('should logout successfully', async ({ page, loginAsValidUser, logout }) => {
    await loginAsValidUser()
    await logout()
    
    await expect(page).toHaveURL('/')
  })

  test('should redirect to intended page after login', async ({ page }) => {
    // Try to access protected page
    await page.goto('/editor')
    
    // Should redirect to login
    await expect(page).toHaveURL('/login')
    
    // Login
    await page.fill('[data-testid="email-input"]', testUsers.validUser.email)
    await page.fill('[data-testid="password-input"]', testUsers.validUser.password)
    await page.click('[data-testid="login-button"]')
    
    // Should redirect back to intended page
    await expect(page).toHaveURL('/editor')
  })

  test('should handle account lockout after multiple failed attempts', async ({ page }) => {
    await page.goto('/login')
    
    // Attempt multiple failed logins
    for (let i = 0; i < 6; i++) {
      await page.fill('[data-testid="email-input"]', testUsers.validUser.email)
      await page.fill('[data-testid="password-input"]', 'wrongpassword')
      await page.click('[data-testid="login-button"]')
      
      if (i < 5) {
        await expect(page.locator('[role="alert"]')).toContainText(/invalid/i)
      }
    }
    
    // Should show lockout message
    await expect(page.locator('[role="alert"]')).toContainText(/locked|too many attempts/i)
  })

  test('should navigate between login and register pages', async ({ page }) => {
    await page.goto('/login')
    
    // Click register link
    await page.click('text=Sign up here')
    await expect(page).toHaveURL('/register')
    
    // Click login link
    await page.click('text=Sign in here')
    await expect(page).toHaveURL('/login')
  })

  test('should display forgot password page', async ({ page }) => {
    await page.goto('/login')
    
    await page.click('text=Forgot your password?')
    await expect(page).toHaveURL('/forgot-password')
    
    await expect(page.locator('h1')).toContainText('Reset Password')
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="send-reset-button"]')).toBeVisible()
  })

  test('should handle forgot password submission', async ({ page }) => {
    await page.goto('/forgot-password')
    
    await page.fill('[data-testid="email-input"]', testUsers.validUser.email)
    await page.click('[data-testid="send-reset-button"]')
    
    await expect(page.locator('h1')).toContainText('Check Your Email')
    await expect(page.locator('text=password reset link')).toBeVisible()
  })
})