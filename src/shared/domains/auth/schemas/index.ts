import { z } from 'zod'

export const loginFormSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
})

export const signupFormSchema = loginFormSchema.extend({
  name: z.string().min(1, { message: 'Name is required' }),
  confirmPassword: z.string().min(6, { message: 'Password must be at least 6 characters' }),
}).refine(data => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match',
})

export type LoginFormSchema = z.infer<typeof loginFormSchema>

export type SignupFormSchema = z.infer<typeof signupFormSchema>
