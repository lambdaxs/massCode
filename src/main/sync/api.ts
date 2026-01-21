import type {
  LoginRequest,
  LoginResponse,
  PullRequest,
  PullResponse,
  PushRequest,
  PushResponse,
  RegisterRequest,
  RegisterResponse,
} from './types'
/**
 * Sync API client for massCode
 */
import ky from 'ky'

export class SyncApiClient {
  private apiKey: string
  private serverUrl: string

  constructor(apiKey: string, serverUrl: string) {
    this.apiKey = apiKey
    this.serverUrl = serverUrl.replace(/\/$/, '') // Remove trailing slash
  }

  private get client() {
    return ky.create({
      prefixUrl: this.serverUrl,
      headers: {
        'X-API-Key': this.apiKey,
      },
    })
  }

  /**
   * Pull data from server
   */
  async pull(request: PullRequest): Promise<PullResponse> {
    return await this.client
      .post('api/v1/sync/pull', {
        json: request,
      })
      .json<PullResponse>()
  }

  /**
   * Push data to server
   */
  async push(request: PushRequest): Promise<PushResponse> {
    return await this.client
      .post('api/v1/sync/push', {
        json: request,
      })
      .json<PushResponse>()
  }

  /**
   * Register a new user
   */
  static async register(
    serverUrl: string,
    request: RegisterRequest,
  ): Promise<RegisterResponse> {
    const url = serverUrl.replace(/\/$/, '')
    return await ky
      .post(`${url}/api/v1/auth/register`, {
        json: request,
      })
      .json<RegisterResponse>()
  }

  /**
   * Validate API key and login
   */
  static async login(
    serverUrl: string,
    request: LoginRequest,
  ): Promise<LoginResponse> {
    const url = serverUrl.replace(/\/$/, '')
    return await ky
      .post(`${url}/api/v1/auth/login`, {
        json: request,
      })
      .json<LoginResponse>()
  }

  /**
   * Get sync status
   */
  async getStatus(): Promise<{
    stats: {
      total_folders: number
      total_snippets: number
      total_tags: number
    }
  }> {
    return await this.client.get('api/v1/sync/status').json()
  }
}
