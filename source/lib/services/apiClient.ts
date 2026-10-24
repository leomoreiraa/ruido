// lib/services/apiClient.ts

export interface RateLimiterConfig {
  baseUrl: string;
  maxConcurrency: number;
  minIntervalMs: number;
  maxRetries: number;
  baseBackoffMs: number;
  timeoutMs?: number;
}

export class FatalHttpError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "FatalHttpError";
  }
}

export class ThrottledApiClient {
  private activeCount = 0;
  private waitQueue: Array<() => void> = [];
  private lastDispatchedAt = 0;

  constructor(private readonly config: RateLimiterConfig) {}

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async acquire(): Promise<void> {
    if (this.activeCount >= this.config.maxConcurrency) {
      await new Promise<void>((resolve) => this.waitQueue.push(resolve));
    }
    this.activeCount++;

    const now = Date.now();
    const diff = now - this.lastDispatchedAt;
    if (diff < this.config.minIntervalMs) {
      await this.sleep(this.config.minIntervalMs - diff);
    }
    this.lastDispatchedAt = Date.now();
  }

  private release(): void {
    this.activeCount--;
    const next = this.waitQueue.shift();
    if (next) next();
  }

  public async fetchJson<T>(
    pathOrUrl: string,
    options: {
      headers?: Record<string, string>;
      timeoutMs?: number;
      acceptStatuses?: number[];
    } = {}
  ): Promise<T> {
    const base = this.config.baseUrl.replace(/\/$/, "");
    const url = pathOrUrl.startsWith("http")
      ? pathOrUrl
      : `${base}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs ?? 25000;
    const acceptStatuses = options.acceptStatuses ?? [];

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      await this.acquire();

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "RadarCongresso/1.0 (Civic Intelligence Monitor)",
            ...(options.headers || {}),
          },
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });

        if (response.ok) {
          const text = await response.text();
          if (!text || text.trim() === "") {
            return {} as T;
          }
          try {
            return JSON.parse(text) as T;
          } catch (parseErr) {
            throw new FatalHttpError(
              `Falha ao parsear JSON de ${url}: ${
                parseErr instanceof Error ? parseErr.message : String(parseErr)
              }. Conteúdo truncado: ${text.slice(0, 150)}`
            );
          }
        }

        if (acceptStatuses.includes(response.status)) {
          return null as unknown as T;
        }

        const shouldRetry =
          response.status === 429 ||
          response.status === 500 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504;

        if (shouldRetry && attempt < this.config.maxRetries) {
          const retryAfter = response.headers.get("retry-after");
          const waitTime =
            retryAfter && !Number.isNaN(Number(retryAfter))
              ? Number(retryAfter) * 1000
              : this.config.baseBackoffMs * Math.pow(2, attempt) +
                Math.floor(Math.random() * 400);

          console.warn(
            `[ThrottledClient] HTTP ${response.status} em ${url}. Aguardando ${waitTime}ms (tentativa ${
              attempt + 1
            }/${this.config.maxRetries})`
          );
          await this.sleep(waitTime);
          continue;
        }

        const bodySnippet = await response.text().catch(() => "");
        throw new FatalHttpError(
          `Falha HTTP ${response.status} ao requisitar ${url}. Resposta: ${bodySnippet.slice(
            0,
            200
          )}`,
          response.status
        );
      } catch (err) {
        if (err instanceof FatalHttpError || attempt >= this.config.maxRetries) {
          throw err;
        }
        const waitTime =
          this.config.baseBackoffMs * Math.pow(2, attempt) +
          Math.floor(Math.random() * 400);
        console.warn(
          `[ThrottledClient] Erro de rede em ${url} (${
            err instanceof Error ? err.message : String(err)
          }). Tentativa ${attempt + 1}/${this.config.maxRetries} em ${waitTime}ms`
        );
        await this.sleep(waitTime);
      } finally {
        this.release();
      }
    }

    throw new Error(`Número máximo de tentativas excedido para ${url}`);
  }
}

export const camaraApiClient = new ThrottledApiClient({
  baseUrl: "https://dadosabertos.camara.leg.br/api/v2",
  maxConcurrency: 1,
  minIntervalMs: 800,
  maxRetries: 6,
  baseBackoffMs: 1200,
  timeoutMs: 25000,
});

export const senadoApiClient = new ThrottledApiClient({
  baseUrl: "https://legis.senado.leg.br/dadosabertos",
  maxConcurrency: 1,
  minIntervalMs: 1200,
  maxRetries: 4,
  baseBackoffMs: 1200,
  timeoutMs: 30000,
});
