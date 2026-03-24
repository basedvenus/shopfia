import { z } from "zod";

export const cuidSchema = z.string().cuid();
export const optionalCurrencyCentsSchema = z.coerce.number().int().min(0).optional();
