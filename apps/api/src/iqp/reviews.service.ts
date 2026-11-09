import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ReviewRequest, ReviewResponse } from '@tankei/shared';
import { and, desc, eq, gt } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import { reviews, stations, type ReviewAnswers } from '../database/schema';
import { ParametersService } from '../parameters/parameters.service';
import { AccessService } from '../organizations/access.service';
import { IqpService } from './iqp.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const date = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
});

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly parameters: ParametersService,
    private readonly access: AccessService,
    private readonly iqp: IqpService,
  ) {}

  /** Registra a avaliação e recalcula o IQP do posto (ADR 0004). */
  async create(
    user: AuthenticatedUser,
    stationId: string,
    request: ReviewRequest,
    now = new Date(),
  ): Promise<ReviewResponse> {
    const [station] = await this.db
      .select({ id: stations.id })
      .from(stations)
      .where(and(eq(stations.id, stationId), eq(stations.active, true)));
    if (!station) throw new NotFoundException('Posto não encontrado.');

    if (await this.access.roleAt(user.id, stationId)) {
      throw new ForbiddenException(
        'A equipe do posto não pode avaliar o próprio posto.',
      );
    }

    const intervalDays = await this.parameters.get('review.min_interval_days');
    const [previous] = await this.db
      .select({ createdAt: reviews.createdAt })
      .from(reviews)
      .where(
        and(
          eq(reviews.stationId, stationId),
          eq(reviews.userId, user.id),
          gt(
            reviews.createdAt,
            new Date(now.getTime() - intervalDays * DAY_MS),
          ),
        ),
      )
      .orderBy(desc(reviews.createdAt))
      .limit(1);
    if (previous) {
      const next = new Date(
        previous.createdAt.getTime() + intervalDays * DAY_MS,
      );
      throw new HttpException(
        `Você já avaliou este posto. Poderá avaliar de novo a partir de ${date.format(next)}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [saved] = await this.db
      .insert(reviews)
      .values({
        stationId,
        userId: user.id,
        answers: toAnswers(request),
        visitId: request.visitId ?? null,
        createdAt: now,
      })
      .returning({ id: reviews.id });

    await this.iqp.recompute([stationId], now);
    return { id: saved.id, message: 'Avaliação registrada. Obrigado!' };
  }
}

/** Mantém a diferença entre "não disponível" (null) e "não avaliado" (ausente). */
function toAnswers(request: ReviewRequest): ReviewAnswers {
  const answers: ReviewAnswers = {};
  for (const [criterion, value] of Object.entries(request.ratings)) {
    if (value !== undefined) {
      answers[criterion as keyof ReviewAnswers] = value;
    }
  }
  if (request.priceAsAdvertised !== undefined) {
    answers.preco_conforme = request.priceAsAdvertised;
  }
  return answers;
}
