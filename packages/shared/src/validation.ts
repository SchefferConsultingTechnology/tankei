import { z } from 'zod';

// Mensagens padrão do Zod em português para API e clientes (ADR 0008).
// Basta importar @tankei/shared para valer.
z.config(z.locales.ptBR());

/**
 * Número recebido como texto (query string, por exemplo "-27.29").
 * Rejeita texto vazio, que z.coerce.number() converteria em 0.
 */
export function numericString(message: string) {
  return z
    .string({ error: message })
    .trim()
    .regex(/^-?\d+(\.\d+)?$/, message)
    .transform(Number);
}

/**
 * Campo que pode ser nulo. Use sempre este helper em vez de `.nullable()`:
 * sem descrição, o Zod gera `"type": ["string", "null"]` e o @nestjs/swagger
 * documenta o campo como array. Com descrição, gera `anyOf`, que o Swagger entende.
 */
export function nullable<T extends z.ZodType>(schema: T, description: string) {
  return schema.describe(description).nullable();
}
