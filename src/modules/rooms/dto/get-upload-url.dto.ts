import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { AllowedImageMimeType } from '../types/allowed-image-mime.type';

export class GetUploadUrlDto {
  @IsEnum(AllowedImageMimeType, {
    message: 'Only PNG, JPEG, and JPG files are allowed',
  })
  mimetype: AllowedImageMimeType;

  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024, { message: 'File size must not exceed 5MB' })
  size: number;
}
