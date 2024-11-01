// @EXTERNALS
require("dotenv").config();
const { scanProcess } = require("./telegram");

// @MAIN
(async () => {
  await scanProcess();
  console.log("Exiting...");
  process.exit();
})();
