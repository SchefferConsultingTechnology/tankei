import { Injectable } from '@nestjs/common';
import { IQP_METHODOLOGY_VERSION } from '@tankei/shared';

export interface HealthStatus {
  status: 'ok';
  service: 'tankei-api';
  iqpMethodology: string;
}

@Injectable()
export class AppService {
  getHealth(): HealthStatus {
    return {
      status: 'ok',
      service: 'tankei-api',
      iqpMethodology: IQP_METHODOLOGY_VERSION,
    };
  }
}
