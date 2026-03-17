import { getAuthConfigTemplate, AUTH_CONFIG_HINTS, PLACEHOLDER_URLS, AUTH_FIELDS } from '../../constants/apiConfigDefaults';

describe('AUTH_FIELDS', () => {
  it('exports expected field constants', () => {
    expect(AUTH_FIELDS.USERNAME).toBe('username');
    expect(AUTH_FIELDS.CREDENTIAL).toBe('password');
    expect(AUTH_FIELDS.TOKEN).toBe('token');
    expect(AUTH_FIELDS.KEY_NAME).toBe('key_name');
    expect(AUTH_FIELDS.KEY_VALUE).toBe('key_value');
    expect(AUTH_FIELDS.KEY_LOCATION).toBe('key_location');
    expect(AUTH_FIELDS.CLIENT_ID).toBe('client_id');
    expect(AUTH_FIELDS.CLIENT_SECRET).toBe('client_secret');
    expect(AUTH_FIELDS.GRANT_TYPE).toBe('grant_type');
  });
});

describe('getAuthConfigTemplate', () => {
  it('returns basic auth template', () => {
    const result = getAuthConfigTemplate('basic');
    expect(result).toEqual({ username: '', password: '' });
  });

  it('returns bearer token template', () => {
    const result = getAuthConfigTemplate('bearer');
    expect(result).toEqual({ token: '' });
  });

  it('returns api_key template with defaults', () => {
    const result = getAuthConfigTemplate('api_key');
    expect(result.key_name).toBe('X-API-Key');
    expect(result.key_value).toBe('');
    expect(result.key_location).toBe('header');
  });

  it('returns login_token template with all fields', () => {
    const result = getAuthConfigTemplate('login_token');
    expect(result.login_endpoint).toBe('');
    expect(result.login_method).toBe('POST');
    expect(result.username_field).toBe('email');
    expect(result.password_field).toBe('password');
    expect(result.username).toBe('');
    expect(result.password).toBe('');
    expect(result.extra_body).toEqual({});
    expect(result.token_response_path).toBe('access_token');
    expect(result.token_type).toBe('Bearer');
    expect(result.token_header_name).toBe('Authorization');
  });

  it('returns oauth2 template with all fields', () => {
    const result = getAuthConfigTemplate('oauth2');
    expect(result.token_endpoint).toBe('');
    expect(result.client_id).toBe('');
    expect(result.client_secret).toBe('');
    expect(result.scope).toBe('');
    expect(result.grant_type).toBe('client_credentials');
    expect(result.audience).toBe('');
    expect(result.extra_params).toEqual({});
    expect(result.token_response_path).toBe('access_token');
    expect(result.token_type).toBe('Bearer');
    expect(result.token_header_name).toBe('Authorization');
  });

  it('returns empty object for unknown auth type', () => {
    expect(getAuthConfigTemplate('unknown')).toEqual({});
  });

  it('returns empty object for undefined', () => {
    expect(getAuthConfigTemplate(undefined)).toEqual({});
  });
});

describe('AUTH_CONFIG_HINTS', () => {
  it('has hint for basic auth', () => {
    expect(AUTH_CONFIG_HINTS.basic).toContain('username');
    expect(AUTH_CONFIG_HINTS.basic).toContain('password');
  });

  it('has hint for bearer auth', () => {
    expect(AUTH_CONFIG_HINTS.bearer).toContain('token');
  });

  it('has hint for api_key auth', () => {
    expect(AUTH_CONFIG_HINTS.api_key).toContain('key_name');
    expect(AUTH_CONFIG_HINTS.api_key).toContain('key_value');
    expect(AUTH_CONFIG_HINTS.api_key).toContain('key_location');
  });

  it('hints are valid JSON strings', () => {
    Object.values(AUTH_CONFIG_HINTS).forEach((hint) => {
      expect(() => JSON.parse(hint)).not.toThrow();
    });
  });
});

describe('PLACEHOLDER_URLS', () => {
  it('exports expected placeholder keys', () => {
    expect(PLACEHOLDER_URLS.API_ENDPOINT).toBeDefined();
    expect(PLACEHOLDER_URLS.PROXY).toBeDefined();
    expect(PLACEHOLDER_URLS.LOGIN_ENDPOINT).toBeDefined();
    expect(PLACEHOLDER_URLS.OAUTH_TOKEN_ENDPOINT).toBeDefined();
    expect(PLACEHOLDER_URLS.OAUTH_AUDIENCE).toBeDefined();
    expect(PLACEHOLDER_URLS.JIRA_TICKET).toBeDefined();
  });

  it('all values are non-empty strings', () => {
    Object.values(PLACEHOLDER_URLS).forEach((val) => {
      expect(typeof val).toBe('string');
      expect(val.length).toBeGreaterThan(0);
    });
  });
});
