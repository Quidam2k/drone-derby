import { test as base, expect } from '@playwright/test'

// Test user data
export const testUsers = {
  validUser: {
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
    password: 'TestPassword123',
  },
  validUser2: {
    username: 'testuser2',
    email: 'test2@example.com',
    displayName: 'Test User 2',
    password: 'TestPassword123',
  },
  invalidUser: {
    email: 'invalid@example.com',
    password: 'wrongpassword',
  },
}

// Extended test with authentication utilities
export const test = base.extend<{
  loginAsValidUser: () => Promise<void>
  loginAsUser: (user: { email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  registerUser: (user: { username: string; email: string; displayName: string; password: string }) => Promise<void>
}>({
  loginAsValidUser: async ({ page }, use) => {
    const loginAsValidUser = async () => {
      await page.goto('/login')
      await page.fill('[data-testid="email-input"]', testUsers.validUser.email)
      await page.fill('[data-testid="password-input"]', testUsers.validUser.password)
      await page.click('[data-testid="login-button"]')
      
      // Wait for successful login redirect
      await expect(page).toHaveURL('/dashboard')
    }
    
    await use(loginAsValidUser)
  },

  loginAsUser: async ({ page }, use) => {
    const loginAsUser = async (user: { email: string; password: string }) => {
      await page.goto('/login')
      await page.fill('[data-testid="email-input"]', user.email)
      await page.fill('[data-testid="password-input"]', user.password)
      await page.click('[data-testid="login-button"]')
    }
    
    await use(loginAsUser)
  },

  logout: async ({ page }, use) => {
    const logout = async () => {
      await page.click('[data-testid="user-menu"]')
      await page.click('[data-testid="logout-button"]')
      await expect(page).toHaveURL('/')
    }
    
    await use(logout)
  },

  registerUser: async ({ page }, use) => {
    const registerUser = async (user: { username: string; email: string; displayName: string; password: string }) => {
      await page.goto('/register')
      await page.fill('[data-testid="username-input"]', user.username)
      await page.fill('[data-testid="email-input"]', user.email)
      await page.fill('[data-testid="display-name-input"]', user.displayName)
      await page.fill('[data-testid="password-input"]', user.password)
      await page.fill('[data-testid="confirm-password-input"]', user.password)
      await page.click('[data-testid="register-button"]')
    }
    
    await use(registerUser)
  },
})

export { expect } from '@playwright/test'