// index 3000'de, market Render'ın verdiği PORT'ta çalışsın
const originalPort = process.env.PORT;
process.env.PORT = 3000;
require("./index.js");
process.env.PORT = originalPort;
require("./market.js");
