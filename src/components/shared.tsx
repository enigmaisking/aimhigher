// components/shared.tsx
// AimHigher UI Component Library - Tailwind Version

import React from 'react'

// Design tokens
export const COLORS = {
  primary: '#00FF88',
  primaryHover: '#00E070',
  primaryActive: '#00CC66',
  bgPrimary: '#0A0A0F',
  bgSecondary: '#1A1A2E',
  bgTertiary: '#2A2A3E',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textTertiary: '#6B6B80',
  borderPrimary: '#1A1A2E',
  borderSecondary: '#2A2A3E',
  success: '#22D3A0',
  warning: '#F59E0B',
}

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  disabled,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-3 py-2 text-xs h-8',
    md: 'px-6 py-3 text-sm h-11',
    lg: 'px-8 py-4 text-base h-12',
  }[size]

  const variantClasses = {
    primary: 'bg-[#00FF88] text-black hover:bg-[#00E070] active:bg-[#00CC66] disabled:bg-gray-600 disabled:opacity-50',
    secondary: 'border-2 border-[#00FF88] text-[#00FF88] bg-transparent hover:bg-[rgba(0,255,136,0.1)] active:bg-[rgba(0,255,136,0.2)]',
    ghost: 'text-[#A0A0B0] border border-[#1A1A2E] hover:text-[#00FF88] hover:border-[#00FF88]',
  }[variant]

  return (
    <button
      className={`font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}

// Card
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'premium' | 'stats'
  children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  children,
  className = '',
  ...props
}) => {
  const variantClasses = {
    default: 'bg-[#0A0A0F] border border-[#1A1A2E] hover:border-[#00FF88] hover:shadow-lg hover:shadow-[rgba(0,255,136,0.2)]',
    premium: 'bg-[#0A0A0F] border-2 border-[#00FF88] shadow-lg shadow-[rgba(0,255,136,0.12)] hover:shadow-[rgba(0,255,136,0.25)]',
    stats: 'bg-[#1A1A2E] border border-[#2A2A3E]',
  }[variant]

  return (
    <div
      className={`rounded-3xl p-6 transition-all duration-200 backdrop-blur-sm ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

// Badge
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'premium' | 'lead' | 'chain' | 'default'
  children: React.ReactNode
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  className = '',
  ...props
}) => {
  const variantClasses = {
    premium: 'bg-[rgba(34,211,160,0.15)] border border-[#22D3A0] text-[#22D3A0]',
    lead: 'bg-[rgba(245,158,11,0.15)] border border-[#F59E0B] text-[#F59E0B]',
    chain: 'bg-[rgba(96,165,250,0.15)] border border-[#60A5FA] text-[#93C5FD] font-mono',
    default: 'bg-[rgba(160,160,176,0.1)] border border-[#2A2A3E] text-[#A0A0B0]',
  }[variant]

  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

// Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[#A0A0B0] mb-2">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg px-4 py-3 text-sm text-white placeholder-[#6B6B80] focus:outline-none focus:border-[#00FF88] focus:shadow-[0_0_12px_rgba(0,255,136,0.2)] transition-all ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-[#F59E0B] mt-1">{error}</p>
      )}
    </div>
  )
}

// Select
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[#A0A0B0] mb-2">
          {label}
        </label>
      )}
      <select
        className={`w-full bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00FF88] focus:shadow-[0_0_12px_rgba(0,255,136,0.2)] transition-all appearance-none cursor-pointer ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// Spinner
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }[size]

  return (
    <div className={`${sizeClasses} animate-spin`}>
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="#00FF88"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="#00FF88"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  )
}

// StatCard
interface StatCardProps {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  trend,
  trendValue,
}) => {
  const trendColor = {
    up: 'text-[#00FF88]',
    down: 'text-[#F59E0B]',
    neutral: 'text-[#6B6B80]',
  }[trend || 'neutral']

  return (
    <Card variant="stats">
      <p className="text-xs uppercase font-semibold text-[#6B6B80] mb-2">
        {label}
      </p>
      <p className="text-3xl font-bold text-white mb-2">{value}</p>
      {trendValue && (
        <p className={`text-sm font-medium ${trendColor}`}>{trendValue}</p>
      )}
    </Card>
  )
}

// Message (for chat)
interface MessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export const Message: React.FC<MessageProps> = ({
  role,
  content,
  timestamp,
}) => {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-xs rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-[#00FF88] text-black rounded-br-none'
            : 'bg-[#1A1A2E] text-white rounded-bl-none'
        }`}
      >
        <p className="text-sm leading-relaxed">{content}</p>
        {timestamp && (
          <p className={`text-xs mt-2 ${isUser ? 'opacity-60' : 'text-[#6B6B80]'}`}>
            {timestamp}
          </p>
        )}
      </div>
    </div>
  )
}
