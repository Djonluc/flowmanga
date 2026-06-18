const fs = require('fs');
fetch('https://api.nekosapi.com/v4/images/random')
  .then(res => res.json())
  .then(data => {
    fs.writeFileSync('nekos_response.json', JSON.stringify(data, null, 2));
    console.log("Done");
  })
  .catch(err => console.error(err));
