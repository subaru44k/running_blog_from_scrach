import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});
const cache = new Map<string, string>();

export const getSecretString = async (secretId: string) => {
  if (!secretId) throw new Error('Missing secret id');
  const cached = cache.get(secretId);
  if (cached) return cached;
  const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  const value = result.SecretString;
  if (!value) throw new Error(`SecretString not found for ${secretId}`);
  cache.set(secretId, value);
  return value;
};
