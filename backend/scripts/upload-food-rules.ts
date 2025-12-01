import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadFoodRules() {
  // JSON 파일 읽기
  const jsonPath = path.join(__dirname, 'food-rules-data.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const foodData = JSON.parse(rawData);

  console.log('=== 음식 규칙 데이터 업로드 시작 ===');

  for (const [foodName, data] of Object.entries(foodData)) {
    const d: any = data;
    const row = {
      food_name: foodName,
      base_score: d.baseScore,
      summary: d.summary,
      pros: d.pros,
      cons: d.cons,
      expert_advice: d.expertAdvice,
      nutrients: d.nutrients,
      disease_analysis: d.diseaseAnalysis,
    };

    // Upsert (있으면 업데이트, 없으면 삽입)
    const { error } = await supabase
      .from('food_rules')
      .upsert(row, { onConflict: 'food_name' });

    if (error) {
      console.error(`❌ ${foodName} 업로드 실패:`, error.message);
    } else {
      console.log(`✅ ${foodName} 업로드 성공`);
    }
  }

  console.log('=== 업로드 완료 ===');
}

uploadFoodRules().catch(console.error);
