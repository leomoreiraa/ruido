/**
 * Pix estático oficial do RUÍDO. Chave pública fornecida pelo mantenedor.
 * O BR Code não consulta contas, não gera cobranças e não define valor.
 * Referência: Manual de Padrões para Iniciação do Pix (Banco Central).
 * Campos de nome/cidade são metadados EMV. O pagador deve confirmar no banco
 * o nome do real recebedor consultado via DICT antes de pagar.
 */
export const RUIDO_PIX_KEY = "7748aa32-17c0-4c16-91bc-fd8f65a87f33";
export const RUIDO_PIX_NOME = "RUIDO";
export const RUIDO_PIX_CIDADE = "ARARAS";

function tlv(id: string, value: string): string {
  const length = new TextEncoder().encode(value).byteLength;
  if (id.length !== 2 || length > 99) throw new Error("Campo BR Code inválido");
  return id + String(length).padStart(2, "0") + value;
}

export function pixCrc16(data: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(data)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function createPixBrCode(
  key: string,
  merchantName: string,
  merchantCity: string,
): string {
  if (!/^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(key)) {
    throw new Error("É necessário usar uma chave Pix aleatória válida");
  }
  if (!/^[A-Z0-9 ]{1,25}$/.test(merchantName) ||
      !/^[A-Z0-9 ]{1,15}$/.test(merchantCity)) {
    throw new Error("Nome ou cidade fora dos limites do BR Code");
  }
  const account = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  const data =
    tlv("00", "01") + tlv("01", "11") + tlv("26", account) +
    tlv("52", "0000") + tlv("53", "986") + tlv("58", "BR") +
    tlv("59", merchantName) + tlv("60", merchantCity) +
    tlv("62", tlv("05", "***")) + "6304";
  return data + pixCrc16(data);
}

export const RUIDO_PIX_COPIA_E_COLA =
  createPixBrCode(RUIDO_PIX_KEY, RUIDO_PIX_NOME, RUIDO_PIX_CIDADE);
