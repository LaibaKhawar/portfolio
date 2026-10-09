import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100, "That name is too long."),
  email: z.email("Please enter a valid email address.").max(200),
  message: z.string().trim().min(10, "A little more detail would help (at least 10 characters).").max(4000, "Please keep it under 4,000 characters."),
  // Honeypot: real people never see or fill this.
  company: z.string().max(200).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
