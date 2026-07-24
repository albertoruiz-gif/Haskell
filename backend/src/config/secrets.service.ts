import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

/**
 * Carga secretos desde AWS Secrets Manager cuando USE_AWS_SECRETS_MANAGER=true
 * (asi corre en EKS, ver infra/k8s/secretproviderclass.yaml). En desarrollo local
 * usa las variables de entorno de .env directamente — nunca hay una ruta que
 * imprima o loguee el valor de un secreto.
 */
@Injectable()
export class SecretsService implements OnModuleInit {
  private readonly logger = new Logger(SecretsService.name);
  private readonly client = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
  private cache = new Map<string, Record<string, string>>();

  async onModuleInit() {
    if (process.env.USE_AWS_SECRETS_MANAGER === 'true') {
      await Promise.all([
        this.load('plataforma/odoo'),
        this.load('plataforma/culqi'),
      ]);
      this.logger.log('Secretos cargados desde AWS Secrets Manager');
    }
  }

  private async load(secretId: string) {
    const result = await this.client.send(new GetSecretValueCommand({ SecretId: secretId }));
    if (result.SecretString) {
      this.cache.set(secretId, JSON.parse(result.SecretString));
    }
  }

  get(secretId: string, key: string, envFallback?: string): string {
    const fromAws = this.cache.get(secretId)?.[key];
    if (fromAws) return fromAws;
    if (envFallback && process.env[envFallback]) return process.env[envFallback] as string;
    throw new Error(`Secreto no disponible: ${secretId}.${key}`);
  }

  odoo() {
    return {
      url: this.get('plataforma/odoo', 'url', 'ODOO_URL'),
      db: this.get('plataforma/odoo', 'db', 'ODOO_DB'),
      username: this.get('plataforma/odoo', 'username', 'ODOO_USERNAME'),
      apiKey: this.get('plataforma/odoo', 'apiKey', 'ODOO_API_KEY'),
    };
  }

  culqi() {
    return {
      publicKey: this.get('plataforma/culqi', 'publicKey', 'CULQI_PUBLIC_KEY'),
      privateKey: this.get('plataforma/culqi', 'privateKey', 'CULQI_PRIVATE_KEY'),
      rsaId: this.get('plataforma/culqi', 'rsaId', 'CULQI_RSA_ID'),
      rsaPublicKey: this.get('plataforma/culqi', 'rsaPublicKey', 'CULQI_RSA_PUBLIC_KEY'),
    };
  }
}
