import { IsUUID, IsNotEmpty } from 'class-validator';

export class ClaimRewardDto {
  @IsUUID()
  @IsNotEmpty()
  rewardId: string;
}
