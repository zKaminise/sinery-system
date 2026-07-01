import { z } from "zod"

export const loginSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }).trim(),
  password: z.string().min(1, { error: "Informe a senha." }),
})

export const passwordSchema = z
  .string()
  .min(8, { error: "A senha deve ter pelo menos 8 caracteres." })
  .regex(/[a-zA-Z]/, { error: "A senha deve conter pelo menos uma letra." })
  .regex(/[0-9]/, { error: "A senha deve conter pelo menos um número." })

export const changePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, { error: "Confirme a nova senha." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "As senhas não conferem.",
    path: ["confirmPassword"],
  })
