import * as crypto from 'crypto';
import { cifrarPayloadCulqi } from './culqi-crypto';

/**
 * No hay forma de probar esto contra el backend real de Culqi desde un
 * test unitario — lo que sí se puede verificar es que el esquema es
 * criptográficamente correcto y reversible: cifrar con la pública y
 * desencriptar a mano con la privada correspondiente (mismo algoritmo que
 * describe la doc de Culqi: AES-256-GCM + RSA-OAEP-SHA256) debe devolver
 * exactamente el payload original.
 */
describe('cifrarPayloadCulqi', () => {
  function generarParRSA() {
    return crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
  }

  function desencriptar(cifrado: ReturnType<typeof cifrarPayloadCulqi>, privateKeyPem: string) {
    const rsaOptions = { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };
    const aesKey = crypto.privateDecrypt(rsaOptions, Buffer.from(cifrado.encrypted_key, 'base64'));
    const iv = crypto.privateDecrypt(rsaOptions, Buffer.from(cifrado.encrypted_iv, 'base64'));

    const encryptedDataBuffer = Buffer.from(cifrado.encrypted_data, 'base64');
    const authTag = encryptedDataBuffer.subarray(encryptedDataBuffer.length - 16);
    const ciphertext = encryptedDataBuffer.subarray(0, encryptedDataBuffer.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  }

  it('cifra y desencripta un payload simple sin perder datos', () => {
    const { publicKey, privateKey } = generarParRSA();
    const payload = { amount: 5000, currency_code: 'PEN', email: 'test@example.com', source_id: 'tkn_test_123' };

    const cifrado = cifrarPayloadCulqi(payload, publicKey);
    expect(cifrado.encrypted_data).toEqual(expect.any(String));
    expect(cifrado.encrypted_key).toEqual(expect.any(String));
    expect(cifrado.encrypted_iv).toEqual(expect.any(String));

    expect(desencriptar(cifrado, privateKey)).toEqual(payload);
  });

  it('usa key/iv distintos en cada llamada (no reutiliza material criptográfico)', () => {
    const { publicKey } = generarParRSA();
    const payload = { amount: 100 };

    const primero = cifrarPayloadCulqi(payload, publicKey);
    const segundo = cifrarPayloadCulqi(payload, publicKey);

    expect(primero.encrypted_data).not.toEqual(segundo.encrypted_data);
    expect(primero.encrypted_key).not.toEqual(segundo.encrypted_key);
    expect(primero.encrypted_iv).not.toEqual(segundo.encrypted_iv);
  });

  it('desencriptar con la llave RSA incorrecta falla en vez de devolver datos corruptos silenciosamente', () => {
    const { publicKey } = generarParRSA();
    const { privateKey: privadaDeOtroPar } = generarParRSA();
    const cifrado = cifrarPayloadCulqi({ amount: 100 }, publicKey);

    expect(() => desencriptar(cifrado, privadaDeOtroPar)).toThrow();
  });
});
