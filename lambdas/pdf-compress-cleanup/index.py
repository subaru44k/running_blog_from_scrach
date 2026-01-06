import os
import boto3
from datetime import datetime, timezone, timedelta

def _parse_prefixes(value):
    if not value:
        return []
    return [p.strip() for p in value.split(',') if p.strip()]


def handler(event, context):
    bucket = os.environ.get('BUCKET')
    prefixes = _parse_prefixes(os.environ.get('PREFIXES', ''))
    ttl_seconds = int(os.environ.get('TTL_SECONDS', '3600'))

    if not bucket or not prefixes:
        raise ValueError('BUCKET and PREFIXES must be set')

    s3 = boto3.client('s3')
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=ttl_seconds)

    total_scanned = 0
    total_deleted = 0

    for prefix in prefixes:
        scanned = 0
        deleted = 0
        continuation = None
        while True:
            kwargs = {
                'Bucket': bucket,
                'Prefix': prefix,
                'MaxKeys': 1000,
            }
            if continuation:
                kwargs['ContinuationToken'] = continuation
            resp = s3.list_objects_v2(**kwargs)
            contents = resp.get('Contents', [])
            scanned += len(contents)

            delete_keys = []
            for obj in contents:
                key = obj.get('Key')
                last_modified = obj.get('LastModified')
                if not key or not last_modified:
                    continue
                if not key.startswith(prefix):
                    # Guard: do not delete outside prefix
                    continue
                if last_modified <= cutoff:
                    delete_keys.append({'Key': key})

            if delete_keys:
                # Delete up to 1000 per request
                for i in range(0, len(delete_keys), 1000):
                    chunk = delete_keys[i:i+1000]
                    s3.delete_objects(Bucket=bucket, Delete={'Objects': chunk})
                    deleted += len(chunk)

            if resp.get('IsTruncated'):
                continuation = resp.get('NextContinuationToken')
            else:
                break

        total_scanned += scanned
        total_deleted += deleted
        print(f"prefix={prefix} scanned={scanned} deleted={deleted}")

    print(f"total scanned={total_scanned} deleted={total_deleted}")
    return {
        'bucket': bucket,
        'prefixes': prefixes,
        'ttl_seconds': ttl_seconds,
        'scanned': total_scanned,
        'deleted': total_deleted,
    }
