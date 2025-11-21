const axios = require('axios');

const SERVICE_KEY = 'cabe7a5f0fe9d0d13d6f2f61fa27635d52d2a38f85a8d6ab7d56a08c0666963c';
const RECIPE_KEY = 'e2bed7f054fe4a38863f';

async function run(name, fn) {
  console.log('\n==============================');
  console.log(`▶ 테스트: ${name}`);
  console.log('==============================');
  try {
    await fn();
    console.log(`✅ ${name} 성공`);
  } catch (err) {
    console.log(`❌ ${name} 실패`);
    if (err.response) {
      console.log('status:', err.response.status);
      console.log('data:', err.response.data);
    } else {
      console.log('error:', err.message);
    }
  }
}

async function testFoodNutrition() {
  const url = 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq';
  const params = {
    serviceKey: SERVICE_KEY,
    pageNo: 1,
    numOfRows: 3,
    type: 'json',
    FOOD_NM_KR: '국밥_돼지머리',
    RESEARCH_YMD: '20171231',
    FOOD_CAT1_NM: '밥류',
    UPDATE_DATE: '20250123',
    DB_CLASS_NM: '품목대표',
  };
  Object.keys(params).forEach((key) => {
    if (params[key] === '' || params[key] === undefined || params[key] === null) {
      delete params[key];
    }
  });
  console.log('URL:', url);
  console.log('params:', params);
  const res = await axios.get(url, { params, timeout: 10000 });
  console.log('status:', res.status);
  console.dir(res.data, { depth: 4 });
}

async function testDiseaseInfo() {
  const url = 'https://apis.data.go.kr/B551182/diseaseInfoService1/getDiseaseInfo';
  const params = {
    serviceKey: SERVICE_KEY,
    pageNo: 1,
    numOfRows: 3,
    sickNm: '감기',
  };
  console.log('URL:', url);
  console.log('params:', params);
  const res = await axios.get(url, { params, timeout: 10000, responseType: 'text' });
  console.log('status:', res.status);
  console.log('body (xml length):', typeof res.data === 'string' ? res.data.length : 'not string');
}

async function testEasyDrugInfo() {
  const url = 'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList';
  const params = {
    serviceKey: SERVICE_KEY,
    pageNo: 1,
    numOfRows: 3,
    type: 'json',
    itemName: '타이레놀',
  };
  console.log('URL:', url);
  console.log('params:', params);
  const res = await axios.get(url, { params, timeout: 10000 });
  console.log('status:', res.status);
  console.dir(res.data, { depth: 4 });
}

async function testHtfsInfo() {
  const url = 'https://apis.data.go.kr/1471000/HtfsInfoService03/getIndivFuncFoodList';
  const params = {
    serviceKey: SERVICE_KEY,
    pageNo: 1,
    numOfRows: 3,
    type: 'json',
    prdlst_nm: '비타민',
  };
  console.log('URL:', url);
  console.log('params:', params);
  const res = await axios.get(url, { params, timeout: 10000 });
  console.log('status:', res.status);
  console.dir(res.data, { depth: 4 });
}

async function testPillId() {
  const url = 'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList';
  const params = {
    serviceKey: SERVICE_KEY,
    pageNo: 1,
    numOfRows: 3,
    type: 'json',
    item_name: '타이레놀',
  };
  console.log('URL:', url);
  console.log('params:', params);
  const res = await axios.get(url, { params, timeout: 10000 });
  console.log('status:', res.status);
  console.dir(res.data, { depth: 4 });
}

async function testDrugPermit() {
  const url = 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnInq';
  const params = {
    serviceKey: SERVICE_KEY,
    pageNo: 1,
    numOfRows: 3,
    type: 'json',
    item_name: '타이레놀',
  };
  console.log('URL:', url);
  console.log('params:', params);
  const res = await axios.get(url, { params, timeout: 10000 });
  console.log('status:', res.status);
  console.dir(res.data, { depth: 4 });
}

async function testRecipe() {
  const fullUrl = `http://openapi.foodsafetykorea.go.kr/api/${RECIPE_KEY}/COOKRCP01/json/1/3`;
  console.log('URL:', fullUrl);
  const res = await axios.get(fullUrl, { timeout: 10000 });
  console.log('status:', res.status);
  console.dir(res.data, { depth: 4 });
}

async function main() {
  await run('식품영양성분DB', testFoodNutrition);
  await run('질병정보서비스', testDiseaseInfo);
  await run('의약품개요정보(e약은요)', testEasyDrugInfo);
  await run('건강기능식품정보', testHtfsInfo);
  await run('의약품 낱알식별 정보', testPillId);
  await run('의약품 제품 허가정보', testDrugPermit);
  await run('조리식품 레시피DB', testRecipe);
}

main();
