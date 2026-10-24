/**
 * Chave Pix pública usada APENAS na página estática /apoie.
 * Nunca publique senha, token ou dados bancários sensíveis neste arquivo.
 */
export function pixKeyFromEnv(value: string | undefined): string | null {
  const key = value?.trim() ?? "";
  // Chave aleatória (EVP), e-mail e telefone são aceitos; recomendamos EVP.
  // Isto NÃO interpreta payloads EMV Pix "copia e cola".
  if (!key || key.length > 120 || !/^[A-Za-z0-9@+._-]+$/.test(key)) return null;
  return key;
}
