require('dotenv').config({ path: __dirname + '/.env' });
const { GeminiClient } = require('./src/ai/utils/gemini.client.ts');

async function test() {
  const client = new (require('ts-node').register(), require('./src/ai/utils/gemini.client.ts').GeminiClient)(process.env.GEMINI_API_KEY);
  
  console.log('Testing Gemini extractFoodNameFromText...');
  const foodName = await client.extractFoodNameFromText('김치찌개');
  console.log(' Food name extracted:', foodName);
  
  console.log('\nTesting analyzeFoodSuitability...');
  const suitability = await client.analyzeFoodSuitability(foodName, ['diabetes']);
  console.log(' Suitability analysis:');
  console.log('  Summary:', suitability.summary);
  console.log('  Pros:', suitability.pros.substring(0, 50) + '...');
  console.log('  Cons:', suitability.cons.substring(0, 50) + '...');
  
  console.log('\n AI module working correctly!');
}

test().catch(err => {
  console.error(' Test failed:', err.message);
  process.exit(1);
});
