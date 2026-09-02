import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { S3Service } from 'src/modules/s3/services/s3.service';

jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn();

  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: jest
      .fn()
      .mockImplementation((input) => ({ __type: 'PutObjectCommand', input })),
    DeleteObjectCommand: jest.fn().mockImplementation((input) => ({
      __type: 'DeleteObjectCommand',
      input,
    })),
    HeadObjectCommand: jest
      .fn()
      .mockImplementation((input) => ({ __type: 'HeadObjectCommand', input })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('S3Service', () => {
  let service: S3Service;
  let configService: Partial<Record<keyof ConfigService, jest.Mock>>;

  const mockedS3Client = S3Client as unknown as jest.Mock;
  const mockedPutObjectCommand = PutObjectCommand as unknown as jest.Mock;
  const mockedDeleteObjectCommand = DeleteObjectCommand as unknown as jest.Mock;
  const mockedHeadObjectCommand = HeadObjectCommand as unknown as jest.Mock;
  const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<
    typeof getSignedUrl
  >;

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'AWS_REGION') return 'us-east-1';
        if (key === 'AWS_S3_BUCKET') return 'room-hub-bucket';
        throw new Error(`Unexpected key: ${key}`);
      }),
    };

    service = new S3Service(configService as ConfigService);
  });

  it('creates S3 client with configured region', () => {
    expect(mockedS3Client).toHaveBeenCalledWith({ region: 'us-east-1' });
    expect(configService.getOrThrow).toHaveBeenCalledWith('AWS_REGION');
    expect(configService.getOrThrow).toHaveBeenCalledWith('AWS_S3_BUCKET');
  });

  it('returns a signed upload url', async () => {
    mockedGetSignedUrl.mockResolvedValue('https://signed-upload-url');

    const result = await service.getUploadUrl(
      'room_images/room-1.png',
      'image/png',
    );

    expect(mockedPutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'room-hub-bucket',
      Key: 'room_images/room-1.png',
      ContentType: 'image/png',
    });
    expect(mockedGetSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ __type: 'PutObjectCommand' }),
      { expiresIn: 300 },
    );
    expect(result).toBe('https://signed-upload-url');
  });

  it('builds the public url for an object key', () => {
    const result = service.getPublicUrl('room_images/room-1.png');

    expect(result).toBe(
      'https://room-hub-bucket.s3.us-east-1.amazonaws.com/room_images/room-1.png',
    );
  });

  it('extracts key from full S3 url', () => {
    const result = service.extractKeyFromUrl(
      'https://room-hub-bucket.s3.us-east-1.amazonaws.com/room_images/room-1.png',
    );

    expect(result).toBe('room_images/room-1.png');
  });

  it('returns original string when URL marker is not present', () => {
    const result = service.extractKeyFromUrl('room_images/room-1.png');

    expect(result).toBe('room_images/room-1.png');
  });

  it('returns true when file exists in S3', async () => {
    const send = mockedS3Client.mock.results[0].value.send as jest.Mock;
    send.mockResolvedValue({});

    await expect(service.fileExists('room_images/room-1.png')).resolves.toBe(
      true,
    );
    expect(mockedHeadObjectCommand).toHaveBeenCalledWith({
      Bucket: 'room-hub-bucket',
      Key: 'room_images/room-1.png',
    });
  });

  it('returns false when file does not exist in S3', async () => {
    const send = mockedS3Client.mock.results[0].value.send as jest.Mock;
    send.mockRejectedValue(new Error('NotFound'));

    await expect(service.fileExists('room_images/missing.png')).resolves.toBe(
      false,
    );
  });

  it('sends delete command to S3', async () => {
    const send = mockedS3Client.mock.results[0].value.send as jest.Mock;
    send.mockResolvedValue({});

    await service.deleteFile('room_images/room-1.png');

    expect(mockedDeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'room-hub-bucket',
      Key: 'room_images/room-1.png',
    });
  });

  it('swallows delete errors', async () => {
    const send = mockedS3Client.mock.results[0].value.send as jest.Mock;
    send.mockRejectedValue(new Error('delete failed'));

    await expect(
      service.deleteFile('room_images/room-1.png'),
    ).resolves.toBeUndefined();
  });
});
