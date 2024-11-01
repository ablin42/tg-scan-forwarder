const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const readline = require("readline");
const fs = require("fs");
require("dotenv").config();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const apiId = +process.env.API_ID;
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.SESSION_STRING); // fill this later with the value from session.save()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ? Insanely lazy implementation (didnt want to use any libraries to check for pubkey on curve)
const findCA = (message) => {
  const arr = message.split("\n");
  const CA = arr.find(
    (el) =>
      el.match(/^[a-z0-9]{44}$/i) || (el.startsWith("0x") && el.length === 42)
  );
  return CA;
};

// Forwards yourself all scans in the designated groups
// It also forwards the message rick replied to
// It also sends a /soc scan in YOUR group for every scan forwarded

const scanProcess = async () => {
  // Connect to your Telegram account
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    phoneNumber: async () =>
      new Promise((resolve) =>
        rl.question("Please enter your number: ", resolve)
      ),
    password: async () =>
      new Promise((resolve) =>
        rl.question("Please enter your password: ", resolve)
      ),
    phoneCode: async () =>
      new Promise((resolve) =>
        rl.question("Please enter the code you received: ", resolve)
      ),
    onError: (err) => console.log(err),
  });
  console.log("You should now be connected.");
  // console.log(client.session.save()); // Save this string to avoid logging in again

  // Used to keep track of the last scanned message in the chat
  const state = JSON.parse(fs.readFileSync("state.json"));
  const LAST_MESSAGE_ID = state.lastMessageId ?? 0;

  // Rick bot user id
  const RICK_ID = 6126376117n;

  // The chat you want to scan messages from
  const CHAT_ID = process.env.CHAT_ID;

  // The chat you want to send messages to
  const GROUP_ID = process.env.GROUP_ID;
  const messages = await client.getMessages(CHAT_ID, {
    limit: 200,
  });
  const sorted = messages?.sort((a, b) => +a.id - +b.id);

  // Loop through the messages and forward the ones that contains a scan
  sorted.reduce(async (promise, message) => {
    await promise;

    console.log(message.id);
    if (+message.id <= +LAST_MESSAGE_ID) return;

    // If the message is from rick
    if (message.fromId.userId.value === RICK_ID) {
      if (
        message?.message?.includes("🌐") ||
        message?.message?.includes("💊")
      ) {
        const CA = findCA(message.message);
        if (CA === undefined) {
          console.log("CA not found in message");
          return;
        }

        // Rick will reply to the user making the scan
        if (message?.replyTo !== null) {
          // Forwards yourself the message that was replied to
          await messages
            .find((msg) => msg.id === message.replyTo?.replyToMsgId)
            .forwardTo("me");
        }

        // Forwards yourself the rick scan
        await message.forwardTo("me");

        // Ask for a /soc scan in your group for every scan forwarded
        // You can add any other command you want for your scans here, like mugetsu's etc
        await client.sendMessage(GROUP_ID, {
          message: `/soc@RickBurpBot ${CA}`,
          replyTo: message.id,
        });
      }
    }
  }, Promise.resolve());

  // Save the last message id to avoid scanning the same messages again
  fs.writeFileSync(
    "state.json",
    JSON.stringify({
      lastMessageId: messages[messages.length - 1].id,
      message: messages[messages.length - 1].message,
    })
  );

  // I got really lazy...
  console.log("Sleeping for 30 seconds...");
  await sleep(1000 * 30);

  client.disconnect();
  return;
};

module.exports = {
  scanProcess,
};
