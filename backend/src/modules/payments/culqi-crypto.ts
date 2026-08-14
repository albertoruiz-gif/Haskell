import * as crypto from 'crypto';

/**
 * Cifrado híbrido RSA/AES exigido por Culqi para "endpoints protegidos"
 * (ver https://docs.culqi.com/es/documentacion/pagos-online/llaves_rsa/):
 * el payload se cifra con AES-256-GCM (key + iv aleatorios de 32/16 bytes),
 * y esa key + iv se cifran a su vez con la llave pública RSA del merchant
 * usando RSA-OAEP-SHA256 ("RSA/ECB/OAEPWithSHA-256AndMGF1Padding" en la
 * nomenclatura Java de la doc de Culqi — equivalente exacto en Node es
 * RSA_PKCS1_OAEP_PADDING + oaepHash 'sha256').
 *
 * El authTag de GCM se concatena al final del ciphertext antes de
 * codificar en base64 (así es como Java's Cipher.doFinal() lo entrega, que
 * es contra lo que Culqi valida del otro lado) — si algún día se decodifica
 * la respuesta de Culqi con este mismo esquema, hay que separar los
 * últimos 16 bytes como el tag antes de desencriptar.
 */
export function cifrarPayloadCulqi(payload: unknown, rsaPublicKeyPem: string): {
  encrypted_data: string;
  encrypted_key: string;
  encrypted_iv: string;
} {
  const aesKey = crypto.randomBytes(32); // AES-256
  const iv = crypto.randomBytes(16); // Tal como especifica la doc de Culqi (no el estándar de 12 bytes de GCM)

  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const jsonPayload = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(jsonPayload), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes
  const encryptedData = Buffer.concat([ciphertext, authTag]);

  const rsaOptions: crypto.RsaPublicKey & { padding: number; oaepHash: string } = {
    key: rsaPublicKeyPem,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256',
  };
  const encryptedKey = crypto.publicEncrypt(rsaOptions, aesKey);
  const encryptedIv = crypto.publicEncrypt(rsaOptions, iv);

  return {
    encrypted_data: encryptedData.toString('base64'),
    encrypted_key: encryptedKey.toString('base64'),
    encrypted_iv: encryptedIv.toString('base64'),
  };
}
