const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'food-rules-data.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const foodNames = Object.keys(data);
console.log(JSON.stringify(foodNames));
