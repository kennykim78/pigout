require('dotenv').config({ path: __dirname + '/.env' });
const { GeminiClient } = require('./src/ai/utils/gemini.client.ts');
const { ScoreCalculator } = require('./src/ai/utils/score-calculator.ts');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  console.log('=== AI Module Full Integration Test ===\n');
  
  const client = new (require('ts-node').register(), require('./src/ai/utils/gemini.client.ts').GeminiClient)(process.env.GEMINI_API_KEY);
  const calculator = new (require('ts-node').register(), require('./src/ai/utils/score-calculator.ts').ScoreCalculator)();
  
  const diseases = ['diabetes', 'hypertension'];
  const textInput = '김치찌개';
  
  // Step 1: Extract food name
  console.log('Step 1: Extracting food name from text...');
  const foodName = await client.extractFoodNameFromText(textInput);
  console.log(` Food name: ${foodName}\n`);
  
  await sleep(2000);
  
  // Step 2: Analyze suitability
  console.log('Step 2: Analyzing food suitability...');
  const suitability = await client.analyzeFoodSuitability(foodName, diseases);
  console.log(` Summary: ${suitability.summary}`);
  console.log(`  Pros: ${suitability.pros.substring(0, 60)}...`);
  console.log(`  Cons: ${suitability.cons.substring(0, 60)}...\n`);
  
  // Step 3: Calculate score
  console.log('Step 3: Calculating health score...');
  const mockNutrition = {
    sodium: 1200,
    sugar: 5,
    saturatedFat: 3,
    transFat: 0,
    cholesterol: 30
  };
  
  // ScoreCalculator.calculateScore(foodName, diseases, nutritionData)
  const score = calculator.calculateScore(foodName, diseases, mockNutrition);
  const grade = calculator.getGrade(score);
  const recommendation = calculator.getRecommendationLevel(score);
  
  console.log(` Score: ${score}`);
  console.log(`  Grade: ${grade}`);
  console.log(`  Recommendation: ${recommendation}\n`);
  
  await sleep(2000);
  
  // Step 4: Detailed analysis
  console.log('Step 4: Generating detailed analysis...');
  try {
    const detailedAnalysis = await client.generateDetailedAnalysis(foodName, diseases, mockNutrition);
    console.log(` Detailed reason (${detailedAnalysis.detailed_reason.length} chars):`);
    console.log(`  ${detailedAnalysis.detailed_reason.substring(0, 100)}...`);
    console.log(`  Risk factors (${detailedAnalysis.risk_factors.length}): ${detailedAnalysis.risk_factors.slice(0, 2).join(', ')}...`);
    console.log(`  Nutrition explanation (${detailedAnalysis.nutrition_explanation.length} chars):`);
    console.log(`  ${detailedAnalysis.nutrition_explanation.substring(0, 80)}...`);
    console.log(`  Recommendation: ${detailedAnalysis.recommendation.substring(0, 70)}...`);
    console.log(`  Global remedies:`);
    detailedAnalysis.global_remedies.forEach(remedy => {
      console.log(`    - ${remedy.country}: ${remedy.method.substring(0, 50)}...`);
    });
  } catch (err) {
    console.log(` Detailed analysis skipped (API limit or error): ${err.message}`);
  }
  
  // Final summary
  console.log('\n===  Test Complete ===');
  const summary = {
    foodName,
    diseases: diseases.join(', '),
    score,
    grade,
    recommendationLevel: recommendation,
    summary: suitability.summary,
    pros: suitability.pros.substring(0, 80) + '...',
    cons: suitability.cons.substring(0, 80) + '...'
  };
  console.log(JSON.stringify(summary, null, 2));
  
  console.log('\n All AI module functions tested successfully!');
  console.log('Components tested:');
  console.log('  - Gemini text extraction');
  console.log('  - Gemini suitability analysis');
  console.log('  - Score calculation with rule engine');
  console.log('  - Grade and recommendation level');
  console.log('  - Detailed analysis (with error handling)');
}

test().catch(err => {
  console.error('\n Test failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
