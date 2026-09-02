import { IsString, IsNotEmpty } from 'class-validator';

export class ConfirmImageUploadDto {
  @IsString()
  @IsNotEmpty()
  key: string;
}
