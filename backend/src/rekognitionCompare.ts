import {
  CompareFacesCommand,
  RekognitionClient,
  type CompareFacesCommandOutput,
} from '@aws-sdk/client-rekognition';

export function isRekognitionConfigured(): boolean {
  return Boolean(
    process.env.AWS_REGION?.trim() &&
      process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim()
  );
}

function rekognitionClient(): RekognitionClient {
  return new RekognitionClient({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

/** Decode data URL or fetch HTTPS URL into raw bytes (JPEG/PNG). */
export async function imageReferenceToBuffer(ref: string): Promise<Buffer> {
  const s = ref.trim();
  if (s.startsWith('data:')) {
    const comma = s.indexOf(',');
    if (comma === -1) throw new Error('Invalid data URL');
    return Buffer.from(s.slice(comma + 1), 'base64');
  }
  if (s.startsWith('http://') || s.startsWith('https://')) {
    const res = await fetch(s, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
    const arr = new Uint8Array(await res.arrayBuffer());
    if (arr.length > 15 * 1024 * 1024) throw new Error('Image too large');
    return Buffer.from(arr);
  }
  throw new Error('Unsupported image reference');
}

export function parseVerificationImageBody(body: string): Buffer {
  const trimmed = body.trim();
  if (trimmed.startsWith('data:')) {
    const comma = trimmed.indexOf(',');
    if (comma === -1) throw new Error('Invalid data URL');
    return Buffer.from(trimmed.slice(comma + 1), 'base64');
  }
  return Buffer.from(trimmed, 'base64');
}

/**
 * Compare profile reference photo to a live selfie using AWS Rekognition.
 * Returns ok only when Rekognition finds a face match above the similarity threshold.
 */
export async function compareProfilePhotoToSelfie(
  profilePhotoBytes: Buffer,
  selfieBytes: Buffer
): Promise<
  | { ok: true; similarity: number }
  | {
      ok: false;
      code: 'no_match' | 'config' | 'aws' | 'bad_image';
      message: string;
    }
> {
  if (!isRekognitionConfigured()) {
    return {
      ok: false,
      code: 'config',
      message:
        'Face verification is not configured. Add AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY to backend/.env.local. IAM permission: rekognition:CompareFaces.',
    };
  }

  const threshold = Math.min(
    99,
    Math.max(70, Number(process.env.REKOGNITION_MIN_SIMILARITY || '88'))
  );

  try {
    const out: CompareFacesCommandOutput = await rekognitionClient().send(
      new CompareFacesCommand({
        SourceImage: { Bytes: profilePhotoBytes },
        TargetImage: { Bytes: selfieBytes },
        SimilarityThreshold: threshold,
      })
    );
    const matches = out.FaceMatches ?? [];
    if (matches.length === 0) {
      return {
        ok: false,
        code: 'no_match',
        message:
          'The selfie did not match your profile picture. Use a clear, well-lit front-facing photo of yourself that matches your profile image.',
      };
    }
    const best = matches[0]!;
    return { ok: true, similarity: best.Similarity ?? 0 };
  } catch (e: unknown) {
    const name =
      e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
    const msg = e instanceof Error ? e.message : String(e);

    if (
      name === 'InvalidParameterException' ||
      /face|not satisfy|There are no faces|unable to detect/i.test(msg)
    ) {
      return {
        ok: false,
        code: 'bad_image',
        message:
          'Could not detect a face clearly in one or both images. Try a front-facing portrait on your profile and a similar angle in your selfie.',
      };
    }

    if (name === 'InvalidImageFormatException' || /format/i.test(msg)) {
      return {
        ok: false,
        code: 'bad_image',
        message: 'Unsupported image format. Use JPG or PNG.',
      };
    }

    return {
      ok: false,
      code: 'aws',
      message: `Face verification service error: ${msg}`,
    };
  }
}
