import { and, eq, isNull } from 'drizzle-orm';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DRIZZLE, type Database } from '../database/database.module';
import { users } from '../database/schema';
import { loadEnv } from '../load-env';

/**
 * Torna administrador o usuário com o e-mail informado. A pessoa precisa ter
 * feito login ao menos uma vez. Novo perfil vale a partir do próximo token de acesso.
 * Uso: pnpm --filter @tankei/api user:admin EMAIL
 */
async function main() {
  loadEnv();
  const email = process.argv[2];
  if (!email) throw new Error('Informe o e-mail: user:admin EMAIL');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  try {
    const db = app.get<Database>(DRIZZLE);
    const updated = await db
      .update(users)
      .set({ role: 'admin' })
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .returning({ id: users.id });
    if (updated.length === 0) {
      throw new Error(`Nenhuma conta ativa com o e-mail ${email}.`);
    }
    console.log(`Administrador: ${email} (${updated[0].id})`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
