const fs = require('fs');
const path = 'src/postman/Qpulse_Finance_API.postman_collection.json';
const col = JSON.parse(fs.readFileSync(path, 'utf8'));

function searchItem(item, pathStr = '') {
  for (const i of item) {
    if (i.item) {
      searchItem(i.item, pathStr + i.name + ' > ');
    } else {
      if (i.name.toLowerCase().includes('recall') || 
          (i.request && i.request.url && i.request.url.raw && i.request.url.raw.toLowerCase().includes('recall'))) {
        console.log("Found:", pathStr + i.name);
      }
    }
  }
}
searchItem(col.item);
