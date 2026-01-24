import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getSignedUrl as signUrl } from '@aws-sdk/cloudfront-signer';
import { CF_PRIVATE_KEY_SECRET_ID, CF_KEY_PAIR_ID, CLOUDFRONT_DOMAIN, IMAGE_TTL_SECONDS } from './env';

const secrets = new SecretsManagerClient({});
let cachedPrivateKey: string | null = null;

const loadPrivateKey = async () => {
  if (cachedPrivateKey) return cachedPrivateKey;
  const resp = await secrets.send(new GetSecretValueCommand({ SecretId: CF_PRIVATE_KEY_SECRET_ID }));
  if (!resp.SecretString) throw new Error('SecretString missing for CloudFront key');
  cachedPrivateKey = resp.SecretString;
  return cachedPrivateKey;
};

export const buildSignedUrl = async (key: string, expiresIn = IMAGE_TTL_SECONDS) => {
  const privateKey = await loadPrivateKey();
  const resourceUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`;
  const expires = new Date(Date.now() + expiresIn * 1000).toISOString();
  return signUrl({
    url: resourceUrl,
    keyPairId: CF_KEY_PAIR_ID,
    privateKey,
    dateLessThan: expires,
  });
};
