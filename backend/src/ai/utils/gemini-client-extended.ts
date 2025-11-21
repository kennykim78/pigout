import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { GeminiPrompts } from './gemini-prompts';

@Injectable()
export class GeminiClientExtended {
  private genAI: GoogleGenerativeAI;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  /**
   * Flash: 빠른 종합 평가
   */
  async flashAnalyze(
    foodName: string,
    medicines: string[],
    diseases: string[],
  ): Promise<any> {
    const prompt = GeminiPrompts.buildFlashPrompt(foodName, medicines, diseases);
    
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      return this.extractJsonObject(response);
    } catch (error) {
      console.error('Flash analyze error:', error.message);
      // Fallback to v1 REST API
      return this.callV1GenerateContent('gemini-2.0-flash-exp', prompt);
    }
  }

  /**
   * Pro: 상세 건강 분석
   */
  async proAnalyze(
    foodName: string,
    medicines: Array<{ name: string; purpose: string }>,
    diseases: string[],
    flashScore: number,
  ): Promise<any> {
    const prompt = GeminiPrompts.buildProPrompt(foodName, medicines, diseases, flashScore);
    
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      return this.extractJsonObject(response);
    } catch (error) {
      console.error('Pro analyze error:', error.message);
      // Fallback to v1 REST API
      return this.callV1GenerateContent('gemini-2.0-flash-exp', prompt);
    }
  }

  /**
   * 텍스트에서 음식 이름 추출
   */
  async extractFoodName(userInput: string): Promise<string> {
    const prompt = GeminiPrompts.buildExtractFoodNamePrompt(userInput);
    
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const result = await model.generateContent(prompt);
      const foodName = result.response.text().trim();
      
      return foodName;
    } catch (error) {
      console.error('Extract food name error:', error.message);
      const result = await this.callV1GenerateContent('gemini-2.0-flash-exp', prompt);
      return result.text?.trim() || userInput;
    }
  }

  /**
   * V1 REST API 호출 (Fallback)
   */
  private async callV1GenerateContent(modelName: string, prompt: string): Promise<any> {
    const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    };

    try {
      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // JSON 추출 시도
      try {
        return this.extractJsonObject(text);
      } catch {
        return { text };
      }
    } catch (error) {
      console.error('V1 API call failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * JSON 객체 추출 (마크다운 코드 블록 제거)
   */
  private extractJsonObject(text: string): any {
    let cleaned = text.trim();

    // 마크다운 코드 블록 제거
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

    // JSON 객체 추출
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('No JSON object found in response');
    }

    const jsonStr = match[0];
    return JSON.parse(jsonStr);
  }
}
