"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface AuthContextType {
  isAuthenticated: boolean
  email: string | null
  login: (email: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [email, setEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Load auth state from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedAuth = localStorage.getItem("cosmic_auth")
      if (storedAuth) {
        try {
          const authData = JSON.parse(storedAuth)
          setIsAuthenticated(authData.isAuthenticated || false)
          setEmail(authData.email || null)
        } catch (e) {
          // Invalid stored data, clear it
          localStorage.removeItem("cosmic_auth")
        }
      }
      setIsLoading(false)
    }
  }, [])

  const login = (email: string) => {
    setIsAuthenticated(true)
    setEmail(email)
    // Persist to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("cosmic_auth", JSON.stringify({ isAuthenticated: true, email }))
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    setEmail(null)
    // Clear localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("cosmic_auth")
    }
  }

  // Don't render children until we've checked localStorage
  if (isLoading) {
    return null
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, email, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}



