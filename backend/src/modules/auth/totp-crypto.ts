import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// El secreto TOTP no puede guardarse como hash de una vía (a diferencia de
// passwordHash) — hay que poder leerlo de vuelta para calcular el código
// esperado en cada verificación. Se cifra en reposo (AES-256-GCM) con una
// clave derivada de TOTP_ENCRYPTION_KEY, para que una fuga de la base sola
// (sin la variable de entorno) no alcance para clonar el segundo factor de
// nadie. Mismo criterio "fail-closed" que jwtSecret(): sin la variable, la
// app no arranca en vez de caer a un valor por defecto inseguro.
function claveDerivada(): Buffer {
  const secreto = process.env.TOTP_ENCRYPTION_KEY;
  if (!secreto) {
    throw new Error(
      'Falta TOTP_ENCRYPTION_KEY en el entorno — requerida para cifrar/leer secretos de 2FA (ver backend/.env.example).',
    );
  }
  // scrypt para no depender de que TOTP_ENCRYPTION_KEY tenga exactamente 32 bytes.
  return scryptSync(secreto, 'haskell-totp', 32);
}

export function cifrarSecretoTotp(secretoPlano: string): string {
  const iv = randomBytes(12); // GCM: 12 bytes es lo recomendado
  const cipher = createCipheriv('aes-256-gcm', claveDerivada(), iv);
  const cifrado = Buffer.concat([cipher.update(secretoPlano, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), cifrado.toString('base64')].join('.');
}

export function descifrarSecretoTotp(valorCifrado: string): string {
  const [ivB64, authTagB64, cifradoB64] = valorCifrado.split('.');
  if (!ivB64 || !authTagB64 || !cifradoB64) {
    throw new Error('Secreto TOTP cifrado con formato inválido.');
  }
  const decipher = createDecipheriv('aes-256-gcm', claveDerivada(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plano = Buffer.concat([decipher.update(Buffer.from(cifradoB64, 'base64')), decipher.final()]);
  return plano.toString('utf8');
}
