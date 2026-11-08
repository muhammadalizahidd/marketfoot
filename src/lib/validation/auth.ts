import { z } from "zod";

/**
 * Keep a human-readable pseudo stable when it was pasted from a phone or
 * another application. In particular, accented letters may arrive in their
 * decomposed Unicode form (letter + accent mark).
 */
export const usernameSchema = z.preprocess(
  (value) => typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/g, " ") : value,
  z.string()
    .min(3, "Le pseudo doit contenir au moins 3 caractères.")
    .max(32, "Le pseudo ne peut pas dépasser 32 caractères.")
    .regex(
      /^[\p{L}\p{M}\p{N}_-]+(?: [\p{L}\p{M}\p{N}_-]+)*$/u,
      "Utilisez des lettres, chiffres, espaces, tirets ou tirets bas.",
    ),
);

export const signInSchema = z.object({
  email: z.string().email("Saisissez une adresse e-mail valide."),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
});

export const signUpSchema = signInSchema.extend({
  username: usernameSchema,
});
