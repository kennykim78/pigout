import { IsOptional, IsArray } from 'class-validator';

export class AnalyzeAllMedicinesDto {
  @IsOptional()
  @IsArray()
  medicineIds?: string[];
}
