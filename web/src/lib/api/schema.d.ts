export interface components {
  headers: never
  parameters: never
  pathItems: never
  requestBodies: never
  responses: never
  schemas: {
    AccessToken: { access_token: string }
    AuthSession: {
      access_token: string
      expires_in: number
      token_type: 'Bearer'
      user: components['schemas']['User']
    }
    ApiError: { code: string; message: string; request_id: string; status: number }
    CreateUserBody: {
      email: string
      first_name: string
      last_name: string
      phone_number: string
      role: components['schemas']['Role']
    }
    Login: { email: string; password: string }
    Role: 'admin' | 'employee' | 'manager'
    User: {
      created_at?: string
      email: string
      first_name: string
      id: string
      last_name: string
      phone_number: null | string
      role: components['schemas']['Role']
    }
  }
}

type Json<T> = { content: { 'application/json': T }; headers: Record<string, unknown> }
type Envelope<T> = Json<{ data: T; event: null | string }>
type Body<T> = { content: { 'application/json': T } }

export interface paths {
  '/v1/auth/login': {
    post: {
      requestBody: Body<components['schemas']['Login']>
      responses: {
        200: Envelope<components['schemas']['AuthSession']>
        401: Json<components['schemas']['ApiError']>
        429: Json<components['schemas']['ApiError']>
      }
    }
  }
  '/v1/auth/logout': {
    post: { responses: { 200: Envelope<null> } }
  }
  '/v1/auth/me': {
    get: {
      responses: {
        200: Envelope<components['schemas']['User']>
        401: Json<components['schemas']['ApiError']>
      }
    }
  }
  '/v1/auth/refresh': {
    post: {
      responses: {
        200: Envelope<components['schemas']['AuthSession']>
        401: Json<components['schemas']['ApiError']>
      }
    }
  }
  '/v1/users/list': {
    post: {
      requestBody?: Body<Record<string, never>>
      responses: {
        200: Envelope<components['schemas']['User'][]>
        403: Json<components['schemas']['ApiError']>
      }
    }
  }
  '/v1/users/new': {
    post: {
      requestBody: Body<components['schemas']['CreateUserBody']>
      responses: {
        201: Envelope<components['schemas']['User']>
        409: Json<components['schemas']['ApiError']>
        422: Json<components['schemas']['ApiError']>
      }
    }
  }
}
