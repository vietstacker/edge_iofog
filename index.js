const iofog = require('@iofog/nodejs-sdk');

// Used as our in-memory cache of our configuration
// that will be provided by the Controller
let config = {
  maxWindowSize: 150 // Default value in case no config is provided
};
function updateConfig() {
  iofog.getConfig({
    onNewConfig: newConfig => {
      config = newConfig;
    },
    onBadRequest: err => console.error('updateConfig failed: ', err),
    onError: err => console.error('updateConfig failed: ', err)
  });
}

const sum = values => values.reduce((a, b) => a + b, 0);
const average = values => sum(values) / (values.length || 1);

function getMovingAverage(arr, newValue) {
  // Evict the oldest values once we've reached our max window size.
  while (arr.length >= config.maxWindowSize) {
    // <------- config
    arr.shift();
  }
  arr.push(newValue);
  return average(arr);
}

// This is basically our "entry point", provided to iofog.init() below
function main() {
  updateConfig();

  iofog.wsControlConnection({
    onNewConfigSignal: () => updateConfig(),
    onError: err => console.error('Error with Control Connection: ', err)
  });

  const onMessageConnectionOpen = () => {
    console.log('Listening for incoming messages');
  };

  // Cache for our previous values received so we can compute our average
  const prevSpeeds = [];
  const prevAccelerations = [];
  const prevRpms = [];

  iofog.wsMessageConnection(onMessageConnectionOpen, {
    onMessages: messages => {
      if (messages) {
        for (const msg of messages) {
          const input = JSON.parse(msg.contentdata.toString());

          // Produce moving averages for all the sensor values
          const result = {
            isAverage: true,
            time: input.time, // same time as
            speed: getMovingAverage(prevSpeeds, parseFloat(input.speed)),
            acceleration: getMovingAverage(
              prevAccelerations,
              parseFloat(input.acceleration)
            ),
            rpm: getMovingAverage(prevRpms, parseFloat(input.rpm))
          };

          const output = iofog.ioMessage({
            contentdata: Buffer.from(JSON.stringify(result)).toString(),
            infotype: 'application/json',
            infoformat: 'text/utf-8'
          });

          iofog.wsSendMessage(output);
        }
      }
    },
    onMessageReceipt: (messageId, timestamp) => {
      console.log('message receipt: ', {
        messageId,
        timestamp
      });
    },
    onError: err => console.error('Message WebSocket error: ', err)
  });
}

iofog.init('iofog', 54321, null, main);